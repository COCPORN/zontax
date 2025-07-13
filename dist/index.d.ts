import { z } from 'zod';
export declare class ZontaxMergeError extends Error {
    constructor(message: string);
}
export declare const ExtensionMethodSchema: z.ZodObject<{
    name: z.ZodString;
    allowedOn: z.ZodArray<z.ZodString, "many">;
    args: z.ZodArray<z.ZodString, "many">;
    description: z.ZodOptional<z.ZodString>;
    allowedOnPath: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodType<RegExp, z.ZodTypeDef, RegExp>]>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    allowedOn: string[];
    args: string[];
    description?: string | undefined;
    allowedOnPath?: (string | RegExp)[] | undefined;
}, {
    name: string;
    allowedOn: string[];
    args: string[];
    description?: string | undefined;
    allowedOnPath?: (string | RegExp)[] | undefined;
}>;
export type Extension = z.infer<typeof ExtensionMethodSchema>;
interface SchemaRegistrationObject {
    namespace?: string;
    extensions: Extension[];
}
type SchemaRegistration = Extension[] | SchemaRegistrationObject;
interface ZontaxParserOptions {
    mode?: 'strict' | 'loose';
}
export declare class ZontaxParser {
    private globalExtensions;
    private namespacedExtensions;
    private mode;
    constructor(registrations?: SchemaRegistration[], options?: ZontaxParserOptions);
    private registerGlobal;
    private registerNamespace;
    private buildDefinition;
    private deepMergeDefinitions;
    private generateSchemaString;
    parse(...sources: string[]): {
        schema: string;
        definition: any;
    };
    getExtensions(): Record<string, Extension[]>;
    static getDefinitionByNamespace(definition: any, namespace: string): Record<string, any>;
    static generateSchemaFromDefinition(definition: any, namespace?: string): Extension[];
}
export {};
