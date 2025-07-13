"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
// Helper to remove whitespace for consistent comparison
const stripWhitespace = (code) => code.replace(/\s/g, '');
const testExtensions = [
    { name: 'label', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
    { name: 'widget', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
    { name: 'internalDoc', allowedOn: ['string'], args: ['string'], category: 'doc' },
];
describe('ZontaxParser', () => {
    let parser;
    beforeEach(() => {
        parser = new index_1.ZontaxParser(testExtensions);
    });
    describe('Registration', () => {
        it('should allow registering a valid extension', () => {
            const newExtension = {
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
            const invalidExtension = {
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
        it('should filter to include only a single category', () => {
            const result = parser.extractMetadata(input, { categories: ['ui'] });
            const nameField = result.fields.name;
            expect(nameField.ui.label).toBe("Name");
            expect(nameField.doc).toBeUndefined();
        });
        it('should filter to include multiple categories', () => {
            const result = parser.extractMetadata(input, { categories: ['ui', 'doc'] });
            const nameField = result.fields.name;
            expect(nameField.ui.label).toBe("Name");
            expect(nameField.doc.internalDoc).toBe("User's full name");
        });
        it('should return no metadata if category is not in the include list', () => {
            const result = parser.extractMetadata(input, { categories: ['analytics'] });
            const nameField = result.fields.name;
            expect(nameField.ui).toBeUndefined();
            expect(nameField.doc).toBeUndefined();
        });
    });
});
