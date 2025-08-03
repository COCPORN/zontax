import { ZontaxParser } from './index';
const { parseZodString } = require('zod-subset-parser/zod4');

describe('datetime alias support', () => {
  const parser = new ZontaxParser();

  it('should support Z.datetime() as an alias for Z.date()', async () => {
    const { schema, definition } = await parser.parse('Z.datetime()');
    expect(schema).toBe('z.date()');
    expect(definition.type).toBe('date');
    expect(() => parseZodString(schema)).not.toThrow();
  });

  it('should support datetime with validations', async () => {
    const { schema, definition } = await parser.parse('Z.datetime().describe("A datetime field")');
    expect(schema).toBe('z.date().describe("A datetime field")');
    expect(definition.type).toBe('date');
    expect(definition.description).toBe('A datetime field');
    expect(() => parseZodString(schema)).not.toThrow();
  });

  it('should support datetime in objects', async () => {
    const { schema } = await parser.parse('Z.object({ createdAt: Z.datetime(), updatedAt: Z.datetime().optional() })');
    expect(schema).toBe('z.object({ createdAt: z.date(), updatedAt: z.date().optional() })');
    expect(() => parseZodString(schema)).not.toThrow();
  });

  it('should support datetime in unions', async () => {
    const { schema } = await parser.parse('Z.union([Z.string(), Z.datetime()])');
    expect(schema).toBe('z.union([z.string(), z.date()])');
    expect(() => parseZodString(schema)).not.toThrow();
  });

  it('should support datetime in arrays', async () => {
    const { schema } = await parser.parse('Z.array(Z.datetime())');
    expect(schema).toBe('z.array(z.date())');
    expect(() => parseZodString(schema)).not.toThrow();
  });

  it('should support datetime with other date methods', async () => {
    const { schema } = await parser.parse('Z.datetime().describe("Created at").optional()');
    expect(schema).toBe('z.date().describe("Created at").optional()');
    expect(() => parseZodString(schema)).not.toThrow();
  });
});