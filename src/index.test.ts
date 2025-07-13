import { ZontaxParser, Extension } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

// --- Test Data ---
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'], category: 'ui' },
];

const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'], category: 'doc' },
];

const globalSchema: Extension[] = [
  { name: 'analyticsId', allowedOn: ['string'], args: ['string'], category: 'tracking' },
];

describe('ZontaxParser', () => {

  describe('Initialization and Registration', () => {
    it('should register global extensions via array shorthand', () => {
      const parser = new ZontaxParser([globalSchema]);
      const { definition } = parser.parse('z.string().analyticsId("test")');
      expect(definition.extensions.analyticsId.value).toBe('test');
    });

    it('should register global extensions via object notation', () => {
      const parser = new ZontaxParser([{ extensions: globalSchema }]);
      const { definition } = parser.parse('z.string().analyticsId("test")');
      expect(definition.extensions.analyticsId.value).toBe('test');
    });

    it('should register namespaced extensions', () => {
      const parser = new ZontaxParser([{ namespace: 'ui', extensions: uiSchema }]);
      const { definition } = parser.parse('z.string().ui$label("Name")');
      expect(definition.namespaces.ui.label.value).toBe('Name');
    });

    it('should handle mixed registration', () => {
      const parser = new ZontaxParser([globalSchema, { namespace: 'ui', extensions: uiSchema }]);
      const { definition } = parser.parse('z.string().analyticsId("id").ui$label("Name")');
      expect(definition.extensions.analyticsId.value).toBe('id');
      expect(definition.namespaces.ui.label.value).toBe('Name');
    });
  });

  describe('Parsing Logic', () => {
    const parser = new ZontaxParser([
      globalSchema,
      { namespace: 'ui', extensions: uiSchema },
      { namespace: 'doc', extensions: docSchema },
    ]);

    const input = `
      z.object({
        name: z.string().min(1).analyticsId("user-name").ui$label("Full Name"),
        profile: z.object({
          bio: z.string().optional().doc$internalDoc("User biography")
        })
      })
    `;

    it('should parse a complex schema correctly', () => {
      const { definition } = parser.parse(input);
      
      // Top-level field
      expect(definition.fields.name.type).toBe('string');
      expect(definition.fields.name.validations.min).toBe(1);
      expect(definition.fields.name.extensions.analyticsId.value).toBe('user-name');
      expect(definition.fields.name.namespaces.ui.label.value).toBe('Full Name');

      // Nested field
      const bio = definition.fields.profile.fields.bio;
      expect(bio.type).toBe('string');
      expect(bio.optional).toBe(true);
      expect(bio.namespaces.doc.internalDoc.value).toBe('User biography');
    });

    it('should generate a clean schema string', () => {
      const { schema } = parser.parse(input);
      const expected = `z.object({ name: z.string().min(1), profile: z.object({ bio: z.string().optional() }) })`;
      expect(stripWhitespace(schema)).toEqual(stripWhitespace(expected));
    });
  });

  describe('Strict Mode', () => {
    it('should throw an error for unregistered global methods', () => {
      const parser = new ZontaxParser([], { mode: 'strict' });
      expect(() => parser.parse('z.string().unregistered()')).toThrow();
    });

    it('should throw an error for unregistered namespaced methods', () => {
      const parser = new ZontaxParser([], { mode: 'strict' });
      expect(() => parser.parse('z.string().fake$unregistered()')).toThrow();
    });
  });

  describe('Loose Mode', () => {
    const parser = new ZontaxParser(
        [{ namespace: 'ui', extensions: uiSchema }], 
        { mode: 'loose' }
    );
    const input = `z.string().ui$label("Name").author("John").meta$version(2)`;

    it('should not throw for unregistered methods', () => {
        expect(() => parser.parse(input)).not.toThrow();
    });

    it('should capture loose global and namespaced methods', () => {
        const { definition } = parser.parse(input);
        // Registered
        expect(definition.namespaces.ui.label.value).toBe('Name');
        // Loose global
        expect(definition.extensions.author.value).toBe('John');
        expect(definition.extensions.author.category).toBe('extra');
        // Loose namespaced
        expect(definition.namespaces.meta.version.value).toBe(2);
        expect(definition.namespaces.meta.version.category).toBe('extra');
    });
  });

  describe('Static Helper: getDefinitionByNamespace', () => {
    const parser = new ZontaxParser([
        globalSchema,
        { namespace: 'ui', extensions: uiSchema },
        { namespace: 'doc', extensions: docSchema },
    ]);
    const { definition } = parser.parse(`
        z.object({
            name: z.string().ui$label("Name").doc$internalDoc("Doc for Name"),
            age: z.number().ui$placeholder("Age"),
            id: z.string().analyticsId("user-id")
        })
    `);

    it('should return a map of fields filtered by a single namespace', () => {
        const uiView = ZontaxParser.getDefinitionByNamespace(definition, 'ui');
        
        expect(Object.keys(uiView)).toEqual(['name', 'age']);
        expect(uiView.name.namespaces.ui.label).toBeDefined();
        expect(uiView.age.namespaces.ui.placeholder).toBeDefined();
    });

    it('should handle namespaces that are not present', () => {
        const trackingView = ZontaxParser.getDefinitionByNamespace(definition, 'tracking');
        expect(Object.keys(trackingView)).toHaveLength(0);
    });
  });
});