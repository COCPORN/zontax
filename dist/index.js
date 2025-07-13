"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZontaxParser = exports.ExtensionMethodSchema = void 0;
const acorn = __importStar(require("acorn"));
const escodegen = __importStar(require("escodegen"));
const zod_1 = require("zod");
// As per the PRD
exports.ExtensionMethodSchema = zod_1.z.object({
    name: zod_1.z.string(),
    allowedOn: zod_1.z.array(zod_1.z.string()),
    args: zod_1.z.array(zod_1.z.string()),
    category: zod_1.z.string(),
    description: zod_1.z.string().optional()
});
// Standard Zod methods that can be chained
const KNOWN_ZOD_METHODS = [
    'string', 'number', 'boolean', 'date', 'object', 'array',
    'min', 'max', 'length', 'email', 'url', 'uuid', 'optional', 'nullable', 'default',
    'int', 'positive', 'negative', 'describe', 'enum', 'literal', 'tuple', 'union'
];
// A simple AST visitor with replacement capability
function visit(node, visitor, state = {}) {
    if (!node)
        return node;
    for (const key in node) {
        if (key === 'parent')
            continue;
        const prop = node[key];
        if (Array.isArray(prop)) {
            const newProp = [];
            for (const child of prop) {
                if (child && typeof child.type === 'string') {
                    const newChild = visit(child, visitor, state);
                    if (newChild) {
                        newProp.push(newChild);
                    }
                }
                else {
                    newProp.push(child);
                }
            }
            node[key] = newProp;
        }
        else if (prop && typeof prop.type === 'string') {
            node[key] = visit(prop, visitor, state);
        }
    }
    let replacement = node;
    if (visitor[node.type]) {
        replacement = visitor[node.type](node, state);
    }
    return replacement;
}
class ZontaxParser {
    constructor(initialExtensions = []) {
        this.extensions = new Map();
        for (const ext of initialExtensions) {
            this.register(ext);
        }
    }
    register(extension) {
        exports.ExtensionMethodSchema.parse(extension); // This will throw if the extension is invalid
        this.extensions.set(extension.name, extension);
    }
    getRegisteredExtensions() {
        return Array.from(this.extensions.values());
    }
    parseZodSchema(source) {
        const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
        const extensionNames = Array.from(this.extensions.keys());
        const transformedAst = visit(ast, {
            CallExpression: (node) => {
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
    parseNode(node, options) {
        if (!node)
            return {};
        if (node.type === 'CallExpression') {
            let data = {};
            let current = node;
            while (current && current.type === 'CallExpression') {
                const callee = current.callee;
                if (callee.type === 'MemberExpression') {
                    const methodName = callee.property.name;
                    const args = current.arguments.map((arg) => this.parseNode(arg, options));
                    const extension = this.extensions.get(methodName);
                    if (extension) {
                        if (!(options === null || options === void 0 ? void 0 : options.categories) || options.categories.includes(extension.category)) {
                            const category = extension.category;
                            if (!data[category])
                                data[category] = {};
                            data[category][methodName] = args.length === 1 ? args[0] : args;
                        }
                    }
                    else if (['min', 'max', 'length', 'email', 'url', 'uuid'].includes(methodName)) {
                        if (!data.validations)
                            data.validations = {};
                        data.validations[methodName] = args.length > 0 ? args[0] : true;
                    }
                    else if (['string', 'number', 'boolean', 'date'].includes(methodName)) {
                        data.type = methodName;
                    }
                    else if (methodName === 'optional') {
                        data.optional = true;
                    }
                    else if (methodName === 'object') {
                        data.type = 'object';
                        data.fields = args[0];
                    }
                    else if (methodName === 'array') {
                        data.type = 'array';
                        data.of = args[0];
                    }
                }
                current = callee.object;
            }
            if (current.type === 'CallExpression') {
                const baseData = this.parseNode(current, options);
                data = Object.assign(Object.assign({}, baseData), data);
            }
            return data;
        }
        if (node.type === 'ObjectExpression') {
            const fields = {};
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
    extractMetadata(source, options) {
        const ast = acorn.parse(source, { ecmaVersion: 2020, locations: true });
        const startStatement = ast.body[0];
        if (startStatement.type !== 'ExpressionStatement') {
            throw new Error('Expected the Zontax string to start with an ExpressionStatement.');
        }
        return this.parseNode(startStatement.expression, options);
    }
}
exports.ZontaxParser = ZontaxParser;
