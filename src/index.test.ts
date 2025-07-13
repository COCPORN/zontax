import { ZontaxParser, Extension, ZontaxMergeError } from './index';

// --- Test Data ---
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'] },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'] },
];

const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'] },
];

describe('ZontaxParser Composition', () => {
  const parser = new ZontaxParser([
    { namespace: 'ui', extensions: uiSchema },
    { namespace: 'doc', extensions: docSchema },
  ]);

  describe('Successful Composition', () => {
    const baseSchema = `z.object({ username: z.string() })`;
    const uiLayer = `z.object({ username: z.string().ui$label("User") })`;
    const validationLayer = `z.object({ username: z.string().min(3) })`;

    it('should merge extensions and validations correctly', () => {
      const { definition, schema } = parser.parse(baseSchema, uiLayer, validationLayer);
      
      // Check definition
      const userDef = definition.fields.username;
      expect(userDef.type).toBe('string');
      expect(userDef.validations.min).toBe(3);
      expect(userDef.namespaces.ui.label.value).toBe('User');

      // Check final schema string
      expect(schema).toContain('.min(3)');
    });

    it('should override extensions from later schemas', () => {
        const overrideLayer = `z.object({ username: z.string().ui$label("Username") })`;
        const { definition } = parser.parse(baseSchema, uiLayer, overrideLayer);
        expect(definition.fields.username.namespaces.ui.label.value).toBe("Username");
    });
  });

  describe('Conflict Resolution', () => {
    const baseSchema = `z.object({ username: z.string().min(3) })`;

    it('should throw on type mismatch', () => {
      const conflictLayer = `z.object({ username: z.number() })`;
      expect(() => parser.parse(baseSchema, conflictLayer)).toThrow(ZontaxMergeError);
      expect(() => parser.parse(baseSchema, conflictLayer)).toThrow("Type mismatch: Cannot merge type 'number' into 'string'.");
    });

    it('should throw on validation conflict', () => {
      const conflictLayer = `z.object({ username: z.string().min(4) })`;
      expect(() => parser.parse(baseSchema, conflictLayer)).toThrow(ZontaxMergeError);
      expect(() => parser.parse(baseSchema, conflictLayer)).toThrow("Validation conflict for 'min'.");
    });
  });

  describe('Schema Generation from Merged Definition', () => {
    it('should generate a schema string that reflects the merged validations', () => {
        const s1 = `z.object({ name: z.string() })`;
        const s2 = `z.object({ name: z.string().min(5) })`;
        const s3 = `z.object({ name: z.string().max(10) })`;
        const { schema } = parser.parse(s1, s2, s3);
        expect(schema).toContain('.min(5)');
        expect(schema).toContain('.max(10)');
    });
  });
});