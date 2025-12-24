import { z } from "zod";
export declare class ZontaxMergeError extends Error {
    constructor(message: string);
}
export declare const ExtensionMethodSchema: z.ZodObject<{
    name: z.ZodString;
    allowedOn: z.ZodArray<z.ZodString, "many">;
    args: z.ZodArray<z.ZodString, "many">;
    description: z.ZodOptional<z.ZodString>;
    allowedOnPath: z.ZodEffects<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodType<RegExp, z.ZodTypeDef, RegExp>]>, "many">>, (string | RegExp)[] | undefined, (string | RegExp)[] | undefined>;
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
    mode?: "strict" | "loose";
    zodVersion?: "3" | "4";
    maxInputLength?: number;
    parseTimeout?: number;
}
/** Base properties shared by all definition types */
export interface ZontaxDefinitionBase {
    type: string;
    optional?: boolean;
    nullable?: boolean;
    defaultValue?: unknown;
    description?: string;
    validations?: ZontaxValidations;
    extensions?: Record<string, {
        value: unknown;
    }>;
    namespaces?: Record<string, Record<string, {
        value: unknown;
    }>>;
}
/** Validation constraints that can be applied to types */
export interface ZontaxValidations {
    min?: number;
    max?: number;
    length?: number;
    email?: boolean;
    url?: boolean;
    uuid?: boolean;
    int?: boolean;
    positive?: boolean;
    negative?: boolean;
}
/** Primitive types: string, number, boolean, date, bigint, symbol, null, undefined, void, any, unknown, never */
export interface ZontaxPrimitiveDefinition extends ZontaxDefinitionBase {
    type: "string" | "number" | "boolean" | "date" | "bigint" | "symbol" | "null" | "undefined" | "void" | "any" | "unknown" | "never";
}
/** Object type with named fields */
export interface ZontaxObjectDefinition extends ZontaxDefinitionBase {
    type: "object";
    fields: Record<string, ZontaxDefinition>;
}
/** Array type with element schema */
export interface ZontaxArrayDefinition extends ZontaxDefinitionBase {
    type: "array";
    of: ZontaxDefinition;
}
/** Enum type with allowed values */
export interface ZontaxEnumDefinition extends ZontaxDefinitionBase {
    type: "enum";
    values: unknown[];
}
/**
 * Literal type with a single allowed value.
 * IMPORTANT: The value is stored in the `value` property, NOT `literal`.
 */
export interface ZontaxLiteralDefinition extends ZontaxDefinitionBase {
    type: "literal";
    /** The literal value. Access via `.value`, NOT `.literal` */
    value: unknown;
}
/** Tuple type with ordered item schemas */
export interface ZontaxTupleDefinition extends ZontaxDefinitionBase {
    type: "tuple";
    items: ZontaxDefinition[];
}
/** Union type with multiple options */
export interface ZontaxUnionDefinition extends ZontaxDefinitionBase {
    type: "union";
    options: ZontaxDefinition[];
}
/** Record type with key and value schemas */
export interface ZontaxRecordDefinition extends ZontaxDefinitionBase {
    type: "record";
    keySchema: ZontaxDefinition;
    valueSchema: ZontaxDefinition;
}
/** Union of all possible definition types */
export type ZontaxDefinition = ZontaxPrimitiveDefinition | ZontaxObjectDefinition | ZontaxArrayDefinition | ZontaxEnumDefinition | ZontaxLiteralDefinition | ZontaxTupleDefinition | ZontaxUnionDefinition | ZontaxRecordDefinition;
/** Result returned by ZontaxParser.parse() */
export interface ZontaxParseResult {
    /** The generated Zod schema string */
    schema: string;
    /** The parsed definition structure */
    definition: ZontaxDefinition;
}
export declare function isObjectDefinition(def: ZontaxDefinition): def is ZontaxObjectDefinition;
export declare function isArrayDefinition(def: ZontaxDefinition): def is ZontaxArrayDefinition;
export declare function isEnumDefinition(def: ZontaxDefinition): def is ZontaxEnumDefinition;
export declare function isLiteralDefinition(def: ZontaxDefinition): def is ZontaxLiteralDefinition;
export declare function isTupleDefinition(def: ZontaxDefinition): def is ZontaxTupleDefinition;
export declare function isUnionDefinition(def: ZontaxDefinition): def is ZontaxUnionDefinition;
export declare function isRecordDefinition(def: ZontaxDefinition): def is ZontaxRecordDefinition;
export declare class ZontaxParser {
    private globalExtensions;
    private namespacedExtensions;
    private mode;
    private zodVersion;
    private maxInputLength;
    private parseTimeout;
    constructor(options?: ZontaxParserOptions, registrations?: SchemaRegistration[]);
    private registerGlobal;
    private registerNamespace;
    private validateInput;
    private validateInputStructure;
    private validateComplexStructure;
    private hasBalancedDelimiters;
    private calculateDelimiterDepth;
    /**
     * Escape actual newline characters inside string literals.
     * JavaScript doesn't allow unescaped newlines in regular string literals,
     * but schema definitions stored in databases may contain them.
     * Note: Template literals (backticks) DO allow newlines, so we don't escape those.
     */
    private escapeNewlinesInStrings;
    private parseWithTimeout;
    private validateASTStructure;
    private calculateASTComplexity;
    private validateASTNodes;
    private validateASTNode;
    private validateDefinition;
    private validateRegExpPattern;
    private analyzeRegExpComplexity;
    private calculateNestingDepth;
    private buildDefinition;
    private generateSafeValue;
    private deepClone;
    private deepMergeDefinitions;
    private generateVersionSpecificMethod;
    private generateSchemaString;
    parse(...sources: string[]): Promise<ZontaxParseResult>;
    getExtensions(): Record<string, Extension[]>;
    static getDefinitionByNamespace(definition: any, namespace: string): Record<string, any>;
    static generateSchemaFromDefinition(definition: any, namespace?: string): Extension[];
}
