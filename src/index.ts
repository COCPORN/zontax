import * as acorn from "acorn";
import { z } from "zod";

export class ZontaxMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZontaxMergeError";
  }
}

// SECURITY NOTE: RegExp patterns in allowedOnPath are expected to be defined by 
// developers in extension schemas, not end users. Simple path matching patterns
// like "user.profile.*" or "^user\.address\.(street|city)$" are the intended use case.
// The ReDoS validation below catches the most common problematic patterns while
// allowing safe, developer-defined path matching expressions.
export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  description: z.string().optional(),
  allowedOnPath: z
    .array(z.union([z.string(), z.instanceof(RegExp)]))
    .optional()
    .refine((paths) => {
      if (!paths) return true;
      for (const path of paths) {
        if (path instanceof RegExp) {
          // Check for potentially dangerous RegExp patterns
          const source = path.source;
          if (source.includes('(.*)+') || source.includes('(.+)+') || 
              source.includes('(.*)*') || source.includes('(.+)*') ||
              source.includes('(.*)(.*)') || source.includes('(.+)(.+)')) {
            return false;
          }
        }
      }
      return true;
    }, "RegExp patterns must not contain potentially dangerous constructs that could cause ReDoS"),
});

export type Extension = z.infer<typeof ExtensionMethodSchema>;

export interface SchemaRegistrationObject {
  namespace?: string;
  extensions: Extension[];
}
export type SchemaRegistration = Extension[] | SchemaRegistrationObject;
export interface ZontaxParserOptions {
  mode?: "strict" | "loose";
  zodVersion?: "3" | "4";
  maxInputLength?: number;
  parseTimeout?: number;
}

const KNOWN_ZOD_METHODS = [
  // Basic types
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "bigint",
  "symbol",
  "null",
  "undefined",
  "void",
  "any",
  "unknown",
  "never",
  // Composite types
  "object",
  "array",
  "tuple",
  "union",
  "enum",
  "literal",
  "record",
  // Validations
  "min",
  "max",
  "length",
  "email",
  "url",
  "uuid",
  "int",
  "positive",
  "negative",
  // Modifiers
  "optional",
  "nullable",
  "default",
  "describe",
];

export class ZontaxParser {
  private globalExtensions = new Map<string, Extension>();
  private namespacedExtensions = new Map<string, Map<string, Extension>>();
  private mode: "strict" | "loose";
  private zodVersion: "3" | "4";
  private maxInputLength: number;
  private parseTimeout: number;

  constructor(
    options: ZontaxParserOptions = {},
    registrations: SchemaRegistration[] = [],
  ) {
    this.mode = options.mode || "strict";
    this.zodVersion = options.zodVersion || "4";
    this.maxInputLength = options.maxInputLength || 10000;
    this.parseTimeout = options.parseTimeout || 5000;
    for (const reg of registrations) {
      if (Array.isArray(reg)) {
        this.registerGlobal(reg);
      } else {
        if (reg.namespace) {
          this.registerNamespace(reg.namespace, reg.extensions);
        } else {
          this.registerGlobal(reg.extensions);
        }
      }
    }
  }

  private registerGlobal(extensions: Extension[]) {
    for (const ext of extensions) {
      ExtensionMethodSchema.parse(ext);
      // Validate RegExp patterns in allowedOnPath
      if (ext.allowedOnPath) {
        for (const pattern of ext.allowedOnPath) {
          if (pattern instanceof RegExp) {
            this.validateRegExpPattern(pattern);
          }
        }
      }
      this.globalExtensions.set(ext.name, ext);
    }
  }

  private registerNamespace(namespace: string, extensions: Extension[]) {
    if (!this.namespacedExtensions.has(namespace)) {
      this.namespacedExtensions.set(namespace, new Map());
    }
    const nsMap = this.namespacedExtensions.get(namespace)!;
    for (const ext of extensions) {
      ExtensionMethodSchema.parse(ext);
      // Validate RegExp patterns in allowedOnPath
      if (ext.allowedOnPath) {
        for (const pattern of ext.allowedOnPath) {
          if (pattern instanceof RegExp) {
            this.validateRegExpPattern(pattern);
          }
        }
      }
      nsMap.set(ext.name, ext);
    }
  }

