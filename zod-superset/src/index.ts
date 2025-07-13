import * as acorn from 'acorn';
import * as escodegen from 'escodegen';
import { z, ZodType } from 'zod';

const SUPERSET_METHODS = ['label', 'placeholder', 'widget', 'group'];

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


export function parseZodSchema(source: string): string {
  const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });

  const transformedAst = visit(ast, {
    CallExpression(node: any) {
      if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
        const methodName = node.callee.property.name;
        if (SUPERSET_METHODS.includes(methodName)) {
          // Replace this node with the object it was called on, effectively removing it
          return node.callee.object;
        }
      }
      return node;
    }
  });

  // The AST comes wrapped in a Program and ExpressionStatement
  const zodCode = escodegen.generate(transformedAst.body[0].expression);
  return zodCode;
}

export function extractMetadata(source: string): any {
  const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });

  let metadata: any = {
    type: 'object',
    fields: {}
  };

  visit(ast, {
    ObjectExpression(node: any) {
      for (const prop of node.properties) {
        const fieldName = prop.key.name;
        const fieldData: any = {
          validations: {},
          ui: {}
        };

        let current = prop.value;
        while (current.type === 'CallExpression') {
          const callee = current.callee;
          if (callee.type === 'MemberExpression') {
            const methodName = callee.property.name;
            const args = current.arguments.map((arg: any) => arg.value);

            // Extract type
            if (methodName === 'string' || methodName === 'number' || methodName === 'boolean' || methodName === 'date') {
              fieldData.type = methodName;
            } else if (methodName === 'optional') {
              fieldData.optional = true;
            }
            // Extract validations
            else if (['min', 'max', 'length', 'email', 'url', 'uuid'].includes(methodName)) {
              fieldData.validations[methodName] = args[0];
            }
            // Extract UI metadata
            else if (['label', 'placeholder', 'widget', 'group'].includes(methodName)) {
              fieldData.ui[methodName] = args[0];
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
