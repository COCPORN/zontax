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
const parser = new index_1.ZontaxParser();
function testDateSupport() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { schema } = yield parser.parse('Z.date()');
            console.log('Generated schema:', schema);
            try {
                const zodSchema = parseZodString(schema);
                console.log('✓ Z.date() is now supported by zod-subset-parser!');
                console.log('Parsed schema type:', zodSchema.constructor.name);
            }
            catch (error) {
                console.log('✗ Z.date() is still not supported:', error instanceof Error ? error.message : String(error));
            }
        }
        catch (error) {
            console.log('✗ Zontax failed to parse Z.date():', error instanceof Error ? error.message : String(error));
        }
    });
}
testDateSupport();
