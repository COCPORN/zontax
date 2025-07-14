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
    it('should register global extensions', () => {
      const parser = new ZontaxParser({}, [globalSchema]);
      const { schema } = parser.parse('Z.string().analyticsId("test")');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should register namespaced extensions', () => {
      const parser = new ZontaxParser({}, [{ namespace: 'ui', extensions: uiSchema }]);
      const { schema } = parser.parse('Z.string().ui$label("Name")');
      expect(() => parseZodString(schema)).not.toThrow();
    });
  });

  describe('Composition (Multi-Schema Parsing)', () => {
    const parser = new ZontaxParser({}, [
      { namespace: 'ui', extensions: uiSchema },
      { namespace: 'doc', extensions: docSchema },
    ]);

    it('should merge more than two schemas and produce a valid final schema', () => {
        const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
        const s2 = `Z.object({ user: Z.object({ name: Z.string().min(3) }) })`;
        const s3 = `Z.object({ user: Z.object({ name: Z.string().max(10) }) })`;
        const s4 = `Z.object({ user: Z.object({ name: Z.string().ui$label("Name") }) })`;

        const { definition, schema } = parser.parse(s1, s2, s3, s4);
        const nameDef = definition.fields.user.fields.name;

        expect(nameDef.validations.min).toBe(3);
        expect(nameDef.validations.max).toBe(10);
        expect(nameDef.namespaces.ui.label.value).toBe("Name");
        expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should throw a detailed error on type mismatch', () => {
      const s1 = `Z.object({ user: Z.object({ name: Z.string() }) })`;
      const s2 = `Z.object({ user: Z.object({ name: Z.number() }) })`;
      const expectedError = "Type mismatch at schema index 1 for field 'user.name': Cannot merge type 'number' into 'string'.";
      expect(() => parser.parse(s1, s2)).toThrow(new ZontaxMergeError(expectedError));
    });

    it('should throw a detailed error on validation conflict', () => {
      const s1 = `Z.object({ name: Z.string().min(3) })`;
      const s2 = `Z.object({ name: Z.string().min(4) })`;
      const expectedError = "Validation conflict at schema index 1 for field 'name': Mismatch for validation 'min'.";
      expect(() => parser.parse(s1, s2)).toThrow(new ZontaxMergeError(expectedError));
    });
  });

  describe('Zod Method Support', () => {
    const parser = new ZontaxParser();

    it('should support .describe() method', () => {
      const { schema, definition } = parser.parse('Z.string().describe("A user name")');
      expect(schema).toBe('z.string().describe("A user name")');
      expect(definition.description).toBe('A user name');
      expect(definition.type).toBe('string');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() with other methods', () => {
      const { schema, definition } = parser.parse('Z.string().min(3).describe("Username").optional()');
      expect(schema).toBe('z.string().min(3).describe("Username").optional()');
      expect(definition.description).toBe('Username');
      expect(definition.validations.min).toBe(3);
      expect(definition.optional).toBe(true);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() in object fields', () => {
      const { schema, definition } = parser.parse('Z.object({name: Z.string().describe("User full name")})');
      expect(schema).toBe('z.object({ name: z.string().describe("User full name") })');
      expect(definition.fields.name.description).toBe('User full name');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .describe() with validations', () => {
      const { schema, definition } = parser.parse('Z.number().min(0).max(100).describe("Percentage value")');
      expect(schema).toBe('z.number().max(100).min(0).describe("Percentage value")');
      expect(definition.description).toBe('Percentage value');
      expect(definition.validations.min).toBe(0);
      expect(definition.validations.max).toBe(100);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .nullable() method', () => {
      const { schema, definition } = parser.parse('Z.string().nullable()');
      expect(schema).toBe('z.string().nullable()');
      expect(definition.nullable).toBe(true);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .default() method', () => {
      const { schema, definition } = parser.parse('Z.string().default("test")');
      expect(schema).toBe('z.string().default("test")');
      expect(definition.defaultValue).toBe('test');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support number validations (int, positive, negative)', () => {
      const { schema: intSchema } = parser.parse('Z.number().int()');
      expect(intSchema).toBe('z.number().int()');
      expect(() => parseZodString(intSchema)).not.toThrow();

      const { schema: positiveSchema } = parser.parse('Z.number().positive()');
      expect(positiveSchema).toBe('z.number().positive()');
      expect(() => parseZodString(positiveSchema)).not.toThrow();

      const { schema: negativeSchema } = parser.parse('Z.number().negative()');
      expect(negativeSchema).toBe('z.number().negative()');
      expect(() => parseZodString(negativeSchema)).not.toThrow();
    });

    it('should support .enum() method', () => {
      const { schema, definition } = parser.parse('Z.enum(["a", "b", "c"])');
      expect(schema).toBe('z.enum(["a", "b", "c"])');
      expect(definition.type).toBe('enum');
      expect(definition.values).toEqual(['a', 'b', 'c']);
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .literal() method', () => {
      const { schema, definition } = parser.parse('Z.literal("test")');
      expect(schema).toBe('z.literal("test")');
      expect(definition.type).toBe('literal');
      expect(definition.value).toBe('test');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .tuple() method', () => {
      const { schema, definition } = parser.parse('Z.tuple([Z.string(), Z.number()])');
      expect(schema).toBe('z.tuple([z.string(), z.number()])');
      expect(definition.type).toBe('tuple');
      expect(definition.items).toHaveLength(2);
      expect(definition.items[0].type).toBe('string');
      expect(definition.items[1].type).toBe('number');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support .union() method', () => {
      const { schema, definition } = parser.parse('Z.union([Z.string(), Z.number()])');
      expect(schema).toBe('z.union([z.string(), z.number()])');
      expect(definition.type).toBe('union');
      expect(definition.options).toHaveLength(2);
      expect(definition.options[0].type).toBe('string');
      expect(definition.options[1].type).toBe('number');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support complex method chaining', () => {
      const { schema, definition } = parser.parse('Z.string().min(3).max(10).optional().nullable().describe("Name")');
      expect(schema).toBe('z.string().max(10).min(3).describe("Name").nullable().optional()');
      expect(definition.validations.min).toBe(3);
      expect(definition.validations.max).toBe(10);
      expect(definition.optional).toBe(true);
      expect(definition.nullable).toBe(true);
      expect(definition.description).toBe('Name');
      expect(() => parseZodString(schema)).not.toThrow();
    });

    it('should support complex nested structures', () => {
      const { schema } = parser.parse('Z.union([Z.string().email(), Z.literal("admin")])');
      expect(schema).toBe('z.union([z.string().email(), z.literal("admin")])');
      expect(() => parseZodString(schema)).not.toThrow();
    });
  });

  describe('Zod Version Support', () => {
    it('should default to Zod 4', () => {
      const parser = new ZontaxParser();
      const { schema } = parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should support explicit Zod 4', () => {
      const parser = new ZontaxParser({ zodVersion: '4' });
      const { schema } = parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should support explicit Zod 3', () => {
      const parser = new ZontaxParser({ zodVersion: '3' });
      const { schema } = parser.parse('Z.string().describe("test")');
      expect(schema).toBe('z.string().describe("test")');
    });

    it('should generate identical output for basic types in both versions', () => {
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

      basicTypes.forEach(input => {
        const schema3 = parser3.parse(input).schema;
        const schema4 = parser4.parse(input).schema;
        expect(schema3).toBe(schema4);
      });
    });

    it('should generate identical output for complex types in both versions', () => {
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

      complexTypes.forEach(input => {
        const schema3 = parser3.parse(input).schema;
        const schema4 = parser4.parse(input).schema;
        expect(schema3).toBe(schema4);
      });
    });

    it('should generate identical output for method chaining in both versions', () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const chainedMethods = [
        'Z.string().min(3).max(10).optional()',
        'Z.string().email().describe("Email address")',
        'Z.number().int().positive().default(1)',
        'Z.string().min(1).nullable().describe("Name")'
      ];

      chainedMethods.forEach(input => {
        const schema3 = parser3.parse(input).schema;
        const schema4 = parser4.parse(input).schema;
        expect(schema3).toBe(schema4);
      });
    });

    it('should work with extensions in both versions', () => {
      const extensions = [{ name: 'label', allowedOn: ['string'], args: ['string'] }];
      const parser3 = new ZontaxParser({ zodVersion: '3' }, [extensions]);
      const parser4 = new ZontaxParser({ zodVersion: '4' }, [extensions]);

      const input = 'Z.string().label("Name")';
      const schema3 = parser3.parse(input).schema;
      const schema4 = parser4.parse(input).schema;
      
      expect(schema3).toBe('z.string()');
      expect(schema4).toBe('z.string()');
      expect(schema3).toBe(schema4);
    });

    it('should handle nested structures in both versions', () => {
      const parser3 = new ZontaxParser({ zodVersion: '3' });
      const parser4 = new ZontaxParser({ zodVersion: '4' });

      const input = 'Z.object({user: Z.object({name: Z.string().min(1), age: Z.number().int()})})';
      const schema3 = parser3.parse(input).schema;
      const schema4 = parser4.parse(input).schema;
      
      expect(schema3).toBe(schema4);
      expect(schema3).toBe('z.object({ user: z.object({ name: z.string().min(1), age: z.number().int() }) })');
    });
  });

  describe('Modes (Strict vs. Loose)', () => {
    it('should throw in strict mode for unregistered methods', () => {
      const parser = new ZontaxParser({ mode: 'strict' });
      expect(() => parser.parse('Z.string().unregistered()')).toThrow();
    });

    it('should capture loose methods and produce a valid schema', () => {
      const parser = new ZontaxParser({ mode: 'loose' });
      const { definition, schema } = parser.parse('Z.string().author("John").meta$version(2)');
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
    const { definition } = parser.parse(`
        Z.object({
            name: Z.string().ui$label("Name").doc$internalDoc("Doc"),
            age: Z.number().ui$placeholder("Age")
        })
    `);

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
        const looseDef = looseParser.parse(`Z.object({ name: Z.string().ui$label("Name") })`).definition;

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

    it('should allow extension on an exact path match', () => {
        const schema = `Z.object({ user: Z.object({ name: Z.string().test$restricted() }) })`;
        expect(() => parser.parse(schema)).not.toThrow();
    });

    it('should allow extension on a wildcard path match', () => {
        const schema = `Z.object({ user: Z.object({ profile: Z.object({ bio: Z.string().test$restricted() }) }) })`;
        expect(() => parser.parse(schema)).not.toThrow();
    });

    it('should allow extension on a regex path match', () => {
        const schema1 = `Z.object({ user: Z.object({ address: Z.object({ street: Z.string().test$restricted() }) }) })`;
        const schema2 = `Z.object({ user: Z.object({ address: Z.object({ city: Z.string().test$restricted() }) }) })`;
        expect(() => parser.parse(schema1)).not.toThrow();
        expect(() => parser.parse(schema2)).not.toThrow();
    });

    it('should throw an error for a disallowed path', () => {
        const schema = `Z.object({ user: Z.object({ email: Z.string().test$restricted() }) })`;
        expect(() => parser.parse(schema)).toThrow(ZontaxMergeError);
        expect(() => parser.parse(schema)).toThrow("Extension 'test$restricted' is not allowed on path 'user.email'.");
    });

    it('should throw an error for a disallowed regex path', () => {
        const schema = `Z.object({ user: Z.object({ address: Z.object({ country: Z.string().test$restricted() }) }) })`;
        expect(() => parser.parse(schema)).toThrow("Extension 'test$restricted' is not allowed on path 'user.address.country'.");
    });
  });
});