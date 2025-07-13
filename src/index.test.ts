import { ZontaxParser, Extension } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

// --- Test Data ---
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'] },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'] },
];

const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'] },
];

const globalSchema: Extension[] = [
  { name: 'analyticsId', allowedOn: ['string'], args: ['string'] },
];

describe('ZontaxParser', () => {

  describe('Initialization and Registration', () => {
    it('should register global extensions', () => {
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
      expect(definition.fields.name.extensions.analyticsId.value).toBe('user-name');
      expect(definition.fields.name.namespaces.ui.label.value).toBe('Full Name');
      const bio = definition.fields.profile.fields.bio;
      expect(bio.namespaces.doc.internalDoc.value).toBe('User biography');
    });

    it('should generate a clean schema string', () => {
      const { schema } = parser.parse(input);
      const expected = `z.object({ name: z.string().min(1), profile: z.object({ bio: z.string().optional() }) })`;
      expect(stripWhitespace(schema)).toEqual(stripWhitespace(expected));
    });
  });

  describe('Loose Mode', () => {
    const parser = new ZontaxParser(
        [{ namespace: 'ui', extensions: uiSchema }], 
        { mode: 'loose' }
    );
    const input = `z.string().ui$label("Name").author("John").meta$version(2)`;

    it('should capture loose global and namespaced methods', () => {
        const { definition } = parser.parse(input);
        expect(definition.namespaces.ui.label.value).toBe('Name');
        expect(definition.extensions.author.value).toBe('John');
        expect(definition.namespaces.meta.version.value).toBe(2);
    });
  });

  describe('Static Helper: generateSchemaFromDefinition', () => {
    const parser = new ZontaxParser([], { mode: 'loose' });
    const { definition } = parser.parse(`
        z.object({
            name: z.string().ui$label("Name").doc$internalDoc("Doc for Name"),
            age: z.number().ui$placeholder("Age"),
            id: z.string().analyticsId("user-id")
        })
    `);

    it('should generate a schema for a specific namespace', () => {
        const generated = ZontaxParser.generateSchemaFromDefinition(definition, 'ui');
        expect(generated).toHaveLength(2);
        expect(generated.find(e => e.name === 'label')).toBeDefined();
        expect(generated.find(e => e.name === 'placeholder')).toBeDefined();
    });

    it('should generate a schema for all extensions if no namespace is provided', () => {
        const generated = ZontaxParser.generateSchemaFromDefinition(definition);
        expect(generated).toHaveLength(4);
    });
  });
});
