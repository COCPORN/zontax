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
export interface SchemaRegistrationObject {
    namespace?: string;
    extensions: Extension[];
}
export type SchemaRegistration = Extension[] | SchemaRegistrationObject;
export interface ZontaxParserOptions {
    mode?: 'strict' | 'loose';
    zodVersion?: '3' | '4';
}
export declare class ZontaxParser {
    private globalExtensions;
    private namespacedExtensions;
    private mode;
    private zodVersion;
    constructor(options?: ZontaxParserOptions, registrations?: SchemaRegistration[]);
    private registerGlobal;
    private registerNamespace;
    private buildDefinition;
    private deepMergeDefinitions;
    private generateVersionSpecificMethod;
    private generateSchemaString;
    parse(...sources: string[]): {
        schema: string;
        definition: any;
    };
    getExtensions(): Record<string, Extension[]>;
    static getDefinitionByNamespace(definition: any, namespace: string): Record<string, any>;
    static generateSchemaFromDefinition(definition: any, namespace?: string): Extension[];
}
