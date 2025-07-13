import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import { z, ZodType } from 'zod';

// As per the PRD
export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  category: z.string(),
  description: z.string().optional()
});

export type Extension = z.infer<typeof ExtensionMethodSchema>;

// Standard Zod methods that can be chained
const KNOWN_ZOD_METHODS = [
  'string', 'number', 'boolean', 'date', 'object', 'array',
  'min', 'max', 'length', 'email', 'url', 'uuid', 'optional', 'nullable', 'default',
  'int', 'positive', 'negative', 'describe', 'enum', 'literal', 'tuple', 'union'
];

// A simple AST visitor with replacement capability
function visit(node: any, visitor: { [key: string]: (node: any, state?: any) => any }, state: any = {}) {
    if (!node) return node;

    for (const key in node) {
        if (key === 'parent') continue;
        const prop = node[key];
        if (Array.isArray(prop)) {
            const newProp = [];
            for (const child of prop) {
                if (child && typeof child.type === 'string') {
                    const newChild = visit(child, visitor, state);
                    if (newChild) {
                        newProp.push(newChild);
                    }
                } else {
                    newProp.push(child);
                }
            }
            node[key] = newProp;
        } else if (prop && typeof prop.type === 'string') {
            node[key] = visit(prop, visitor, state);
        }
    }

    let replacement = node;
    if (visitor[node.type]) {
        replacement = visitor[node.type](node, state);
    }

    return replacement;
}

export class ZontaxParser {
  private extensions = new Map<string, Extension>();

  constructor(initialExtensions: Extension[] = []) {
    for (const ext of initialExtensions) {
      this.register(ext);
    }
  }

  register(extension: Extension) {
    ExtensionMethodSchema.parse(extension); // This will throw if the extension is invalid
    this.extensions.set(extension.name, extension);
  }

  getRegisteredExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  parseZodSchema(source: string): string {
    const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
    const extensionNames = Array.from(this.extensions.keys());

    const transformedAst = visit(ast, {
      CallExpression: (node: any) => {
        if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
          const methodName = node.callee.property.name;
          if (extensionNames.includes(methodName)) {
            return node.callee.object; // Strip the extension method call
          }
          if (!KNOWN_ZOD_METHODS.includes(methodName) && !this.extensions.has(methodName)) {
            throw new Error(`Unrecognized method '.${methodName}()'. Please register it as an extension.`);
          }
        }
        return node;
      }
    });

    return escodegen.generate(transformedAst.body[0].expression);
  }

  private parseNode(node: any, options?: { categories?: string[] }): any {
    if (!node) return {};

    if (node.type === 'CallExpression') {
        let data: any = {};
        let current = node;
        while (current && current.type === 'CallExpression') {
            const callee = current.callee;
            if (callee.type === 'MemberExpression') {
                const methodName = callee.property.name;
                const args = current.arguments.map((arg: any) => this.parseNode(arg, options));
                const extension = this.extensions.get(methodName);

                if (extension) {
                    if (!options?.categories || options.categories.includes(extension.category)) {
                        const category = extension.category;
                        if (!data[category]) data[category] = {};
                        data[category][methodName] = args.length === 1 ? args[0] : args;
                    }
                } else if (['min', 'max', 'length', 'email', 'url', 'uuid'].includes(methodName)) {
                    if (!data.validations) data.validations = {};
                    data.validations[methodName] = args.length > 0 ? args[0] : true;
                } else if (['string', 'number', 'boolean', 'date'].includes(methodName)) {
                    data.type = methodName;
                } else if (methodName === 'optional') {
                    data.optional = true;
                } else if (methodName === 'object') {
                    data.type = 'object';
                    data.fields = args[0];
                } else if (methodName === 'array') {
                    data.type = 'array';
                    data.of = args[0];
                }
            }
            current = callee.object;
        }
        if (current.type === 'CallExpression') {
            const baseData = this.parseNode(current, options);
            data = {...baseData, ...data};
        }

        return data;
    }

    if (node.type === 'ObjectExpression') {
        const fields: any = {};
        for (const prop of node.properties) {
            fields[prop.key.name] = this.parseNode(prop.value, options);
        }
        return fields;
    }

    if (node.type === 'Literal') {
        return node.value;
    }
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'z') {
        return { type: node.property.name, validations: {} };
    }

    return escodegen.generate(node);
  }

  extractMetadata(source: string, options?: { categories?: string[] }): any {
    const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
    const startStatement = ast.body[0];
    if (startStatement.type !== 'ExpressionStatement') {
        throw new Error('Expected the Zontax string to start with an ExpressionStatement.');
    }
    return this.parseNode(startStatement.expression, options);
  }
}
