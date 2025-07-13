import { ZontaxParser, Extension, ZontaxMergeError } from './index';

// --- Test Data (Category-less) ---
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'] },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'] },
];

const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'] },
];

const globalSchema: Extension[] = [
  { name: 'analyticsId', allowedOn: ['string'], args: ['string'] },
];


describe('ZontaxParser', () => {

  describe('Initialization', () => {
    it('should register global extensions via array shorthand', () => {
      const parser = new ZontaxParser([globalSchema]);
      const { definition } = parser.parse('z.string().analyticsId("test")');
      expect(definition.extensions.analyticsId.value).toBe('test');
    });

    it('should register namespaced extensions', () => {
      const parser = new ZontaxParser([{ namespace: 'ui', extensions: uiSchema }]);
      const { definition } = parser.parse('z.string().ui$label("Name")');
      expect(definition.namespaces.ui.label.value).toBe('Name');
    });
  });

  describe('Composition (Multi-Schema Parsing)', () => {
    const parser = new ZontaxParser([
      { namespace: 'ui', extensions: uiSchema },
      { namespace: 'doc', extensions: docSchema },
    ]);

    it('should merge more than two schemas correctly', () => {
        const s1 = `z.object({ user: z.object({ name: z.string() }) })`;
        const s2 = `z.object({ user: z.object({ name: z.string().min(3) }) })`;
        const s3 = `z.object({ user: z.object({ name: z.string().max(10) }) })`;
        const s4 = `z.object({ user: z.object({ name: z.string().ui$label("Name") }) })`;

        const { definition } = parser.parse(s1, s2, s3, s4);
        const nameDef = definition.fields.user.fields.name;

        expect(nameDef.validations.min).toBe(3);
        expect(nameDef.validations.max).toBe(10);
        expect(nameDef.namespaces.ui.label.value).toBe("Name");
    });

    it('should throw a detailed error on type mismatch', () => {
      const s1 = `z.object({ user: z.object({ name: z.string() }) })`;
      const s2 = `z.object({ user: z.object({ name: z.number() }) })`;
      const expectedError = "Type mismatch at schema index 1 for field 'user.name': Cannot merge type 'number' into 'string'.";
      expect(() => parser.parse(s1, s2)).toThrow(new ZontaxMergeError(expectedError));
    });

    it('should throw a detailed error on validation conflict', () => {
      const s1 = `z.object({ name: z.string().min(3) })`;
      const s2 = `z.object({ name: z.string().min(4) })`;
      const expectedError = "Validation conflict at schema index 1 for field 'name': Mismatch for validation 'min'.";
      expect(() => parser.parse(s1, s2)).toThrow(new ZontaxMergeError(expectedError));
    });
  });

  describe('Modes (Strict vs. Loose)', () => {
    it('should throw in strict mode for unregistered methods', () => {
      const parser = new ZontaxParser([], { mode: 'strict' });
      expect(() => parser.parse('z.string().unregistered()')).toThrow();
    });

    it('should capture loose methods correctly', () => {
      const parser = new ZontaxParser([], { mode: 'loose' });
      const { definition } = parser.parse('z.string().author("John").meta$version(2)');
      expect(definition.extensions.author.value).toBe('John');
      expect(definition.namespaces.meta.version.value).toBe(2);
    });
  });

  describe('Static Helpers', () => {
    const parser = new ZontaxParser([
        { namespace: 'ui', extensions: uiSchema },
        { namespace: 'doc', extensions: docSchema },
    ]);
    const { definition } = parser.parse(`
        z.object({
            name: z.string().ui$label("Name").doc$internalDoc("Doc"),
            age: z.number().ui$placeholder("Age")
        })
    `);

    describe('getDefinitionByNamespace', () => {
        it('should return a map of fields filtered by a single namespace', () => {
            const uiView = ZontaxParser.getDefinitionByNamespace(definition, 'ui');
            expect(Object.keys(uiView)).toEqual(['name', 'age']);
            expect(uiView.name.namespaces.ui.label).toBeDefined();
            expect(uiView.name.namespaces.doc).toBeUndefined(); // Ensure other namespaces are excluded
        });
    });

    describe('generateSchemaFromDefinition', () => {
        const looseParser = new ZontaxParser([], { mode: 'loose' });
        const looseDef = looseParser.parse(`z.object({ name: z.string().ui$label("Name") })`).definition;

        it('should generate a schema for a specific namespace', () => {
            const generated = ZontaxParser.generateSchemaFromDefinition(looseDef, 'ui');
            expect(generated).toHaveLength(1);
            expect(generated[0].name).toBe('label');
        });
    });
  });
});
