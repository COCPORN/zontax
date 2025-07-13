import { ZontaxParser, Extension } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

const testExtensions: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  { name: 'widget', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  { name: 'internalDoc', allowedOn: ['string'], args: ['string'], outputGroup: 'doc' },
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
        outputGroup: 'ui',
        description: 'A tooltip for a field'
      };
      parser.register(newExtension);
      // No error means success
    });

    it('should throw an error when registering an invalid extension', () => {
      const invalidExtension: any = {
        name: 'invalid',
        args: ['string'],
        outputGroup: 'ui'
      };
      expect(() => parser.register(invalidExtension)).toThrow();
    });
  });

  describe('parseZodSchema', () => {
    it('should strip out registered superset methods', () => {
      const input = `
        z.object({
          name: z.string().min(1).label("Full Name").widget("text"),
          age: z.number().optional().label("Age")
        });
      `;
      const expectedZodCode = `
        z.object({
          name: z.string().min(1),
          age: z.number().optional()
        })
      `;
      const result = parser.parseZodSchema(input);
      expect(stripWhitespace(result)).toEqual(stripWhitespace(expectedZodCode));
    });

    it('should throw an error for unregistered methods', () => {
      const input = `z.object({ name: z.string().unregistered() });`;
      expect(() => parser.parseZodSchema(input)).toThrow("Unrecognized method '.unregistered()'. Please register it as an extension.");
    });
  });

  describe('extractMetadata', () => {
    const input = `
      z.object({
        name: z.string().label("Name").internalDoc("User's full name"),
        age: z.number().min(0)
      })
    `;

    it('should extract all metadata by default', () => {
      const result = parser.extractMetadata(input);
      const nameField = result.fields.name;
      expect(nameField.ui.label).toBe("Name");
      expect(nameField.doc.internalDoc).toBe("User's full name");
    });

    it('should filter to include only a single outputGroup', () => {
      const result = parser.extractMetadata(input, { include: ['ui'] });
      const nameField = result.fields.name;
      expect(nameField.ui.label).toBe("Name");
      expect(nameField.doc).toBeUndefined();
    });

    it('should filter to include multiple outputGroups', () => {
        const result = parser.extractMetadata(input, { include: ['ui', 'doc'] });
        const nameField = result.fields.name;
        expect(nameField.ui.label).toBe("Name");
        expect(nameField.doc.internalDoc).toBe("User's full name");
    });

    it('should return no metadata if group is not in the include list', () => {
        const result = parser.extractMetadata(input, { include: ['analytics'] });
        const nameField = result.fields.name;
        expect(nameField.ui).toBeUndefined();
        expect(nameField.doc).toBeUndefined();
    });
  });
});
