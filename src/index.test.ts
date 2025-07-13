import { ZontaxParser, Extension } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

const testExtensions: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
  { name: 'widget', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
  { name: 'internalDoc', allowedOn: ['string'], args: ['string'], category: 'doc' },
];

describe('ZontaxParser', () => {
  let parser: ZontaxParser;

  beforeEach(() => {
    parser = new ZontaxParser(testExtensions);
  });

  describe('Registration', () => {
    it('should allow registering a valid extension', () => {
      const newExtension: Extension = {
        name: 'tooltip',
        allowedOn: ['string'],
        args: ['string'],
        category: 'ui',
        description: 'A tooltip for a field'
      };
      parser.register(newExtension);
      // No error means success
    });

    it('should throw an error when registering an invalid extension', () => {
      const invalidExtension: any = {
        name: 'invalid',
        args: ['string'],
        category: 'ui'
      };
      expect(() => parser.register(invalidExtension)).toThrow();
    });

    it('should expose registered extensions', () => {
        const extensions = parser.getRegisteredExtensions();
        expect(extensions).toHaveLength(3);
        expect(extensions.map(e => e.name)).toEqual(['label', 'widget', 'internalDoc']);
    });
  });

  describe('parse', () => {
    const input = `
      z.object({
        name: z.string().min(1).label("Full Name").internalDoc("User's full name"),
        age: z.number().optional().label("Age")
      })
    `;

    it('should return both schema and full definition by default', () => {
        const { schema, definition } = parser.parse(input);

        const expectedSchema = `z.object({ name: z.string().min(1), age: z.number().optional() })`;
        expect(stripWhitespace(schema)).toEqual(stripWhitespace(expectedSchema));

        // Check for Zod schema parts
        expect(definition.fields.name.type).toBe('string');
        expect(definition.fields.name.validations.min).toBe(1);
        expect(definition.fields.age.type).toBe('number');
        expect(definition.fields.age.optional).toBe(true);

        // Check for custom extension parts
        expect(definition.fields.name.ui.label).toBe("Full Name");
        expect(definition.fields.name.doc.internalDoc).toBe("User's full name");
    });

    it('should filter definition based on categories option', () => {
        const { definition } = parser.parse(input, { categories: ['ui'] });
        expect(definition.fields.name.ui.label).toBe("Full Name");
        expect(definition.fields.name.doc).toBeUndefined();
    });

    it('should throw an error for unregistered methods in strict mode (default)', () => {
      const strictParser = new ZontaxParser(testExtensions, { mode: 'strict' });
      const invalidInput = `z.object({ name: z.string().unregistered() });`;
      expect(() => strictParser.parse(invalidInput)).toThrow("Unrecognized method '.unregistered()'. Please register it as an extension or use loose mode.");
    });
  });

  describe('loose mode', () => {
    let looseParser: ZontaxParser;
    const input = `
      z.object({
        name: z.string().min(1).label("Full Name").author("John Doe"),
        age: z.number().optional().label("Age").deprecated(true)
      })
    `;

    beforeEach(() => {
      looseParser = new ZontaxParser(testExtensions, { mode: 'loose' });
    });

    it('should not throw for unregistered methods', () => {
      expect(() => looseParser.parse(input)).not.toThrow();
    });

    it('should parse unregistered methods into the "extra" category', () => {
      const { definition } = looseParser.parse(input);
      expect(definition.fields.name.extra.author).toBe("John Doe");
      expect(definition.fields.age.extra.deprecated).toBe(true);
    });

    it('should correctly strip loose methods from the schema string', () => {
      const { schema } = looseParser.parse(input);
      const expectedSchema = `z.object({ name: z.string().min(1), age: z.number().optional() })`;
      expect(stripWhitespace(schema)).toEqual(stripWhitespace(expectedSchema));
    });

    it('should still parse registered extensions correctly', () => {
      const { definition } = looseParser.parse(input);
      expect(definition.fields.name.ui.label).toBe("Full Name");
      expect(definition.fields.age.ui.label).toBe("Age");
    });

    it('should filter the "extra" category if specified', () => {
      const { definition } = looseParser.parse(input, { categories: ['ui'] });
      expect(definition.fields.name.extra).toBeUndefined();
      expect(definition.fields.name.ui.label).toBe("Full Name");
    });
  });
});
