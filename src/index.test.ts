import { ZontaxParser, Extension, ZontaxMergeError } from './index';
import { parseZodString } from 'zod-subset-parser';

// --- Test Data (Category-less) ---
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'] },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'] },
];

const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'] },
];

const globalSchema: Extension[] = [
  { name: 'analyticsId', allowedOn: ['string'], args: ['string'] },
];


describe('ZontaxParser', () => {

  describe('Initialization', () => {
    it('should register global extensions', async () => {
      const parser = new ZontaxParser({}, [globalSchema]);
      const { schema } = await parser.parse('Z.string().analyticsId("test")');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should register namespaced extensions', async () => {
      const parser = new ZontaxParser({}, [{ namespace: 'ui', extensions: uiSchema }]);
      const { schema } = await parser.parse('Z.string().ui$label("Name")');
      expect(() => parseZodString(schema)).not.toThrow();
    });
  });

  describe('Composition (Multi-Schema Parsing)', () => {
    const parser = new ZontaxParser({}, [
      { namespace: 'ui', extensions: uiSchema },
      { namespace: 'doc', extensions: docSchema },
    ]);

    it('should merge more than two schemas and produce a valid final schema', async () => {
        const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
        const s2 = `Z.object({ user: Z.object({ name: Z.string().min(3) }) })`;
        const s3 = `Z.object({ user: Z.object({ name: Z.string().max(10) }) })`;
        const s4 = `Z.object({ user: Z.object({ name: Z.string().ui$label("Name") }) })`;

        const { definition, schema } = await parser.parse(s1, s2, s3, s4);
        const nameDef = definition.fields.user.fields.name;

        expect(nameDef.validations.min).toBe(3);
        expect(nameDef.validations.max).toBe(10);
        expect(nameDef.namespaces.ui.label.value).toBe("Name");
        expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should throw a detailed error on type mismatch', async () => {
      const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
      const s2 = `Z.object({ user: Z.object({ name: Z.number() }) })`;
      const expectedError = "Type mismatch at schema index 1 for field 'user.name': Cannot merge type 'number' into 'string'.";
      await expect(parser.parse(s1, s2)).rejects.toThrow(new ZontaxMergeError(expectedError));
    });

    it('should throw a detailed error on validation conflict', async () => {
      const s1 = `Z.object({ name: Z.string().min(3) })`;
      const s2 = `Z.object({ name: Z.string().min(4) })`;
      const expectedError = "Validation conflict at schema index 1 for field 'name': Mismatch for validation 'min'.";
      await expect(parser.parse(s1, s2)).rejects.toThrow(new ZontaxMergeError(expectedError));
    });
  });

  describe('Zod Method Support', () => {
    const parser = new ZontaxParser();

    it('should support .describe() method', async () => {
      const { schema, definition } = await parser.parse('Z.string().describe("A user name")');
      expect(schema).toBe('z.string().describe("A user name")');
      expect(definition.description).toBe('A user name');
      expect(definition.type).toBe('string');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() with other methods', async () => {
      const { schema, definition } = await parser.parse('Z.string().min(3).describe("Username").optional()');
      expect(schema).toBe('z.string().min(3).describe("Username").optional()');
      expect(definition.description).toBe('Username');
      expect(definition.validations.min).toBe(3);
      expect(definition.optional).toBe(true);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() in object fields', async () => {
      const { schema, definition } = await parser.parse('Z.object({name: Z.string().describe("User full name")})');
      expect(schema).toBe('z.object({ name: z.string().describe("User full name") })');
      expect(definition.fields.name.description).toBe('User full name');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() with validations', async () => {
      const { schema, definition } = await parser.parse('Z.number().min(0).max(100).describe("Percentage value")');
      expect(schema).toBe('z.number().max(100).min(0).describe("Percentage value")');
      expect(definition.description).toBe('Percentage value');
      expect(definition.validations.min).toBe(0);
      expect(definition.validations.max).toBe(100);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .nullable() method', async () => {
      const { schema, definition } = await parser.parse('Z.string().nullable()');
      expect(schema).toBe('z.string().nullable()');
      expect(definition.nullable).toBe(true);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .default() method', async () => {
      const { schema, definition } = await parser.parse('Z.string().default("test")');
      expect(schema).toBe('z.string().default("test")');
      expect(definition.defaultValue).toBe('test');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support number validations (int, positive, negative)', async () => {
      const { schema: intSchema } = await parser.parse('Z.number().int()');
      expect(intSchema).toBe('z.number().int()');
      expect(() => parseZodString(intSchema)).not.toThrow();

      const { schema: positiveSchema } = await parser.parse('Z.number().positive()');
      expect(positiveSchema).toBe('z.number().positive()');
      expect(() => parseZodString(positiveSchema)).not.toThrow();

      const { schema: negativeSchema } = await parser.parse('Z.number().negative()');
      expect(negativeSchema).toBe('z.number().negative()');
      expect(() => parseZodString(negativeSchema)).not.toThrow();
    });

    it('should support .enum() method', async () => {
      const { schema, definition } = await parser.parse('Z.enum(["a", "b", "c"])');
      expect(schema).toBe('z.enum(["a", "b", "c"])');
      expect(definition.type).toBe('enum');
      expect(definition.values).toEqual(['a', 'b', 'c']);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .literal() method', async () => {
      const { schema, definition } = await parser.parse('Z.literal("test")');
      expect(schema).toBe('z.literal("test")');
      expect(definition.type).toBe('literal');
      expect(definition.value).toBe('test');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .tuple() method', async () => {
      const { schema, definition } = await parser.parse('Z.tuple([Z.string(), Z.number()])');
      expect(schema).toBe('z.tuple([z.string(), z.number()])');
      expect(definition.type).toBe('tuple');
      expect(definition.items).toHaveLength(2);
      expect(definition.items[0].type).toBe('string');
      expect(definition.items[1].type).toBe('number');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .union() method', async () => {
      const { schema, definition } = await parser.parse('Z.union([Z.string(), Z.number()])');
      expect(schema).toBe('z.union([z.string(), z.number()])');
      expect(definition.type).toBe('union');
      expect(definition.options).toHaveLength(2);
      expect(definition.options[0].type).toBe('string');
      expect(definition.options[1].type).toBe('number');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support complex method chaining', async () => {
      const { schema, definition } = await parser.parse('Z.string().min(3).max(10).optional().nullable().describe("Name")');
      expect(schema).toBe('z.string().max(10).min(3).describe("Name").nullable().optional()');
      expect(definition.validations.min).toBe(3);
      expect(definition.validations.max).toBe(10);
      expect(definition.optional).toBe(true);
      expect(definition.nullable).toBe(true);
      expect(definition.description).toBe('Name');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support complex nested structures', async () => {
      const { schema } = await parser.parse('Z.union([Z.string().email(), Z.literal("admin")])'); 
      expect(schema).toBe('z.union([z.string().email(), z.literal("admin")])');
      expect(() => parseZodString(schema)).not.toThrow();
    });
  });

  describe('Zod Version Support', () => {
    it('should default to Zod 4', async () => {
      const parser = new ZontaxParser();
      const { schema } = await parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should support explicit Zod 4', async () => {
      const parser = new ZontaxParser({ zodVersion: '4' });
      const { schema } = await parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should support explicit Zod 3', async () => {
      const parser = new ZontaxParser({ zodVersion: '3' });
      const { schema } = await parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should generate identical output for basic types in both versions', async () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const basicTypes = [
        'Z.string()',
        'Z.number()',
        'Z.boolean()',
        'Z.date()',
        'Z.string().min(5)',
        'Z.string().max(10)',
        'Z.string().optional()',
        'Z.string().nullable()',
        'Z.string().default("test")',
        'Z.number().int()',
        'Z.number().positive()',
        'Z.number().negative()'
      ];

      for (const input of basicTypes) {
        const result3 = await parser3.parse(input);
        const result4 = await parser4.parse(input);
        expect(result3.schema).toBe(result4.schema);
      }
    });

    it('should generate identical output for complex types in both versions', async () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const complexTypes = [
        'Z.object({name: Z.string()})',
        'Z.array(Z.string())',
        'Z.enum(["a", "b", "c"])',
        'Z.literal("test")',
        'Z.tuple([Z.string(), Z.number()])',
        'Z.union([Z.string(), Z.number()])'
      ];

      for (const input of complexTypes) {
        const result3 = await parser3.parse(input);
        const result4 = await parser4.parse(input);
        expect(result3.schema).toBe(result4.schema);
      }
    });

    it('should generate identical output for method chaining in both versions', async () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const chainedMethods = [
        'Z.string().min(3).max(10).optional()',
        'Z.string().email().describe("Email address")',
        'Z.number().int().positive().default(1)',
        'Z.string().min(1).nullable().describe("Name")'
      ];

      for (const input of chainedMethods) {
        const result3 = await parser3.parse(input);
        const result4 = await parser4.parse(input);
        expect(result3.schema).toBe(result4.schema);
      }
    });

    it('should work with extensions in both versions', async () => {
      const extensions = [{ name: 'label', allowedOn: ['string'], args: ['string'] }];
      const parser3 = new ZontaxParser({ zodVersion: '3' }, [extensions]);
      const parser4 = new ZontaxParser({ zodVersion: '4' }, [extensions]);

      const input = 'Z.string().label("Name")';
      const result3 = await parser3.parse(input);
      const result4 = await parser4.parse(input);
      
      expect(result3.schema).toBe('z.string()');
      expect(result4.schema).toBe('z.string()');
      expect(result3.schema).toBe(result4.schema);
    });

    it('should handle nested structures in both versions', async () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const input = 'Z.object({user: Z.object({name: Z.string().min(1), age: Z.number().int()})})';
      const result3 = await parser3.parse(input);
      const result4 = await parser4.parse(input);
      
      expect(result3.schema).toBe(result4.schema);
      expect(result3.schema).toBe('z.object({ user: z.object({ name: z.string().min(1), age: z.number().int() }) })');
    });
  });

  describe('Modes (Strict vs. Loose)', () => {
    it('should throw in strict mode for unregistered methods', async () => {
      const parser = new ZontaxParser({ mode: 'strict' });
      await expect(parser.parse('Z.string().unregistered()')).rejects.toThrow();
    });

    it('should capture loose methods and produce a valid schema', async () => {
      const parser = new ZontaxParser({ mode: 'loose' });
      const { definition, schema } = await parser.parse('Z.string().author("John").meta$version(2)');
      expect(definition.extensions.author.value).toBe('John');
      expect(definition.namespaces.meta.version.value).toBe(2);
      expect(() => parseZodString(schema)).not.toThrow();
    });
  });

  describe('Introspection', () => {
    it('should return a map of all registered extensions', () => {
      const parser = new ZontaxParser({}, [
        globalSchema,
        { namespace: 'ui', extensions: uiSchema }
      ]);
      const registrations = parser.getExtensions();
      expect(Object.keys(registrations)).toEqual(['_global', 'ui']);
      expect(registrations._global).toHaveLength(1);
      expect(registrations.ui).toHaveLength(2);
      expect(registrations._global[0].name).toBe('analyticsId');
      expect(registrations.ui.find(e => e.name === 'label')).toBeDefined();
    });
  });

  describe('Static Helpers', () => {
    const parser = new ZontaxParser({}, [
        { namespace: 'ui', extensions: uiSchema },
        { namespace: 'doc', extensions: docSchema },
    ]);
    
    let definition: any;
    
    beforeAll(async () => {
        const result = await parser.parse(`
            Z.object({
                name: Z.string().ui$label("Name").doc$internalDoc("Doc"),
                age: Z.number().ui$placeholder("Age")
            })
        `);
        definition = result.definition;
    });

    describe('getDefinitionByNamespace', () => {
        it('should return a map of fields filtered by a single namespace', () => {
            const uiView = ZontaxParser.getDefinitionByNamespace(definition, 'ui');
            expect(Object.keys(uiView)).toEqual(['name', 'age']);
            expect(uiView.name.namespaces.ui.label).toBeDefined();
            expect(uiView.name.namespaces.doc).toBeUndefined(); // Ensure other namespaces are excluded
        });
    });

    describe('generateSchemaFromDefinition', () => {
        const looseParser = new ZontaxParser({ mode: 'loose' });
        let looseDef: any;
        
        beforeAll(async () => {
            const result = await looseParser.parse(`Z.object({ name: Z.string().ui$label("Name") })`);
            looseDef = result.definition;
        });

        it('should generate a schema for a specific namespace', () => {
            const generated = ZontaxParser.generateSchemaFromDefinition(looseDef, 'ui');
            expect(generated).toHaveLength(1);
            expect(generated[0].name).toBe('label');
        });
    });
  });

  describe('allowedOnPath Validation', () => {
    const pathSchema: Extension[] = [
        { 
            name: 'restricted', 
            allowedOn: ['string'], 
            args: [], 
            allowedOnPath: ['user.name', 'user.profile.*', /^user\.address\.(street|city)$/] 
        }
    ];
    const parser = new ZontaxParser({}, [{ namespace: 'test', extensions: pathSchema }]);

    it('should allow extension on an exact path match', async () => {
        const schema = `Z.object({ user: Z.object({ name: Z.string().test$restricted() }) })`;
        await expect(parser.parse(schema)).resolves.not.toThrow();
    });

    it('should allow extension on a wildcard path match', async () => {
        const schema = `Z.object({ user: Z.object({ profile: Z.object({ bio: Z.string().test$restricted() }) }) })`;
        await expect(parser.parse(schema)).resolves.not.toThrow();
    });

    it('should allow extension on a regex path match', async () => {
        const schema1 = `Z.object({ user: Z.object({ address: Z.object({ street: Z.string().test$restricted() }) }) })`;
        const schema2 = `Z.object({ user: Z.object({ address: Z.object({ city: Z.string().test$restricted() }) }) })`;
        await expect(parser.parse(schema1)).resolves.not.toThrow();
        await expect(parser.parse(schema2)).resolves.not.toThrow();
    });

    it('should throw an error for a disallowed path', async () => {
        const schema = `Z.object({ user: Z.object({ email: Z.string().test$restricted() }) })`;
        await expect(parser.parse(schema)).rejects.toThrow(ZontaxMergeError);
        await expect(parser.parse(schema)).rejects.toThrow("Extension 'test$restricted' is not allowed on path 'user.email'.");
    });

    it('should throw an error for a disallowed regex path', async () => {
        const schema = `Z.object({ user: Z.object({ address: Z.object({ country: Z.string().test$restricted() }) }) })`;
        await expect(parser.parse(schema)).rejects.toThrow("Extension 'test$restricted' is not allowed on path 'user.address.country'.");
    });
  });
});