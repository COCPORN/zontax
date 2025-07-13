import { ZontaxParser, Extension } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

const uiExtensions: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'], outputGroup: 'ui' },
  { name: 'widget', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  { name: 'group', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
];

describe('ZontaxParser', () => {
  let parser: ZontaxParser;

  beforeEach(() => {
    parser = new ZontaxParser(uiExtensions);
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
        // missing allowedOn
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
          name: z.string()
            .min(1)
            .label("Full Name")
            .widget("text"),
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
      const input = `
        z.object({
          name: z.string().unregistered()
        });
      `;
      expect(() => parser.parseZodSchema(input)).toThrow("Unrecognized method '.unregistered()'. Please register it as an extension.");
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata based on registered extensions', () => {
      const input = `
        z.object({
          name: z.string()
            .min(1)
            .label("Full Name")
            .placeholder("e.g. Alice")
            .widget("text")
            .group("personal"),

          age: z.number()
            .min(0)
            .optional()
            .label("Age")
            .widget("slider")
        });
      `;
      const expectedMetadata = {
        "type": "object",
        "fields": {
          "name": {
            "type": "string",
            "validations": { "min": 1 },
            "ui": {
              "label": "Full Name",
              "placeholder": "e.g. Alice",
              "widget": "text",
              "group": "personal"
            }
          },
          "age": {
            "type": "number",
            "optional": true,
            "validations": { "min": 0 },
            "ui": {
              "label": "Age",
              "widget": "slider"
            }
          }
        }
      };
      const result = parser.extractMetadata(input);
      expect(result).toEqual(expectedMetadata);
    });

    it('should ignore unregistered methods', () => {
        const input = `
        z.object({
          name: z.string()
            .label("Full Name")
            .unregistered("some value")
        });
      `;
      const expectedMetadata = {
        "type": "object",
        "fields": {
          "name": {
            "type": "string",
            "validations": {},
            "ui": {
              "label": "Full Name"
            }
          }
        }
      };
      const result = parser.extractMetadata(input);
      expect(result).toEqual(expectedMetadata);
    });
  });
});
