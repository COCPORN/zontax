import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import { z } from 'zod';

export class ZontaxMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZontaxMergeError';
  }
}

export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  description: z.string().optional(),
  allowedOnPath: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional()
});

export type Extension = z.infer<typeof ExtensionMethodSchema>;

export interface SchemaRegistrationObject {
  namespace?: string;
  extensions: Extension[];
}
export type SchemaRegistration = Extension[] | SchemaRegistrationObject;
export interface ZontaxParserOptions {
  mode?: 'strict' | 'loose';
  zodVersion?: '3' | '4';
}

const KNOWN_ZOD_METHODS = [
  'string', 'number', 'boolean', 'date', 'object', 'array',
  'min', 'max', 'length', 'email', 'url', 'uuid', 'optional', 'nullable', 'default',
  'int', 'positive', 'negative', 'describe', 'enum', 'literal', 'tuple', 'union'
];

export class ZontaxParser {
  private globalExtensions = new Map<string, Extension>();
  private namespacedExtensions = new Map<string, Map<string, Extension>>();
  private mode: 'strict' | 'loose';
  private zodVersion: '3' | '4';

  constructor(options: ZontaxParserOptions = {}, registrations: SchemaRegistration[] = []) {
    this.mode = options.mode || 'strict';
    this.zodVersion = options.zodVersion || '4';
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

  private buildDefinition(node: any, path: string[] = []): any {
    if (node.type === 'ExpressionStatement') {
      return this.buildDefinition(node.expression, path);
    }
    if (node.type === 'CallExpression') {
        let data: any = {};
        let current = node;
        while (current && current.type === 'CallExpression') {
            const callee = current.callee;
            if (callee.type === 'MemberExpression') {
                const methodName = callee.property.name;
                const args = current.arguments.map((arg: any) => this.buildDefinition(arg, path));
                const [namespace, extName] = methodName.includes('$') ? methodName.split('$') : [null, methodName];

                const extension = namespace
                    ? this.namespacedExtensions.get(namespace)?.get(extName)
                    : this.globalExtensions.get(extName);

                if (extension) {
                    if (extension.allowedOnPath) {
                        const currentPath = path.join('.');
                        const isAllowed = extension.allowedOnPath.some(pattern => {
                            if (typeof pattern === 'string') {
                                if (pattern.endsWith('.*')) {
                                    const base = pattern.slice(0, -2);
                                    return currentPath.startsWith(base) && currentPath.split('.').length === base.split('.').length + 1;
                                }
                                return pattern === currentPath;
                            } else if (pattern instanceof RegExp) {
                                return pattern.test(currentPath);
                            }
                            return false;
                        });
                        if (!isAllowed) {
                            throw new ZontaxMergeError(`Extension '${methodName}' is not allowed on path '${currentPath}'.`);
                        }
                    }
                    if (namespace) {
                        if (!data.namespaces) data.namespaces = {};
                        if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
                        data.namespaces[namespace][extName] = { value: args.length === 1 ? args[0] : args };
                    } else {
                        if (!data.extensions) data.extensions = {};
                        data.extensions[extName] = { value: args.length === 1 ? args[0] : args };
                    }
                } else if (KNOWN_ZOD_METHODS.includes(methodName)) {
                    if (['min', 'max', 'length', 'email', 'url', 'uuid', 'int', 'positive', 'negative'].includes(methodName)) {
                        if (!data.validations) data.validations = {};
                        data.validations[methodName] = args.length > 0 ? args[0] : true;
                    } else if (['string', 'number', 'boolean', 'date'].includes(methodName)) {
                        data.type = methodName;
                    } else if (methodName === 'optional') {
                        data.optional = true;
                    } else if (methodName === 'nullable') {
                        data.nullable = true;
                    } else if (methodName === 'default') {
                        data.defaultValue = args[0];
                    } else if (methodName === 'describe') {
                        data.description = args[0];
                    } else if (methodName === 'object') {
                        data.type = 'object';
                        data.fields = args[0].fields;
                    } else if (methodName === 'array') {
                        data.type = 'array';
                        data.of = args[0];
                    } else if (methodName === 'enum') {
                        data.type = 'enum';
                        // For enum, parse the array literal argument
                        const enumArg = current.arguments[0];
                        if (enumArg.type === 'ArrayExpression') {
                            data.values = enumArg.elements.map((elem: any) => this.buildDefinition(elem, path));
                        } else {
                            data.values = args[0];
                        }
                    } else if (methodName === 'literal') {
                        data.type = 'literal';
                        data.value = args[0];
                    } else if (methodName === 'tuple') {
                        data.type = 'tuple';
                        // For tuple, parse the array literal argument
                        const tupleArg = current.arguments[0];
                        if (tupleArg.type === 'ArrayExpression') {
                            data.items = tupleArg.elements.map((elem: any) => this.buildDefinition(elem, path));
                        } else {
                            data.items = args[0];
                        }
                    } else if (methodName === 'union') {
                        data.type = 'union';
                        // For union, parse the array literal argument
                        const unionArg = current.arguments[0];
                        if (unionArg.type === 'ArrayExpression') {
                            data.options = unionArg.elements.map((elem: any) => this.buildDefinition(elem, path));
                        } else {
                            data.options = args[0];
                        }
                    }
                } else if (this.mode === 'loose') {
                    if (namespace) {
                        if (!data.namespaces) data.namespaces = {};
                        if (!data.namespaces[namespace]) data.namespaces[namespace] = {};
                        data.namespaces[namespace][extName] = { value: args.length === 1 ? args[0] : args };
                    } else {
                        if (!data.extensions) data.extensions = {};
                        data.extensions[extName] = { value: args.length === 1 ? args[0] : args };
                    }
                } else {
                    throw new ZontaxMergeError(`Unrecognized method '.${methodName}()'.`);
                }
            }
            current = current.callee.object;
        }
        if (current && current.type === 'MemberExpression' && current.object.name === 'Z') {
            data.type = current.property.name;
        }
        return data;
    }
    if (node.type === 'ObjectExpression') {
        const fields: any = {};
        for (const prop of node.properties) {
            const key = prop.key.type === 'Literal' ? prop.key.value : prop.key.name;
            fields[key] = this.buildDefinition(prop.value, [...path, key]);
        }
        return { type: 'object', fields };
    }
    if (node.type === 'Literal') return node.value;
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'Z') {
        return { type: node.property.name };
    }
    return escodegen.generate(node);
  }

