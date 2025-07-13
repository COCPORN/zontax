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

    it('should return both schema and full metadata by default', () => {
        const { schema, metadata } = parser.parse(input);

        const expectedSchema = `z.object({ name: z.string().min(1), age: z.number().optional() })`;
        expect(stripWhitespace(schema)).toEqual(stripWhitespace(expectedSchema));

        expect(metadata.fields.name.ui.label).toBe("Full Name");
        expect(metadata.fields.name.doc.internalDoc).toBe("User's full name");
    });

    it('should filter metadata based on categories option', () => {
        const { metadata } = parser.parse(input, { categories: ['ui'] });
        expect(metadata.fields.name.ui.label).toBe("Full Name");
        expect(metadata.fields.name.doc).toBeUndefined();
    });

    it('should throw an error for unregistered methods', () => {
      const invalidInput = `z.object({ name: z.string().unregistered() });`;
      expect(() => parser.parse(invalidInput)).toThrow("Unrecognized method '.unregistered()'. Please register it as an extension.");
    });
  });
});