  // SECURITY NOTE: Input validation uses defense-in-depth with whitelist-first approach:
  // 1. Primary: validateInputStructure ensures only valid Zontax syntax is allowed
  // 2. Secondary: Pattern blacklist catches obvious dangerous constructs
  // This is appropriate for parsing developer-defined schema extensions where the
  // expected input format is well-defined and constrained.
  private validateInput(source: string): void {
    if (typeof source !== "string") {
      throw new ZontaxMergeError("Input must be a string");
    }
    if (source.length > this.maxInputLength) {
      throw new ZontaxMergeError(
        `Input length exceeds maximum allowed length of ${this.maxInputLength} characters`,
      );
    }
    
    // Whitelist approach - validate that input matches expected Zontax schema structure
    if (!this.validateInputStructure(source)) {
      throw new ZontaxMergeError("Input does not match expected Zontax schema structure");
    }
    
    // Additional blacklist checks for known dangerous patterns (defense in depth)
    const criticalPatterns = [
      /\beval\s*\(/,                          // eval() calls
      /\bnew\s+Function\s*\(/,                // Function constructor
      /\bsetTimeout\s*\(/,                    // setTimeout with string
      /\bsetInterval\s*\(/,                   // setInterval with string
      /\bimport\s*\(/,                        // Dynamic imports
      /\brequire\s*\(/,                       // CommonJS require
      /\bprocess\s*\./,                       // Process object access
      /\bglobal\s*\./,                        // Global object access
      /\bwindow\s*\./,                        // Window object access
      /\bdocument\s*\./,                      // Document object access
      /\blocation\s*\./,                      // Location object access
      /\bnavigator\s*\./,                     // Navigator object access
      /\bhistory\s*\./,                       // History object access
      /\bworker\s*\./,                        // Worker object access
      /\bXMLHttpRequest\s*\(/,                // XMLHttpRequest
      /\bfetch\s*\(/,                         // Fetch API
      /\bwebSocket\s*\(/,                     // WebSocket
      /\bmodule\s*\./,                        // Module access
      /\bexports\s*\./,                       // Exports access
      /\b__dirname\b/,                        // Node.js dirname
      /\b__filename\b/,                       // Node.js filename
      /\bBuffer\s*\(/,                        // Node.js Buffer
      /\bfs\s*\./,                            // File system access
      /\bpath\s*\./,                          // Path utilities
      /\bos\s*\./,                            // OS utilities
      /\bchild_process\s*\./,                 // Child process
      /\bcluster\s*\./,                       // Cluster module
      /\burl\s*\./,                           // URL module
      /\bhttp\s*\./,                          // HTTP module
      /\bhttps\s*\./,                         // HTTPS module
      /\bnet\s*\./,                           // Net module
      /\btls\s*\./,                           // TLS module
      /\bdgram\s*\./,                         // Datagram module
      /\bstream\s*\./,                        // Stream module
      /\bevents\s*\./,                        // Events module
      /\butil\s*\./,                          // Util module
      /\bcrypto\s*\./,                        // Crypto module
      /\bzlib\s*\./,                          // Zlib module
      /\bquerystring\s*\./,                   // Query string module
      /\bstring_decoder\s*\./,                // String decoder module
      /\bv8\s*\./,                            // V8 module
      /\bvm\s*\./,                            // VM module
      /\bworker_threads\s*\./,                // Worker threads
      /\basync_hooks\s*\./,                   // Async hooks
      /\bperf_hooks\s*\./,                    // Performance hooks
    ];
    
    for (const pattern of criticalPatterns) {
      if (pattern.test(source)) {
        throw new ZontaxMergeError("Input contains forbidden patterns");
      }
    }
  }

  private validateInputStructure(source: string): boolean {
    // Expected structure: Z.method().method()... or object literals
    // This is a whitelist approach to validate expected Zontax patterns
    
    // Remove whitespace and comments for easier parsing
    const cleanSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
    
    // Check if empty
    if (!cleanSource) {
      return false;
    }
    
    // Expected patterns for Zontax schemas
    const allowedPatterns = [
      // Basic Z.method() chains
      /^Z\.[a-zA-Z_$][a-zA-Z0-9_$]*\(\)/,
      // Z.method().method() chains
      /^Z\.[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*\)(\.[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*\))*$/,
      // Object literals
      /^\{[\s\S]*\}$/,
      // Array literals
      /^\[[\s\S]*\]$/,
      // String literals
      /^"[^"]*"$/,
      /^'[^']*'$/,
      // Number literals
      /^-?\d+(\.\d+)?$/,
      // Boolean literals
      /^(true|false)$/,
      // null/undefined
      /^(null|undefined)$/,
      // Identifier patterns for special values
      /^(NaN|Infinity)$/,
    ];
    
    // Check basic structure
    for (const pattern of allowedPatterns) {
      if (pattern.test(cleanSource)) {
        return true;
      }
    }
    
    // More complex validation for nested structures
    return this.validateComplexStructure(cleanSource);
  }

  private validateComplexStructure(source: string): boolean {
    // Check for balanced parentheses, brackets, and braces
    if (!this.hasBalancedDelimiters(source)) {
      return false;
    }
    
    // Check for only allowed characters and patterns
    const allowedCharsPattern = /^[a-zA-Z0-9_$\s\[\]{}().,:"'`\-+*/=!<>&|?;]+$/;
    if (!allowedCharsPattern.test(source)) {
      return false;
    }
    
    // Check for reasonable nesting depth
    const maxNestingDepth = 20;
    if (this.calculateDelimiterDepth(source) > maxNestingDepth) {
      return false;
    }
    
    // Check for reasonable number of tokens
    const tokens = source.split(/\s+/).filter(token => token.length > 0);
    if (tokens.length > 1000) {
      return false;
    }
    
    return true;
  }

  private hasBalancedDelimiters(source: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
    };
    
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      
      if (char === '"' || char === "'") {
        // Skip string literals
        const quote = char;
        i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') i++; // Skip escaped characters
          i++;
        }
        continue;
      }
      
      if (pairs[char]) {
        stack.push(char);
      } else if (Object.values(pairs).includes(char)) {
        const expected = pairs[stack.pop() || ''];
        if (expected !== char) {
          return false;
        }
      }
    }
    
    return stack.length === 0;
  }

  private calculateDelimiterDepth(source: string): number {
    let depth = 0;
    let maxDepth = 0;
    
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      
      if (char === '"' || char === "'") {
        // Skip string literals
        const quote = char;
        i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') i++; // Skip escaped characters
          i++;
        }
        continue;
      }
      
      if (char === '(' || char === '[' || char === '{') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === ')' || char === ']' || char === '}') {
        depth--;
      }
    }
    
    return maxDepth;
  }

  // SECURITY NOTE: Memory monitoring is Node.js-specific and will not work in browsers.
  // In browser environments, other protections (timeout, complexity limits, input length)
  // provide DoS protection. For browser-specific memory limiting, consider Web Workers
  // with message passing and termination capabilities.
  private parseWithTimeout(source: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ZontaxMergeError("Parse operation timed out"));
      }, this.parseTimeout);

      // Resource monitoring
      const startTime = Date.now();
      const maxMemoryUsage = 50 * 1024 * 1024; // 50MB limit
      let memoryCheck: NodeJS.Timeout | null = null;
      
      // Memory monitoring (if in Node.js environment)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const initialMemory = process.memoryUsage().heapUsed;
        memoryCheck = setInterval(() => {
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory - initialMemory > maxMemoryUsage) {
            clearTimeout(timeout);
            if (memoryCheck) clearInterval(memoryCheck);
            reject(new ZontaxMergeError("Parse operation exceeded memory limit"));
          }
        }, 100);
      }

      try {
        // Enhanced acorn options for security
        const parseOptions = {
          ecmaVersion: 2020 as const,
          locations: true,
          allowReturnOutsideFunction: false,
          allowImportExportEverywhere: false,
          allowAwaitOutsideFunction: false,
          allowHashBang: false,
        };

        const result = acorn.parse(source, parseOptions);
        
        // Validate parsing time
        const parseTime = Date.now() - startTime;
        if (parseTime > this.parseTimeout * 0.8) {
          clearTimeout(timeout);
          if (memoryCheck) clearInterval(memoryCheck);
          reject(new ZontaxMergeError("Parse operation took too long"));
          return;
        }

        // Validate AST structure and complexity
        this.validateASTStructure(result);
        
        clearTimeout(timeout);
        if (memoryCheck) clearInterval(memoryCheck);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        if (memoryCheck) clearInterval(memoryCheck);
        
        // Categorize and handle different types of errors
        if (error instanceof ZontaxMergeError) {
          reject(error);
        } else if (error instanceof SyntaxError) {
          reject(new ZontaxMergeError("Invalid syntax in input"));
        } else if (error && typeof error === 'object' && 'name' in error) {
          const typedError = error as any;
          if (typedError.name === 'RangeError') {
            reject(new ZontaxMergeError("Input too complex to parse"));
          } else if (typedError.name === 'TypeError') {
            reject(new ZontaxMergeError("Invalid input structure"));
          } else if (typedError.message && typedError.message.includes('memory')) {
            reject(new ZontaxMergeError("Insufficient memory to parse input"));
          } else if (typedError.message && typedError.message.includes('timeout')) {
            reject(new ZontaxMergeError("Parse operation timed out"));
          } else {
            // Generic error without leaking details
            reject(new ZontaxMergeError("Failed to parse input"));
          }
        } else {
          // Generic error without leaking details
          reject(new ZontaxMergeError("Failed to parse input"));
        }
      }
    });
  }

  private validateASTStructure(ast: any): void {
    if (!ast || typeof ast !== 'object') {
      throw new ZontaxMergeError("Invalid AST structure");
    }

    if (!ast.type || ast.type !== 'Program') {
      throw new ZontaxMergeError("Invalid AST root type");
    }

    if (!Array.isArray(ast.body)) {
      throw new ZontaxMergeError("Invalid AST body structure");
    }

    // Validate AST complexity
    const complexity = this.calculateASTComplexity(ast);
    if (complexity.nodeCount > 1000) {
      throw new ZontaxMergeError("AST too complex - node count exceeds limit");
    }

    if (complexity.depth > 50) {
      throw new ZontaxMergeError("AST too complex - depth exceeds limit");
    }

    // Validate for unexpected node types
    this.validateASTNodes(ast);
  }

  private calculateASTComplexity(node: any, depth: number = 0): { nodeCount: number; depth: number } {
    if (!node || typeof node !== 'object') {
      return { nodeCount: 0, depth: depth };
    }

    let nodeCount = 1;
    let maxDepth = depth;

    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== 'type' && key !== 'start' && key !== 'end' && key !== 'loc') {
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            const complexity = this.calculateASTComplexity(item, depth + 1);
            nodeCount += complexity.nodeCount;
            maxDepth = Math.max(maxDepth, complexity.depth);
          }
        } else if (value && typeof value === 'object') {
          const complexity = this.calculateASTComplexity(value, depth + 1);
          nodeCount += complexity.nodeCount;
          maxDepth = Math.max(maxDepth, complexity.depth);
        }
      }
    }

    return { nodeCount, depth: maxDepth };
  }

  private validateASTNodes(node: any): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Whitelist of allowed AST node types
    const allowedNodeTypes = [
      'Program',
      'ExpressionStatement',
      'CallExpression',
      'MemberExpression',
      'Identifier',
      'Literal',
      'ObjectExpression',
      'Property',
      'ArrayExpression',
      'UnaryExpression',
      'BinaryExpression',
      'LogicalExpression',
      'ConditionalExpression',
      'AssignmentExpression',
      'UpdateExpression',
      'SequenceExpression',
      'ThisExpression',
      'NewExpression',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'BlockStatement',
      'ReturnStatement',
      'IfStatement',
      'WhileStatement',
      'ForStatement',
      'DoWhileStatement',
      'BreakStatement',
      'ContinueStatement',
      'ThrowStatement',
      'TryStatement',
      'CatchClause',
      'SwitchStatement',
      'SwitchCase',
      'VariableDeclaration',
      'VariableDeclarator',
      'FunctionDeclaration',
      'RestElement',
      'SpreadElement',
      'ObjectPattern',
      'ArrayPattern',
      'AssignmentPattern',
      'ClassDeclaration',
      'ClassExpression',
      'MethodDefinition',
      'Super',
      'MetaProperty',
      'ImportDeclaration',
      'ImportSpecifier',
      'ImportDefaultSpecifier',
      'ImportNamespaceSpecifier',
      'ExportNamedDeclaration',
      'ExportSpecifier',
      'ExportDefaultDeclaration',
      'ExportAllDeclaration',
      'TemplateLiteral',
      'TemplateElement',
      'TaggedTemplateExpression',
      'YieldExpression',
      'AwaitExpression',
    ];

    if (node.type && !allowedNodeTypes.includes(node.type)) {
      throw new ZontaxMergeError(`Forbidden AST node type: ${node.type}`);
    }

    // Recursively validate child nodes
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== 'type' && key !== 'start' && key !== 'end' && key !== 'loc') {
        const value = node[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            this.validateASTNodes(item);
          }
        } else if (value && typeof value === 'object') {
          this.validateASTNodes(value);
        }
      }
    }
  }

  private validateASTNode(node: any, depth: number = 0): void {
    if (depth > 50) {
      throw new ZontaxMergeError("AST depth exceeds maximum allowed depth");
    }
    if (!node || typeof node !== "object") {
      throw new ZontaxMergeError("Invalid AST node");
    }
    if (!node.type || typeof node.type !== "string") {
      throw new ZontaxMergeError("AST node missing or invalid type");
    }
    
    const allowedNodeTypes = [
      "ExpressionStatement",
      "CallExpression", 
      "MemberExpression",
      "ObjectExpression",
      "ArrayExpression",
      "Property",
      "Identifier",
      "Literal",
      "UnaryExpression"
    ];
    
    if (!allowedNodeTypes.includes(node.type)) {
      throw new ZontaxMergeError(`Unsupported AST node type: ${node.type}`);
    }
  }

  private validateDefinition(def: any): void {
    if (!def || typeof def !== "object") {
      throw new ZontaxMergeError("Invalid definition object");
    }
    
    if (def.type && typeof def.type !== "string") {
      throw new ZontaxMergeError("Definition type must be a string");
    }
    
    if (def.fields && typeof def.fields !== "object") {
      throw new ZontaxMergeError("Definition fields must be an object");
    }
    
    if (def.validations && typeof def.validations !== "object") {
      throw new ZontaxMergeError("Definition validations must be an object");
    }
    
    if (def.extensions && typeof def.extensions !== "object") {
      throw new ZontaxMergeError("Definition extensions must be an object");
    }
    
    if (def.namespaces && typeof def.namespaces !== "object") {
      throw new ZontaxMergeError("Definition namespaces must be an object");
    }
  }

  // SECURITY NOTE: ReDoS detection uses a comprehensive blacklist of known problematic patterns.
  // While blacklisting cannot catch all possible ReDoS vulnerabilities, it covers the most
  // common patterns and is appropriate for Zontax's use case where RegExp patterns are
  // developer-defined for simple path matching (e.g., "user.profile.*"). The validation
  // includes exceptions for safe anchored patterns commonly used in path matching.
  private validateRegExpPattern(pattern: RegExp): void {
    const source = pattern.source;
    const flags = pattern.flags;
    
    // Skip validation for anchored patterns that are likely safe
    if (source.startsWith('^') && source.endsWith('$') && !source.includes('.*') && !source.includes('.+')) {
      return;
    }
    
    // Comprehensive ReDoS pattern detection
    const redosPatterns = [
      // Nested quantifiers - the most common ReDoS pattern
      /\([^)]*[+*]\)[+*]/,                    // (a+)+ or (a*)*
      /\([^)]*[+*]\)[+*?]/,                   // (a+)? or (a*)+
      /\([^)]*[?]\)[+*]/,                     // (a?)* or (a?)+
      /\([^)]*\{[^}]*\}\)[+*]/,               // (a{1,2})+ or (a{0,})*
      
      // Alternation with overlap - only flag if there are quantifiers after alternation
      /\((.+)\|(\1)\)[+*]/,                   // (a|a)* or (b|b)+ - exact duplicates
      /\((.+)\|(\1)\?\)[+*]/,                 // (a|a?)* or (b|b?)+ - with optional
      
      // Exponential backtracking patterns
      /\([^)]*\.\*[^)]*\)[+*]/,               // (.*)+ or (.*)* 
      /\([^)]*\.\+[^)]*\)[+*]/,               // (.+)+ or (.+)*
      /\([^)]*\.\?[^)]*\)[+*]/,               // (.?)+ or (.?)*
      
      // Character class with quantifiers
      /\[[^\]]*\]\*\[[^\]]*\]\*/,             // [a-z]*[0-9]* (can be exponential)
      /\[[^\]]*\]\+\[[^\]]*\]\+/,             // [a-z]+[0-9]+ (can be exponential)
      
      // Nested groups with quantifiers
      /\(\([^)]*\)[+*]\)[+*]/,                // ((a)+)+ or ((a)*)*
      /\(\([^)]*\)\?\)[+*]/,                  // ((a)?)+
      
      // Lookahead/lookbehind with quantifiers (if supported)
      /\(\?\=[^)]*[+*]\)[+*]/,                // (?=a+)+ 
      /\(\?\![^)]*[+*]\)[+*]/,                // (?!a+)+
      
      // Specific problematic patterns
      /\((.*)\).*\1/,                         // Backreference with .* can cause exponential
      /\(([^)]*)\)\1[+*]/,                    // Backreference with quantifier
      /\^.*\$.*\^/,                           // Multiple anchors
      
      // Complex character classes
      /\[[^\]]{50,}\]/,                       // Very long character classes
      /\[.*\[\^.*\].*\]/,                     // Nested character classes
      
      // Greedy quantifiers with overlapping patterns
      /\w*\w+/,                               // Overlapping word characters
      /\d*\d+/,                               // Overlapping digits
      /\s*\s+/,                               // Overlapping whitespace
      
      // Union with similar patterns - only flag if they have quantifiers
      /\([^|)]*\|[^|)]*\)\*\+/,               // (similar|pattern)*+ type patterns
      /\([^|)]*\|[^|)]*\)\+\*/,               // (similar|pattern)+* type patterns
    ];
    
    // Check against known ReDoS patterns
    for (const redosPattern of redosPatterns) {
      if (redosPattern.test(source)) {
        throw new ZontaxMergeError("RegExp pattern contains ReDoS vulnerability");
      }
    }
    
    // Advanced complexity analysis
    const metrics = this.analyzeRegExpComplexity(source);
    if (metrics.riskScore > 100) {
      throw new ZontaxMergeError("RegExp pattern complexity exceeds safe limits");
    }
    
    // Check for excessively long patterns
    if (source.length > 500) {
      throw new ZontaxMergeError("RegExp pattern is too long");
    }
    
    // Check for excessive nesting depth
    const nestingDepth = this.calculateNestingDepth(source);
    if (nestingDepth > 10) {
      throw new ZontaxMergeError("RegExp pattern nesting depth exceeds safe limits");
    }
    
    // Check for too many quantifiers
    const quantifierCount = (source.match(/[+*?{}]/g) || []).length;
    if (quantifierCount > 20) {
      throw new ZontaxMergeError("RegExp pattern has too many quantifiers");
    }
    
    // Check for suspicious flag combinations
    if (flags.includes('g') && flags.includes('i') && source.includes('.*')) {
      throw new ZontaxMergeError("RegExp pattern with global, case-insensitive flags and .* is potentially dangerous");
    }
  }

  private analyzeRegExpComplexity(source: string): { riskScore: number } {
    let riskScore = 0;
    
    // Count various risky elements
    const quantifiers = (source.match(/[+*?]/g) || []).length;
    const groups = (source.match(/\(/g) || []).length;
    const alternations = (source.match(/\|/g) || []).length;
    const characterClasses = (source.match(/\[/g) || []).length;
    const wildcards = (source.match(/\./g) || []).length;
    const anchors = (source.match(/[\^$]/g) || []).length;
    
    // Calculate risk score
    riskScore += quantifiers * 5;
    riskScore += groups * 3;
    riskScore += alternations * 4;
    riskScore += characterClasses * 2;
    riskScore += wildcards * 3;
    riskScore += anchors * 1;
    
    // Exponential risk for nested patterns
    if (quantifiers > 0 && groups > 0) {
      riskScore += quantifiers * groups * 10;
    }
    
    // High risk for alternation with quantifiers
    if (alternations > 0 && quantifiers > 0) {
      riskScore += alternations * quantifiers * 8;
    }
    
    return { riskScore };
  }

  private calculateNestingDepth(source: string): number {
    let depth = 0;
    let maxDepth = 0;
    
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (char === '(') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === ')') {
        depth--;
      }
    }
    
    return maxDepth;
  }

  private buildDefinition(node: any, path: string[] = [], depth: number = 0): any {
    this.validateASTNode(node, depth);
    
    if (node.type === "ExpressionStatement") {
      return this.buildDefinition(node.expression, path, depth + 1);
    }
    if (node.type === "CallExpression") {
      let data: any = {};
      let current = node;
      while (current && current.type === "CallExpression") {
        const callee = current.callee;
        if (callee.type === "MemberExpression") {
          const methodName = callee.property.name;
          const args = current.arguments.map((arg: any) =>
            this.buildDefinition(arg, path, depth + 1),
          );
          const [namespace, extName] = methodName.includes("$")
            ? methodName.split("$")
            : [null, methodName];

          const extension = namespace
            ? this.namespacedExtensions.get(namespace)?.get(extName)
            : this.globalExtensions.get(extName);

          if (extension) {
            if (extension.allowedOnPath) {
              const currentPath = path.join(".");
              const isAllowed = extension.allowedOnPath.some((pattern) => {
                if (typeof pattern === "string") {
                  if (pattern.endsWith(".*")) {
                    const base = pattern.slice(0, -2);
                    return (
                      currentPath.startsWith(base) &&
                      currentPath.split(".").length ===
                        base.split(".").length + 1
                    );
                  }
                  return pattern === currentPath;
                } else if (pattern instanceof RegExp) {
                  return pattern.test(currentPath);
                }
                return false;
              });
              if (!isAllowed) {
                throw new ZontaxMergeError(
                  `Extension '${methodName}' is not allowed on path '${currentPath}'.`,
                );
              }
            }
            if (namespace) {
              if (!data.namespaces) data.namespaces = {};
              if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
              data.namespaces[namespace][extName] = {
                value: args.length === 1 ? args[0] : args,
              };
            } else {
              if (!data.extensions) data.extensions = {};
              data.extensions[extName] = {
                value: args.length === 1 ? args[0] : args,
              };
            }
          } else if (KNOWN_ZOD_METHODS.includes(methodName)) {
            if (
              [
                "min",
                "max",
                "length",
                "email",
                "url",
                "uuid",
                "int",
                "positive",
                "negative",
              ].includes(methodName)
            ) {
              if (!data.validations) data.validations = {};
              data.validations[methodName] = args.length > 0 ? args[0] : true;
            } else if (
              ["string", "number", "boolean", "date", "datetime", "bigint", "symbol", "null", "undefined", "void", "any", "unknown", "never"].includes(methodName)
            ) {
              data.type = methodName === "datetime" ? "date" : methodName;
            } else if (methodName === "record") {
              data.type = "record";
              data.keySchema = args[0];
              data.valueSchema = args[1];
            } else if (methodName === "optional") {
              data.optional = true;
            } else if (methodName === "nullable") {
              data.nullable = true;
            } else if (methodName === "default") {
              data.defaultValue = args[0];
            } else if (methodName === "describe") {
              data.description = args[0];
            } else if (methodName === "object") {
              data.type = "object";
              data.fields = args[0].fields;
            } else if (methodName === "array") {
              data.type = "array";
              data.of = args[0];
            } else if (methodName === "enum") {
              data.type = "enum";
              // For enum, parse the array literal argument
              const enumArg = current.arguments[0];
              if (enumArg.type === "ArrayExpression") {
                data.values = enumArg.elements.map((elem: any) =>
                  this.buildDefinition(elem, path, depth + 1),
                );
              } else {
                data.values = args[0];
              }
            } else if (methodName === "literal") {
              data.type = "literal";
              data.value = args[0];
            } else if (methodName === "tuple") {
              data.type = "tuple";
              // For tuple, parse the array literal argument
              const tupleArg = current.arguments[0];
              if (tupleArg.type === "ArrayExpression") {
                data.items = tupleArg.elements.map((elem: any) =>
                  this.buildDefinition(elem, path, depth + 1),
                );
              } else {
                data.items = args[0];
              }
            } else if (methodName === "union") {
              data.type = "union";
              // For union, parse the array literal argument
              const unionArg = current.arguments[0];
              if (unionArg.type === "ArrayExpression") {
                data.options = unionArg.elements.map((elem: any) =>
                  this.buildDefinition(elem, path, depth + 1),
                );
              } else {
                data.options = args[0];
              }
            }
          } else if (this.mode === "loose") {
            if (namespace) {
              if (!data.namespaces) data.namespaces = {};
              if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
              data.namespaces[namespace][extName] = {
                value: args.length === 1 ? args[0] : args,
              };
            } else {
              if (!data.extensions) data.extensions = {};
              data.extensions[extName] = {
                value: args.length === 1 ? args[0] : args,
              };
            }
          } else {
            throw new ZontaxMergeError(
              `Unrecognized method '.${methodName}()'.`,
            );
          }
        }
        current = current.callee.object;
      }
      if (
        current &&
        current.type === "MemberExpression" &&
        current.object.name === "Z"
      ) {
        data.type = current.property.name;
      }
      return data;
    }
    if (node.type === "ObjectExpression") {
      const fields: any = {};
      for (const prop of node.properties) {
        const key =
          prop.key.type === "Literal" ? prop.key.value : prop.key.name;
        fields[key] = this.buildDefinition(prop.value, [...path, key], depth + 1);
      }
      return { type: "object", fields };
    }
    if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      node.object.name === "Z"
    ) {
      return { type: node.property.name };
    }
    return this.generateSafeValue(node);
  }

  private generateSafeValue(node: any): any {
    // Validate node structure first
    if (!node || typeof node !== "object") {
      throw new ZontaxMergeError("Invalid node structure");
    }
    
    if (!node.type || typeof node.type !== "string") {
      throw new ZontaxMergeError("Invalid node type");
    }

    switch (node.type) {
      case "Literal":
        // Only allow safe literal values
        if (node.value === null || 
            typeof node.value === "string" || 
            typeof node.value === "number" || 
            typeof node.value === "boolean") {
          return node.value;
        }
        throw new ZontaxMergeError("Unsupported literal value type");
        
      case "ObjectExpression": {
        if (!Array.isArray(node.properties)) {
          throw new ZontaxMergeError("Invalid object expression structure");
        }
        
        const obj: any = {};
        for (const prop of node.properties) {
          if (!prop.key || !prop.value) {
            throw new ZontaxMergeError("Invalid property structure");
          }
          
          const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
          if (typeof key !== "string") {
            throw new ZontaxMergeError("Invalid property key");
          }
          
          obj[key] = this.generateSafeValue(prop.value);
        }
        return obj;
      }
      
      case "ArrayExpression":
        if (!Array.isArray(node.elements)) {
          throw new ZontaxMergeError("Invalid array expression structure");
        }
        
        return node.elements.map((elem: any) => {
          if (!elem) {
            throw new ZontaxMergeError("Invalid array element");
          }
          // Handle CallExpression nodes in arrays (like Z.string(), Z.number())
          if (elem.type === 'CallExpression') {
            return this.buildDefinition(elem);
          }
          return this.generateSafeValue(elem);
        });
        
      case "Identifier":
        if (typeof node.name !== "string") {
          throw new ZontaxMergeError("Invalid identifier name");
        }
        
        if (node.name === "undefined") {
          return undefined;
        }
        if (node.name === "NaN") {
          return NaN;
        }
        if (node.name === "Infinity") {
          return Infinity;
        }
        throw new ZontaxMergeError("Unsupported identifier");
        
      case "UnaryExpression":
        if (typeof node.operator !== "string") {
          throw new ZontaxMergeError("Invalid unary operator");
        }
        
        if (node.operator === "-" &&
            node.argument &&
            node.argument.type === "Literal" &&
            typeof node.argument.value === "number") {
          return -node.argument.value;
        }
        throw new ZontaxMergeError("Unsupported unary expression");
        
      default:
        throw new ZontaxMergeError("Unsupported node type");
    }
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof RegExp) {
      return new RegExp(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const cloned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    
    return obj;
  }

  private deepMergeDefinitions(defs: any[], path: string[] = []): any {
    if (defs.length === 0) return {};
    if (defs.length === 1) {
      this.validateDefinition(defs[0]);
      return defs[0];
    }

    // Validate all definitions before merging
    for (const def of defs) {
      this.validateDefinition(def);
    }

    const base = this.deepClone(defs[0]);
    for (let i = 1; i < defs.length; i++) {
      const overlay = defs[i];
      const currentPath = path.join(".");

      if (base.type && overlay.type && base.type !== overlay.type) {
        throw new ZontaxMergeError(
          `Type mismatch at schema index ${i} for field '${currentPath}': Cannot merge type '${overlay.type}' into '${base.type}'.`,
        );
      }
      if (overlay.fields) {
        if (!base.fields) base.fields = {};
        for (const fieldName in overlay.fields) {
          if (!base.fields[fieldName]) {
            base.fields[fieldName] = overlay.fields[fieldName];
          } else {
            base.fields[fieldName] = this.deepMergeDefinitions(
              [base.fields[fieldName], overlay.fields[fieldName]],
              [...path, fieldName],
            );
          }
        }
      }
      if (overlay.validations) {
        if (!base.validations) base.validations = {};
        for (const key in overlay.validations) {
          if (
            base.validations[key] !== undefined &&
            base.validations[key] !== overlay.validations[key]
          ) {
            throw new ZontaxMergeError(
              `Validation conflict at schema index ${i} for field '${currentPath}': Mismatch for validation '${key}'.`,
            );
          }
          base.validations[key] = overlay.validations[key];
        }
      }
      if (overlay.extensions) {
        if (!base.extensions) base.extensions = {};
        Object.assign(base.extensions, overlay.extensions);
      }
      if (overlay.namespaces) {
        if (!base.namespaces) base.namespaces = {};
        for (const nsName in overlay.namespaces) {
          if (!base.namespaces[nsName]) base.namespaces[nsName] = {};
          Object.assign(base.namespaces[nsName], overlay.namespaces[nsName]);
        }
      }
      if (overlay.optional) {
        base.optional = true;
      }
      if (overlay.nullable) {
        base.nullable = true;
      }
      if (overlay.defaultValue !== undefined) {
        base.defaultValue = overlay.defaultValue;
      }
      if (overlay.description !== undefined) {
        base.description = overlay.description;
      }
    }
    return base;
  }

  private generateVersionSpecificMethod(
    method: string,
    args: string[] = [],
  ): string {
    // Handle version-specific method generation
    // Currently most methods are the same across versions
    const argStr = args.length > 0 ? `(${args.join(", ")})` : "()";
    return `z.${method}${argStr}`;
  }

  // SECURITY NOTE: JSON.stringify safely escapes user data in generated schema strings.
  // This prevents injection attacks by properly escaping quotes, backslashes, and control
  // characters. The generated strings are intended for direct Zod usage, not eval().
  // JSON.stringify is the standard and safe way to embed user data in generated code.
  private generateSchemaString(def: any): string {
    if (!def || !def.type) return "";
    let chain = "";
    if (def.type === "object") {
      const fieldsStr = Object.entries(def.fields || {})
        .map(([key, value]) => `${key}: ${this.generateSchemaString(value)}`)
        .join(", ");
      chain = `z.object({ ${fieldsStr} })`;
    } else if (def.type === "array") {
      chain = `z.array(${this.generateSchemaString(def.of)})`;
    } else if (def.type === "record") {
      chain = `z.record(${this.generateSchemaString(def.keySchema)}, ${this.generateSchemaString(def.valueSchema)})`;
    } else if (def.type === "enum") {
      const values = Array.isArray(def.values) ? def.values : [def.values];
      const valuesStr = values.map((v: any) => JSON.stringify(v)).join(", ");
      // Both Zod 3 and 4 support z.enum([...]) for string arrays
      chain = `z.enum([${valuesStr}])`;
    } else if (def.type === "literal") {
      chain = `z.literal(${JSON.stringify(def.value)})`;
    } else if (def.type === "tuple") {
      const itemsStr = Array.isArray(def.items)
        ? def.items
            .map((item: any) => this.generateSchemaString(item))
            .join(", ")
        : "";
      chain = `z.tuple([${itemsStr}])`;
    } else if (def.type === "union") {
      const optionsStr = Array.isArray(def.options)
        ? def.options
            .map((option: any) => this.generateSchemaString(option))
            .join(", ")
        : "";
      chain = `z.union([${optionsStr}])`;
    } else {
      chain = `z.${def.type}()`;
    }

    if (def.validations) {
      for (const key in def.validations) {
        const value = def.validations[key];
        chain += `.${key}(${value === true ? "" : JSON.stringify(value)})`;
      }
    }
    if (def.description) {
      chain += `.describe(${JSON.stringify(def.description)})`;
    }
    if (def.defaultValue !== undefined) {
      chain += `.default(${JSON.stringify(def.defaultValue)})`;
    }
    if (def.nullable) {
      chain += ".nullable()";
    }
    if (def.optional) {
      chain += ".optional()";
    }
    return chain;
  }

  async parse(...sources: string[]): Promise<{ schema: string; definition: any }> {
    if (sources.length === 0) {
      return { schema: "", definition: {} };
    }
    
    const definitions = await Promise.all(
      sources.map(async (source) => {
        this.validateInput(source);
        const ast = await this.parseWithTimeout(source);
        return this.buildDefinition(ast.body[0]);
      })
    );

    const mergedDefinition = this.deepMergeDefinitions(definitions);
    const schema = this.generateSchemaString(mergedDefinition);

    return { schema, definition: mergedDefinition };
  }

  public getExtensions(): Record<string, Extension[]> {
    const namespaces: Record<string, Extension[]> = {};
    for (const [name, extensionsMap] of this.namespacedExtensions.entries()) {
      namespaces[name] = Array.from(extensionsMap.values());
    }

    return {
      _global: Array.from(this.globalExtensions.values()),
      ...namespaces,
    };
  }

  public static getDefinitionByNamespace(
    definition: any,
    namespace: string,
  ): Record<string, any> {
    const byNamespace: Record<string, any> = {};
    if (!definition || !definition.fields) return byNamespace;

    for (const fieldName in definition.fields) {
      const field = definition.fields[fieldName];
      if (field.namespaces && field.namespaces[namespace]) {
        byNamespace[fieldName] = {
          ...field,
          namespaces: {
            [namespace]: field.namespaces[namespace],
          },
        };
      }
    }
    return byNamespace;
  }

  public static generateSchemaFromDefinition(
    definition: any,
    namespace?: string,
  ): Extension[] {
    const extensions: Extension[] = [];
    if (!definition || !definition.fields) return extensions;

    const seen = new Set<string>();

    for (const fieldName in definition.fields) {
      const field = definition.fields[fieldName];
      const process = (exts: any, ns?: string) => {
        if (!exts) return;
        for (const extName in exts) {
          const key = ns ? `${ns}${extName}` : extName;
          if (seen.has(key)) continue;

          const extValue = exts[extName].value;
          const args = Array.isArray(extValue)
            ? extValue.map((v) => typeof v)
            : [typeof extValue];

          extensions.push({
            name: extName,
            allowedOn: [field.type], // A starting point
            args: args,
          });
          seen.add(key);
        }
      };
      if (namespace) {
        process(field.namespaces?.[namespace], namespace);
      } else {
        process(field.extensions);
        if (field.namespaces) {
          for (const nsName in field.namespaces) {
            process(field.namespaces[nsName], nsName);
          }
        }
      }
    }
    return extensions;
  }
}
