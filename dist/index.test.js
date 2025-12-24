"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const { parseZodString } = require('zod-subset-parser/zod4');
// --- Test Data (Category-less) ---
const uiSchema = [
    { name: 'label', allowedOn: ['string'], args: ['string'] },
    { name: 'placeholder', allowedOn: ['string'], args: ['string'] },
];
const docSchema = [
    { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'] },
];
const globalSchema = [
    { name: 'analyticsId', allowedOn: ['string'], args: ['string'] },
];
describe('ZontaxParser', () => {
    describe('Initialization', () => {
        it('should register global extensions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({}, [globalSchema]);
            const { schema } = yield parser.parse('Z.string().analyticsId("test")');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should register namespaced extensions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({}, [{ namespace: 'ui', extensions: uiSchema }]);
            const { schema } = yield parser.parse('Z.string().ui$label("Name")');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
    });
    describe('Composition (Multi-Schema Parsing)', () => {
        const parser = new index_1.ZontaxParser({}, [
            { namespace: 'ui', extensions: uiSchema },
            { namespace: 'doc', extensions: docSchema },
        ]);
        it('should merge more than two schemas and produce a valid final schema', () => __awaiter(void 0, void 0, void 0, function* () {
            const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
            const s2 = `Z.object({ user: Z.object({ name: Z.string().min(3) }) })`;
            const s3 = `Z.object({ user: Z.object({ name: Z.string().max(10) }) })`;
            const s4 = `Z.object({ user: Z.object({ name: Z.string().ui$label("Name") }) })`;
            const { definition, schema } = yield parser.parse(s1, s2, s3, s4);
            const objDef = definition;
            const userDef = objDef.fields.user;
            const nameDef = userDef.fields.name;
            expect(nameDef.validations.min).toBe(3);
            expect(nameDef.validations.max).toBe(10);
            expect(nameDef.namespaces.ui.label.value).toBe("Name");
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should throw a detailed error on type mismatch', () => __awaiter(void 0, void 0, void 0, function* () {
            const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
            const s2 = `Z.object({ user: Z.object({ name: Z.number() }) })`;
            const expectedError = "Type mismatch at schema index 1 for field 'user.name': Cannot merge type 'number' into 'string'.";
            yield expect(parser.parse(s1, s2)).rejects.toThrow(new index_1.ZontaxMergeError(expectedError));
        }));
        it('should throw a detailed error on validation conflict', () => __awaiter(void 0, void 0, void 0, function* () {
            const s1 = `Z.object({ name: Z.string().min(3) })`;
            const s2 = `Z.object({ name: Z.string().min(4) })`;
            const expectedError = "Validation conflict at schema index 1 for field 'name': Mismatch for validation 'min'.";
            yield expect(parser.parse(s1, s2)).rejects.toThrow(new index_1.ZontaxMergeError(expectedError));
        }));
    });
    describe('Zod Method Support', () => {
        const parser = new index_1.ZontaxParser();
        it('should support .describe() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.string().describe("A user name")');
            expect(schema).toBe('z.string().describe("A user name")');
            expect(definition.description).toBe('A user name');
            expect(definition.type).toBe('string');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .describe() with other methods', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.string().min(3).describe("Username").optional()');
            expect(schema).toBe('z.string().min(3).describe("Username").optional()');
            expect(definition.description).toBe('Username');
            expect(definition.validations.min).toBe(3);
            expect(definition.optional).toBe(true);
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .describe() in object fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.object({name: Z.string().describe("User full name")})');
            expect(schema).toBe('z.object({ name: z.string().describe("User full name") })');
            expect(definition.fields.name.description).toBe('User full name');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .describe() with validations', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.number().min(0).max(100).describe("Percentage value")');
            expect(schema).toBe('z.number().max(100).min(0).describe("Percentage value")');
            expect(definition.description).toBe('Percentage value');
            expect(definition.validations.min).toBe(0);
            expect(definition.validations.max).toBe(100);
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .nullable() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.string().nullable()');
            expect(schema).toBe('z.string().nullable()');
            expect(definition.nullable).toBe(true);
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .default() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.string().default("test")');
            expect(schema).toBe('z.string().default("test")');
            expect(definition.defaultValue).toBe('test');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support number validations (int, positive, negative)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema: intSchema } = yield parser.parse('Z.number().int()');
            expect(intSchema).toBe('z.number().int()');
            expect(() => parseZodString(intSchema)).not.toThrow();
            const { schema: positiveSchema } = yield parser.parse('Z.number().positive()');
            expect(positiveSchema).toBe('z.number().positive()');
            expect(() => parseZodString(positiveSchema)).not.toThrow();
            const { schema: negativeSchema } = yield parser.parse('Z.number().negative()');
            expect(negativeSchema).toBe('z.number().negative()');
            expect(() => parseZodString(negativeSchema)).not.toThrow();
        }));
        it('should support negative number literals in min/max constraints', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema: minNegative, definition: minDef } = yield parser.parse('Z.number().min(-10)');
            expect(minNegative).toBe('z.number().min(-10)');
            expect(minDef.validations.min).toBe(-10);
            // Note: parseZodString from zod-subset-parser doesn't support negative number literals
            // but the generated schema is correct for actual Zod usage
            const { schema: rangeNegative, definition: rangeDef } = yield parser.parse('Z.number().min(-100).max(100)');
            expect(rangeNegative).toBe('z.number().max(100).min(-100)');
            expect(rangeDef.validations.min).toBe(-100);
            expect(rangeDef.validations.max).toBe(100);
            const { schema: complexNegative, definition } = yield parser.parse('Z.object({ score: Z.number().min(-10).max(10) })');
            expect(complexNegative).toBe('z.object({ score: z.number().max(10).min(-10) })');
            const objDef = definition;
            expect(objDef.fields.score.validations.min).toBe(-10);
            expect(objDef.fields.score.validations.max).toBe(10);
            // Test with actual Zod to ensure the generated schema works
            const { z } = require('zod');
            const testSchema = eval(minNegative); // z.number().min(-10)
            expect(testSchema.safeParse(-11).success).toBe(false);
            expect(testSchema.safeParse(-10).success).toBe(true);
            expect(testSchema.safeParse(0).success).toBe(true);
        }));
        it('should support .enum() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.enum(["a", "b", "c"])');
            expect(schema).toBe('z.enum(["a", "b", "c"])');
            expect(definition.type).toBe('enum');
            expect(definition.values).toEqual(['a', 'b', 'c']);
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .literal() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.literal("test")');
            expect(schema).toBe('z.literal("test")');
            expect(definition.type).toBe('literal');
            expect(definition.value).toBe('test');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .tuple() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.tuple([Z.string(), Z.number()])');
            expect(schema).toBe('z.tuple([z.string(), z.number()])');
            expect(definition.type).toBe('tuple');
            const tupleDef = definition;
            expect(tupleDef.items).toHaveLength(2);
            expect(tupleDef.items[0].type).toBe('string');
            expect(tupleDef.items[1].type).toBe('number');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .union() method', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.union([Z.string(), Z.number()])');
            expect(schema).toBe('z.union([z.string(), z.number()])');
            expect(definition.type).toBe('union');
            const unionDef = definition;
            expect(unionDef.options).toHaveLength(2);
            expect(unionDef.options[0].type).toBe('string');
            expect(unionDef.options[1].type).toBe('number');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .record() method with string keys', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.record(Z.string(), Z.number())');
            expect(schema).toBe('z.record(z.string(), z.number())');
            expect(definition.type).toBe('record');
            const recordDef = definition;
            expect(recordDef.keySchema.type).toBe('string');
            expect(recordDef.valueSchema.type).toBe('number');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support .record() method with enum keys', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.record(Z.enum(["admin", "user"]), Z.boolean())');
            expect(schema).toBe('z.record(z.enum(["admin", "user"]), z.boolean())');
            expect(definition.type).toBe('record');
            const recordDef = definition;
            expect(recordDef.keySchema.type).toBe('enum');
            expect(recordDef.keySchema.values).toEqual(['admin', 'user']);
            expect(recordDef.valueSchema.type).toBe('boolean');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support complex .record() with nested objects', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.record(Z.string(), Z.object({ name: Z.string(), age: Z.number() }))');
            expect(schema).toBe('z.record(z.string(), z.object({ name: z.string(), age: z.number() }))');
            expect(definition.type).toBe('record');
            const recordDef = definition;
            expect(recordDef.keySchema.type).toBe('string');
            expect(recordDef.valueSchema.type).toBe('object');
            const valueDef = recordDef.valueSchema;
            expect(valueDef.fields.name.type).toBe('string');
            expect(valueDef.fields.age.type).toBe('number');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support complex method chaining', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema, definition } = yield parser.parse('Z.string().min(3).max(10).optional().nullable().describe("Name")');
            expect(schema).toBe('z.string().max(10).min(3).describe("Name").nullable().optional()');
            expect(definition.validations.min).toBe(3);
            expect(definition.validations.max).toBe(10);
            expect(definition.optional).toBe(true);
            expect(definition.nullable).toBe(true);
            expect(definition.description).toBe('Name');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
        it('should support complex nested structures', () => __awaiter(void 0, void 0, void 0, function* () {
            const { schema } = yield parser.parse('Z.union([Z.string().email(), Z.literal("admin")])');
            expect(schema).toBe('z.union([z.string().email(), z.literal("admin")])');
            expect(() => parseZodString(schema)).not.toThrow();
        }));
    });
    describe('Zod Version Support', () => {
        it('should default to Zod 4', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser();
            const { schema } = yield parser.parse('Z.string().describe("test")');
            expect(schema).toBe('z.string().describe("test")');
        }));
        it('should support explicit Zod 4', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({ zodVersion: '4' });
            const { schema } = yield parser.parse('Z.string().describe("test")');
            expect(schema).toBe('z.string().describe("test")');
        }));
        it('should support explicit Zod 3', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({ zodVersion: '3' });
            const { schema } = yield parser.parse('Z.string().describe("test")');
            expect(schema).toBe('z.string().describe("test")');
        }));
        it('should generate identical output for basic types in both versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser3 = new index_1.ZontaxParser({ zodVersion: '3' });
            const parser4 = new index_1.ZontaxParser({ zodVersion: '4' });
            const basicTypes = [
                'Z.string()',
                'Z.number()',
                'Z.boolean()',
                'Z.date()',
                'Z.string().min(5)',
                'Z.string().max(10)',
                'Z.string().optional()',
                'Z.string().nullable()',
                'Z.string().default("test")',
                'Z.number().int()',
                'Z.number().positive()',
                'Z.number().negative()'
            ];
            for (const input of basicTypes) {
                const result3 = yield parser3.parse(input);
                const result4 = yield parser4.parse(input);
                expect(result3.schema).toBe(result4.schema);
            }
        }));
        it('should generate identical output for complex types in both versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser3 = new index_1.ZontaxParser({ zodVersion: '3' });
            const parser4 = new index_1.ZontaxParser({ zodVersion: '4' });
            const complexTypes = [
                'Z.object({name: Z.string()})',
                'Z.array(Z.string())',
                'Z.enum(["a", "b", "c"])',
                'Z.literal("test")',
                'Z.tuple([Z.string(), Z.number()])',
                'Z.union([Z.string(), Z.number()])'
            ];
            for (const input of complexTypes) {
                const result3 = yield parser3.parse(input);
                const result4 = yield parser4.parse(input);
                expect(result3.schema).toBe(result4.schema);
            }
        }));
        it('should generate identical output for method chaining in both versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser3 = new index_1.ZontaxParser({ zodVersion: '3' });
            const parser4 = new index_1.ZontaxParser({ zodVersion: '4' });
            const chainedMethods = [
                'Z.string().min(3).max(10).optional()',
                'Z.string().email().describe("Email address")',
                'Z.number().int().positive().default(1)',
                'Z.string().min(1).nullable().describe("Name")'
            ];
            for (const input of chainedMethods) {
                const result3 = yield parser3.parse(input);
                const result4 = yield parser4.parse(input);
                expect(result3.schema).toBe(result4.schema);
            }
        }));
        it('should work with extensions in both versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const extensions = [{ name: 'label', allowedOn: ['string'], args: ['string'] }];
            const parser3 = new index_1.ZontaxParser({ zodVersion: '3' }, [extensions]);
            const parser4 = new index_1.ZontaxParser({ zodVersion: '4' }, [extensions]);
            const input = 'Z.string().label("Name")';
            const result3 = yield parser3.parse(input);
            const result4 = yield parser4.parse(input);
            expect(result3.schema).toBe('z.string()');
            expect(result4.schema).toBe('z.string()');
            expect(result3.schema).toBe(result4.schema);
        }));
        it('should handle nested structures in both versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser3 = new index_1.ZontaxParser({ zodVersion: '3' });
            const parser4 = new index_1.ZontaxParser({ zodVersion: '4' });
            const input = 'Z.object({user: Z.object({name: Z.string().min(1), age: Z.number().int()})})';
            const result3 = yield parser3.parse(input);
            const result4 = yield parser4.parse(input);
            expect(result3.schema).toBe(result4.schema);
            expect(result3.schema).toBe('z.object({ user: z.object({ name: z.string().min(1), age: z.number().int() }) })');
        }));
    });
    describe('Modes (Strict vs. Loose)', () => {
        it('should throw in strict mode for unregistered methods', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({ mode: 'strict' });
            yield expect(parser.parse('Z.string().unregistered()')).rejects.toThrow();
        }));
        it('should capture loose methods and produce a valid schema', () => __awaiter(void 0, void 0, void 0, function* () {
            const parser = new index_1.ZontaxParser({ mode: 'loose' });
            const { definition, schema } = yield parser.parse('Z.string().author("John").meta$version(2)');
            expect(definition.extensions.author.value).toBe('John');
            expect(definition.namespaces.meta.version.value).toBe(2);
            expect(() => parseZodString(schema)).not.toThrow();
        }));
    });
    describe('Introspection', () => {
        it('should return a map of all registered extensions', () => {
            const parser = new index_1.ZontaxParser({}, [
                globalSchema,
                { namespace: 'ui', extensions: uiSchema }
            ]);
            const registrations = parser.getExtensions();
            expect(Object.keys(registrations)).toEqual(['_global', 'ui']);
            expect(registrations._global).toHaveLength(1);
            expect(registrations.ui).toHaveLength(2);
            expect(registrations._global[0].name).toBe('analyticsId');
            expect(registrations.ui.find(e => e.name === 'label')).toBeDefined();
        });
    });
    describe('Static Helpers', () => {
        const parser = new index_1.ZontaxParser({}, [
            { namespace: 'ui', extensions: uiSchema },
            { namespace: 'doc', extensions: docSchema },
        ]);
        let definition;
        beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield parser.parse(`
            Z.object({
                name: Z.string().ui$label("Name").doc$internalDoc("Doc"),
                age: Z.number().ui$placeholder("Age")
            })
        `);
            definition = result.definition;
        }));
        describe('getDefinitionByNamespace', () => {
            it('should return a map of fields filtered by a single namespace', () => {
                const uiView = index_1.ZontaxParser.getDefinitionByNamespace(definition, 'ui');
                expect(Object.keys(uiView)).toEqual(['name', 'age']);
                expect(uiView.name.namespaces.ui.label).toBeDefined();
                expect(uiView.name.namespaces.doc).toBeUndefined(); // Ensure other namespaces are excluded
            });
        });
        describe('generateSchemaFromDefinition', () => {
            const looseParser = new index_1.ZontaxParser({ mode: 'loose' });
            let looseDef;
            beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield looseParser.parse(`Z.object({ name: Z.string().ui$label("Name") })`);
                looseDef = result.definition;
            }));
            it('should generate a schema for a specific namespace', () => {
                const generated = index_1.ZontaxParser.generateSchemaFromDefinition(looseDef, 'ui');
                expect(generated).toHaveLength(1);
                expect(generated[0].name).toBe('label');
            });
        });
    });
    describe('Template Literal Support', () => {
        const parser = new index_1.ZontaxParser({ mode: 'loose' });
        it('should support simple template literals (backtick strings)', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = 'Z.object({ greeting: Z.literal(`Hello World`) })';
            const result = yield parser.parse(schema);
            const objDef = result.definition;
            const greetingDef = objDef.fields.greeting;
            expect(greetingDef.type).toBe('literal');
            expect(greetingDef.value).toBe('Hello World');
        }));
        it('should support multi-line template literals', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = 'Z.object({ message: Z.literal(`Line 1\nLine 2\nLine 3`) })';
            const result = yield parser.parse(schema);
            const objDef = result.definition;
            const messageDef = objDef.fields.message;
            expect(messageDef.type).toBe('literal');
            expect(messageDef.value).toBe('Line 1\nLine 2\nLine 3');
        }));
        it('should support template literals with special characters', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = 'Z.object({ prompt: Z.literal(`Use "quotes" and \'apostrophes\'`) })';
            const result = yield parser.parse(schema);
            const objDef = result.definition;
            const promptDef = objDef.fields.prompt;
            expect(promptDef.type).toBe('literal');
            expect(promptDef.value).toBe(`Use "quotes" and 'apostrophes'`);
        }));
        it('should reject template literals with interpolation', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = 'Z.object({ bad: Z.literal(`Hello ${name}`) })';
            yield expect(parser.parse(schema)).rejects.toThrow('interpolation');
        }));
    });
    describe('allowedOnPath Validation', () => {
        const pathSchema = [
            {
                name: 'restricted',
                allowedOn: ['string'],
                args: [],
                allowedOnPath: ['user.name', 'user.profile.*', /^user\.address\.(street|city)$/]
            }
        ];
        const parser = new index_1.ZontaxParser({}, [{ namespace: 'test', extensions: pathSchema }]);
        it('should allow extension on an exact path match', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = `Z.object({ user: Z.object({ name: Z.string().test$restricted() }) })`;
            yield expect(parser.parse(schema)).resolves.not.toThrow();
        }));
        it('should allow extension on a wildcard path match', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = `Z.object({ user: Z.object({ profile: Z.object({ bio: Z.string().test$restricted() }) }) })`;
            yield expect(parser.parse(schema)).resolves.not.toThrow();
        }));
        it('should allow extension on a regex path match', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema1 = `Z.object({ user: Z.object({ address: Z.object({ street: Z.string().test$restricted() }) }) })`;
            const schema2 = `Z.object({ user: Z.object({ address: Z.object({ city: Z.string().test$restricted() }) }) })`;
            yield expect(parser.parse(schema1)).resolves.not.toThrow();
            yield expect(parser.parse(schema2)).resolves.not.toThrow();
        }));
        it('should throw an error for a disallowed path', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = `Z.object({ user: Z.object({ email: Z.string().test$restricted() }) })`;
            yield expect(parser.parse(schema)).rejects.toThrow(index_1.ZontaxMergeError);
            yield expect(parser.parse(schema)).rejects.toThrow("Extension 'test$restricted' is not allowed on path 'user.email'.");
        }));
        it('should throw an error for a disallowed regex path', () => __awaiter(void 0, void 0, void 0, function* () {
            const schema = `Z.object({ user: Z.object({ address: Z.object({ country: Z.string().test$restricted() }) }) })`;
            yield expect(parser.parse(schema)).rejects.toThrow("Extension 'test$restricted' is not allowed on path 'user.address.country'.");
        }));
    });
});
