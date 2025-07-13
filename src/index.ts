import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import { z } from 'zod';

// --- NEW: Simplified, Category-less Schema ---
export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  description: z.string().optional()
});

export type Extension = z.infer<typeof ExtensionMethodSchema>;

interface SchemaRegistrationObject {
  namespace?: string;
  extensions: Extension[];
}
type SchemaRegistration = Extension[] | SchemaRegistrationObject;
interface ZontaxParserOptions {
  mode?: 'strict' | 'loose';
}

const KNOWN_ZOD_METHODS = [
  'string', 'number', 'boolean', 'date', 'object', 'array',
  'min', 'max', 'length', 'email', 'url', 'uuid', 'optional', 'nullable', 'default',
  'int', 'positive', 'negative', 'describe', 'enum', 'literal', 'tuple', 'union'
];

function visit(node: any, visitor: { [key: string]: (node: any) => any }) {
    if (!node) return node;
    for (const key in node) {
        if (key === 'parent') continue;
        const prop = node[key];
        if (Array.isArray(prop)) {
            node[key] = prop.map(child => visit(child, visitor)).filter(Boolean);
        } else if (prop && typeof prop.type === 'string') {
            node[key] = visit(prop, visitor);
        }
    }
    return visitor[node.type] ? visitor[node.type](node) : node;
}

export class ZontaxParser {
  private globalExtensions = new Map<string, Extension>();
  private namespacedExtensions = new Map<string, Map<string, Extension>>();
  private mode: 'strict' | 'loose';

  constructor(registrations: SchemaRegistration[] = [], options: ZontaxParserOptions = {}) {
    this.mode = options.mode || 'strict';
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
      nsMap.set(ext.name, ext);
    }
  }

  private buildDefinition(node: any): any {
    if (node.type === 'ExpressionStatement') {
      return this.buildDefinition(node.expression);
    }
    if (node.type === 'CallExpression') {
      let data: any = { extensions: {}, namespaces: {} };
      let current = node;
      while (current && current.type === 'CallExpression') {
        const callee = current.callee;
        if (callee.type === 'MemberExpression') {
          const methodName = callee.property.name;
          const args = current.arguments.map((arg: any) => this.buildDefinition(arg));
          const [namespace, extName] = methodName.includes('$') ? methodName.split('$') : [null, methodName];

          const isRegistered = namespace 
            ? this.namespacedExtensions.get(namespace)?.has(extName)
            : this.globalExtensions.has(extName);

          if (isRegistered) {
            const value = { value: args.length === 1 ? args[0] : args };
            if (namespace) {
              if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
              data.namespaces[namespace][extName] = value;
            } else {
              data.extensions[extName] = value;
            }
          } else if (KNOWN_ZOD_METHODS.includes(methodName)) {
            if (['min', 'max', 'length', 'email', 'url', 'uuid'].includes(methodName)) {
              if (!data.validations) data.validations = {};
              data.validations[methodName] = args.length > 0 ? args[0] : true;
            } else if (['string', 'number', 'boolean', 'date'].includes(methodName)) {
              data.type = methodName;
            } else if (methodName === 'optional') {
              data.optional = true;
            } else if (methodName === 'object') {
              data.type = 'object';
              data.fields = args[0].fields;
            } else if (methodName === 'array') {
              data.type = 'array';
              data.of = args[0];
            }
          } else if (this.mode === 'loose') {
            const value = { value: args.length === 1 ? args[0] : args };
             if (namespace) {
                if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
                data.namespaces[namespace][extName] = value;
            } else {
                data.extensions[extName] = value;
            }
          }
        }
        current = current.callee.object;
      }
      
      if (current && current.type === 'MemberExpression' && current.object.name === 'z') {
          data.type = current.property.name;
      }

      if (Object.keys(data.extensions).length === 0) delete data.extensions;
      if (Object.keys(data.namespaces).length === 0) delete data.namespaces;
      return data;
    }
    if (node.type === 'ObjectExpression') {
      const fields: any = {};
      for (const prop of node.properties) {
        fields[prop.key.name] = this.buildDefinition(prop.value);
      }
      return { type: 'object', fields };
    }
    if (node.type === 'Literal') return node.value;
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'z') {
      return { type: node.property.name };
    }
    return escodegen.generate(node);
  }

  parse(source: string) {
    const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
    const definition = this.buildDefinition(ast.body[0]);

    const transformedAst = visit(JSON.parse(JSON.stringify(ast)), {
      CallExpression: (node: any) => {
        if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
          const methodName = node.callee.property.name;
          const [namespace, extName] = methodName.includes('$') ? methodName.split('$') : [null, methodName];
          
          let isRegisteredExtension = false;
          if (namespace) {
            isRegisteredExtension = this.namespacedExtensions.has(namespace) && this.namespacedExtensions.get(namespace)!.has(extName);
          } else {
            isRegisteredExtension = this.globalExtensions.has(extName);
          }

          if (isRegisteredExtension) {
            return node.callee.object;
          }
          
          const isKnownZod = KNOWN_ZOD_METHODS.includes(methodName);
          if (!isKnownZod) {
            if (this.mode === 'strict') {
              throw new Error(`Unrecognized method '.${methodName}()'.`);
            } else { // loose mode
              return node.callee.object;
            }
          }
        }
        return node;
      }
    });

    const schema = escodegen.generate(transformedAst.body[0].expression);
    return { schema, definition };
  }

  public static getDefinitionByNamespace(definition: any, namespace: string): Record<string, any> {
    const byNamespace: Record<string, any> = {};
    if (!definition || !definition.fields) return byNamespace;

    for (const fieldName in definition.fields) {
        const field = definition.fields[fieldName];
        if (field.namespaces && field.namespaces[namespace]) {
            byNamespace[fieldName] = {
                ...field,
                namespaces: {
                    [namespace]: field.namespaces[namespace]
                }
            };
        }
    }
    return byNamespace;
  }

  public static generateSchemaFromDefinition(definition: any, namespace?: string): Extension[] {
    const extensions: Extension[] = [];
    if (!definition || !definition.fields) return extensions;

    const seen = new Set<string>();

    for (const fieldName in definition.fields) {
        const field = definition.fields[fieldName];
        const process = (exts: any, ns?: string) => {
            if (!exts) return;
            for (const extName in exts) {
                const key = ns ? `${ns}$${extName}` : extName;
                if (seen.has(key)) continue;
                
                const extValue = exts[extName].value;
                const args = Array.isArray(extValue) ? extValue.map(v => typeof v) : [typeof extValue];

                extensions.push({
                    name: extName,
                    allowedOn: [field.type], // A starting point
                    args: args,
                });
                seen.add(key);
            }
        }
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