  private deepMergeDefinitions(defs: any[], path: string[] = []): any {
    if (defs.length === 0) return {};
    if (defs.length === 1) return defs[0];

    const base = JSON.parse(JSON.stringify(defs[0]));
    for (let i = 1; i < defs.length; i++) {
        const overlay = defs[i];
        const currentPath = path.join('.');

        if (base.type && overlay.type && base.type !== overlay.type) {
            throw new ZontaxMergeError(`Type mismatch at schema index ${i} for field '${currentPath}': Cannot merge type '${overlay.type}' into '${base.type}'.`);
        }
        if (overlay.fields) {
            if (!base.fields) base.fields = {};
            for (const fieldName in overlay.fields) {
                if (!base.fields[fieldName]) {
                    base.fields[fieldName] = overlay.fields[fieldName];
                } else {
                    base.fields[fieldName] = this.deepMergeDefinitions([base.fields[fieldName], overlay.fields[fieldName]], [...path, fieldName]);
                }
            }
        }
        if (overlay.validations) {
            if (!base.validations) base.validations = {};
            for (const key in overlay.validations) {
                if (base.validations[key] !== undefined && base.validations[key] !== overlay.validations[key]) {
                    throw new ZontaxMergeError(`Validation conflict at schema index ${i} for field '${currentPath}': Mismatch for validation '${key}'.`);
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

  private generateVersionSpecificMethod(method: string, args: string[] = []): string {
      // Handle version-specific method generation
      // Currently most methods are the same across versions
      const argStr = args.length > 0 ? `(${args.join(', ')})` : '()';
      return `z.${method}${argStr}`;
  }

  private generateSchemaString(def: any): string {
      if (!def || !def.type) return '';
      let chain = '';
      if (def.type === 'object') {
          const fieldsStr = Object.entries(def.fields || {}).map(([key, value]) => `${key}: ${this.generateSchemaString(value)}`).join(', ');
          chain = `z.object({ ${fieldsStr} })`;
      } else if (def.type === 'array') {
          chain = `z.array(${this.generateSchemaString(def.of)})`;
      } else if (def.type === 'enum') {
          const values = Array.isArray(def.values) ? def.values : [def.values];
          const valuesStr = values.map((v: any) => JSON.stringify(v)).join(', ');
          // Both Zod 3 and 4 support z.enum([...]) for string arrays
          chain = `z.enum([${valuesStr}])`;
      } else if (def.type === 'literal') {
          chain = `z.literal(${JSON.stringify(def.value)})`;
      } else if (def.type === 'tuple') {
          const itemsStr = Array.isArray(def.items) ? def.items.map((item: any) => this.generateSchemaString(item)).join(', ') : '';
          chain = `z.tuple([${itemsStr}])`;
      } else if (def.type === 'union') {
          const optionsStr = Array.isArray(def.options) ? def.options.map((option: any) => this.generateSchemaString(option)).join(', ') : '';
          chain = `z.union([${optionsStr}])`;
      } else {
          chain = `z.${def.type}()`;
      }
      
      if (def.validations) {
          for (const key in def.validations) {
              const value = def.validations[key];
              chain += `.${key}(${value === true ? '' : JSON.stringify(value)})`;
          }
      }
      if (def.description) {
          chain += `.describe(${JSON.stringify(def.description)})`;
      }
      if (def.defaultValue !== undefined) {
          chain += `.default(${JSON.stringify(def.defaultValue)})`;
      }
      if (def.nullable) {
          chain += '.nullable()';
      }
      if (def.optional) {
          chain += '.optional()';
      }
      return chain;
  }

  parse(...sources: string[]): { schema: string, definition: any } {
    if (sources.length === 0) {
      return { schema: '', definition: {} };
    }
    const definitions = sources.map(source => {
        // **NOTE:** This usage of `acorn.parse` is 100% secure, provided the 
        // parser is not used with `eval` or `new Function()`, which this
        // library does not do. It is parsed _only_ to do AST-walking,
        // which is secure. This is idiomatic and secure usage of acorn. 
        const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
        return this.buildDefinition(ast.body[0]);
    });

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
      ...namespaces
    };
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
