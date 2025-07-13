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
    it('should handle basic types', () => {
        const input = `z.object({
            name: z.string().label("Name"),
            age: z.number().min(0),
            verified: z.boolean().label("Verified")
        })`;
        const result = parser.extractMetadata(input);
        expect(result.fields.name.type).toBe('string');
        expect(result.fields.age.type).toBe('number');
        expect(result.fields.verified.type).toBe('boolean');
    });

    it('should handle nested objects', () => {
        const input = `z.object({
            user: z.object({
                name: z.string().label("Username"),
                email: z.string().email()
            }).label("User Details")
        })`;
        const result = parser.extractMetadata(input);
        expect(result.fields.user.type).toBe('object');
        expect(result.fields.user.ui.label).toBe('User Details');
        expect(result.fields.user.fields.name.type).toBe('string');
        expect(result.fields.user.fields.name.ui.label).toBe('Username');
        expect(result.fields.user.fields.email.validations.email).toBe(true);
    });

    it('should handle arrays of primitive types', () => {
        const input = `z.object({
            tags: z.array(z.string()).min(1).label("Tags")
        })`;
        const result = parser.extractMetadata(input);
        expect(result.fields.tags.type).toBe('array');
        expect(result.fields.tags.validations.min).toBe(1);
        expect(result.fields.tags.ui.label).toBe('Tags');
        expect(result.fields.tags.of.type).toBe('string');
    });

    it('should handle arrays of objects', () => {
        const input = `z.object({
            users: z.array(z.object({
                id: z.string().uuid(),
                name: z.string()
            })).label("User List")
        })`;
        const result = parser.extractMetadata(input);
        const usersField = result.fields.users;
        expect(usersField.type).toBe('array');
        expect(usersField.ui.label).toBe('User List');
        expect(usersField.of.type).toBe('object');
        expect(usersField.of.fields.id.type).toBe('string');
        expect(usersField.of.fields.id.validations.uuid).toBe(true);
    });

    it('should ignore unregistered methods', () => {
        const input = `
        z.object({
          name: z.string()
            .label("Full Name")
            .unregistered("some value")
        });
      `;
      const result = parser.extractMetadata(input);
      expect(result.fields.name.ui.unregistered).toBeUndefined();
    });
  });
});
