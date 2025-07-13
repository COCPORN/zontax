import { extractMetadata, parseZodSchema } from './index';

// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code: string) => code.replace(/\s/g, '');

describe('Zontax Parser', () => {
  describe('parseZodSchema', () => {
    it('should parse a simple object with string and number', () => {
      const input = `
        z.object({
          name: z.string(),
          age: z.number()
        })
      `;
      const expectedZodCode = `
        z.object({
          name: z.string(),
          age: z.number()
        })
      `;
      const result = parseZodSchema(input);
      expect(stripWhitespace(result)).toEqual(stripWhitespace(expectedZodCode));
    });

    it('should strip out superset methods and produce valid Zod code', () => {
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
      const expectedZodCode = `
        z.object({
          name: z.string().min(1),
          age: z.number().min(0).optional()
        })
      `;
      const result = parseZodSchema(input);
      expect(stripWhitespace(result)).toEqual(stripWhitespace(expectedZodCode));
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from superset methods', () => {
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
      const result = extractMetadata(input);
      expect(result).toEqual(expectedMetadata);
    });
  });
});
