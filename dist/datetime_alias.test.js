"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const { parseZodString } = require('zod-subset-parser/zod4');
describe('datetime alias support', () => {
    const parser = new index_1.ZontaxParser();
    it('should support Z.datetime() as an alias for Z.date()', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema, definition } = yield parser.parse('Z.datetime()');
        expect(schema).toBe('z.date()');
        expect(definition.type).toBe('date');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
    it('should support datetime with validations', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema, definition } = yield parser.parse('Z.datetime().describe("A datetime field")');
        expect(schema).toBe('z.date().describe("A datetime field")');
        expect(definition.type).toBe('date');
        expect(definition.description).toBe('A datetime field');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
    it('should support datetime in objects', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema } = yield parser.parse('Z.object({ createdAt: Z.datetime(), updatedAt: Z.datetime().optional() })');
        expect(schema).toBe('z.object({ createdAt: z.date(), updatedAt: z.date().optional() })');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
    it('should support datetime in unions', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema } = yield parser.parse('Z.union([Z.string(), Z.datetime()])');
        expect(schema).toBe('z.union([z.string(), z.date()])');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
    it('should support datetime in arrays', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema } = yield parser.parse('Z.array(Z.datetime())');
        expect(schema).toBe('z.array(z.date())');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
    it('should support datetime with other date methods', () => __awaiter(void 0, void 0, void 0, function* () {
        const { schema } = yield parser.parse('Z.datetime().describe("Created at").optional()');
        expect(schema).toBe('z.date().describe("Created at").optional()');
        expect(() => parseZodString(schema)).not.toThrow();
    }));
});
