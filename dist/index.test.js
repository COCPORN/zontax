"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const zod_subset_parser_1 = require("zod-subset-parser");
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
        it('should register global extensions', () => {
            const parser = new index_1.ZontaxParser([globalSchema]);
            const { schema } = parser.parse('Z.string().analyticsId("test")');
            expect(() => (0, zod_subset_parser_1.parseZodString)(schema)).not.toThrow();
        });
        it('should register namespaced extensions', () => {
            const parser = new index_1.ZontaxParser([{ namespace: 'ui', extensions: uiSchema }]);
            const { schema } = parser.parse('Z.string().ui$label("Name")');
            expect(() => (0, zod_subset_parser_1.parseZodString)(schema)).not.toThrow();
        });
    });
    describe('Composition (Multi-Schema Parsing)', () => {
        const parser = new index_1.ZontaxParser([
            { namespace: 'ui', extensions: uiSchema },
            { namespace: 'doc', extensions: docSchema },
        ]);
        it('should merge more than two schemas and produce a valid final schema', () => {
            const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
            const s2 = `Z.object({ user: Z.object({ name: Z.string().min(3) }) })`;
            const s3 = `Z.object({ user: Z.object({ name: Z.string().max(10) }) })`;
            const s4 = `Z.object({ user: Z.object({ name: Z.string().ui$label("Name") }) })`;
            const { definition, schema } = parser.parse(s1, s2, s3, s4);
            const nameDef = definition.fields.user.fields.name;
            expect(nameDef.validations.min).toBe(3);
            expect(nameDef.validations.max).toBe(10);
            expect(nameDef.namespaces.ui.label.value).toBe("Name");
            expect(() => (0, zod_subset_parser_1.parseZodString)(schema)).not.toThrow();
        });
        it('should throw a detailed error on type mismatch', () => {
            const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
            const s2 = `Z.object({ user: Z.object({ name: Z.number() }) })`;
            const expectedError = "Type mismatch at schema index 1 for field 'user.name': Cannot merge type 'number' into 'string'.";
            expect(() => parser.parse(s1, s2)).toThrow(new index_1.ZontaxMergeError(expectedError));
        });
        it('should throw a detailed error on validation conflict', () => {
            const s1 = `Z.object({ name: Z.string().min(3) })`;
            const s2 = `Z.object({ name: Z.string().min(4) })`;
            const expectedError = "Validation conflict at schema index 1 for field 'name': Mismatch for validation 'min'.";
            expect(() => parser.parse(s1, s2)).toThrow(new index_1.ZontaxMergeError(expectedError));
        });
    });
    describe('Modes (Strict vs. Loose)', () => {
        it('should throw in strict mode for unregistered methods', () => {
            const parser = new index_1.ZontaxParser([], { mode: 'strict' });
            expect(() => parser.parse('Z.string().unregistered()')).toThrow();
        });
        it('should capture loose methods and produce a valid schema', () => {
            const parser = new index_1.ZontaxParser([], { mode: 'loose' });
            const { definition, schema } = parser.parse('Z.string().author("John").meta$version(2)');
            expect(definition.extensions.author.value).toBe('John');
            expect(definition.namespaces.meta.version.value).toBe(2);
            expect(() => (0, zod_subset_parser_1.parseZodString)(schema)).not.toThrow();
        });
    });
    describe('Introspection', () => {
        it('should return a map of all registered extensions', () => {
            const parser = new index_1.ZontaxParser([
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
        const parser = new index_1.ZontaxParser([
            { namespace: 'ui', extensions: uiSchema },
            { namespace: 'doc', extensions: docSchema },
        ]);
        const { definition } = parser.parse(`
        Z.object({
            name: Z.string().ui$label("Name").doc$internalDoc("Doc"),
            age: Z.number().ui$placeholder("Age")
        })
    `);
        describe('getDefinitionByNamespace', () => {
            it('should return a map of fields filtered by a single namespace', () => {
                const uiView = index_1.ZontaxParser.getDefinitionByNamespace(definition, 'ui');
                expect(Object.keys(uiView)).toEqual(['name', 'age']);
                expect(uiView.name.namespaces.ui.label).toBeDefined();
                expect(uiView.name.namespaces.doc).toBeUndefined(); // Ensure other namespaces are excluded
            });
        });
        describe('generateSchemaFromDefinition', () => {
            const looseParser = new index_1.ZontaxParser([], { mode: 'loose' });
            const looseDef = looseParser.parse(`Z.object({ name: Z.string().ui$label("Name") })`).definition;
            it('should generate a schema for a specific namespace', () => {
                const generated = index_1.ZontaxParser.generateSchemaFromDefinition(looseDef, 'ui');
                expect(generated).toHaveLength(1);
                expect(generated[0].name).toBe('label');
            });
        });
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
        const parser = new index_1.ZontaxParser([{ namespace: 'test', extensions: pathSchema }]);
        it('should allow extension on an exact path match', () => {
            const schema = `Z.object({ user: Z.object({ name: Z.string().test$restricted() }) })`;
            expect(() => parser.parse(schema)).not.toThrow();
        });
        it('should allow extension on a wildcard path match', () => {
            const schema = `Z.object({ user: Z.object({ profile: Z.object({ bio: Z.string().test$restricted() }) }) })`;
            expect(() => parser.parse(schema)).not.toThrow();
        });
        it('should allow extension on a regex path match', () => {
            const schema1 = `Z.object({ user: Z.object({ address: Z.object({ street: Z.string().test$restricted() }) }) })`;
            const schema2 = `Z.object({ user: Z.object({ address: Z.object({ city: Z.string().test$restricted() }) }) })`;
            expect(() => parser.parse(schema1)).not.toThrow();
            expect(() => parser.parse(schema2)).not.toThrow();
        });
        it('should throw an error for a disallowed path', () => {
            const schema = `Z.object({ user: Z.object({ email: Z.string().test$restricted() }) })`;
            expect(() => parser.parse(schema)).toThrow(index_1.ZontaxMergeError);
            expect(() => parser.parse(schema)).toThrow("Extension 'test$restricted' is not allowed on path 'user.email'.");
        });
        it('should throw an error for a disallowed regex path', () => {
            const schema = `Z.object({ user: Z.object({ address: Z.object({ country: Z.string().test$restricted() }) }) })`;
            expect(() => parser.parse(schema)).toThrow("Extension 'test$restricted' is not allowed on path 'user.address.country'.");
        });
    });
});
