import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import { z, ZodType } from 'zod';

// As per the PRD
export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  outputGroup: z.string(),
  description: z.string().optional()
});

export type Extension = z.infer<typeof ExtensionMethodSchema>;

// Standard Zod methods that can be chained
const KNOWN_ZOD_METHODS = [
  'string', 'number', 'boolean', 'date', 'object', 'array',
  'min', 'max', 'length', 'email', 'url', 'uuid', 'optional', 'nullable', 'default'
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

  extractMetadata(source: string): any {
    const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
    const metadata: any = { type: 'object', fields: {} };

    visit(ast, {
      ObjectExpression: (node: any) => {
        for (const prop of node.properties) {
          const fieldName = prop.key.name;
          const fieldData: any = { validations: {}, ui: {} }; // Default groups

          let current = prop.value;
          while (current && current.type === 'CallExpression') {
            const callee = current.callee;
            if (callee.type === 'MemberExpression') {
              const methodName = callee.property.name;
              const args = current.arguments.map((arg: any) => arg.value);
              const extension = this.extensions.get(methodName);

              if (extension) {
                const group = extension.outputGroup;
                if (!fieldData[group]) {
                  fieldData[group] = {};
                }
                fieldData[group][methodName] = args.length === 1 ? args[0] : args;
              } else if (KNOWN_ZOD_METHODS.includes(methodName)) {
                 if (['min', 'max', 'length', 'email', 'url', 'uuid'].includes(methodName)) {
                    fieldData.validations[methodName] = args[0];
                } else if (['string', 'number', 'boolean', 'date'].includes(methodName)) {
                    fieldData.type = methodName;
                } else if (methodName === 'optional') {
                    fieldData.optional = true;
                }
              }
            }
            current = callee.object;
          }
          metadata.fields[fieldName] = fieldData;
        }
      }
    });

    return metadata;
  }
}
