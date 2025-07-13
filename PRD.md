# PRD: Zontax -- Zod Superset Language and Parser

## 🧠 Overview

The Zod Superset Project is a general-purpose, Zod-compatible language and parser system that allows for writing augmented Zod schemas using chainable methods that describe UI metadata, documentation, or other contextual behavior — alongside validation.

The format looks and feels like Zod code, but is parsed into two parts:

- A valid, runtime Zod schema (for tools like Convex or Vercel AI SDK)
- A structured JSON metadata representation (for form generation, docs, agents, etc.)

This dual-mode system is extensible — new chainable methods can be defined declaratively using Zod itself, enabling a plugin-like architecture for domain-specific schema features.

## 🎯 Goals

- Allow developers (and LLMs) to write expressive, declarative Zod-style schemas
- Support both validation and metadata extraction from the same code
- Keep syntax human-readable, LLM-friendly, and safely parsable
- Avoid use of eval or unsafe code execution

Be extensible: allow new methods to be added and described using Zod itself

## 🔤 Syntax Overview

Input (Zod superset code string)

```zontax
z.object({
  name: z.string()
    .min(1)
    .label("Full Name")
    .placeholder("e.g. Alice")
    .widget("text")
    .group("personal"),

  age: z.number()
    .min(0)
    .optional()
    .label("Age")
    .widget("slider")
});
```

## 🛠 Outputs

1. parseZodSchema(source: string) → ZodType

Returns a live Zod schema
Ignores all metadata extensions
Usable directly in Convex, Vercel, etc.

2. extractMetadata(source: string) → JSON

Extracts metadata from supported chainable methods
Output can be used for UI generation, documentation, etc.
Example output:

```json
{
  "type": "object",
  "fields": {
    "name": {
      "type": "string",
      "validations": { "min": 1 },
      "ui": {
        "label": "Full Name",
        "placeholder": "e.g. Alice",
        "widget": "text",
        "group": "personal"
      }
    },
    "age": {
      "type": "number",
      "optional": true,
      "validations": { "min": 0 },
      "ui": {
        "label": "Age",
        "widget": "slider"
      }
    }
  }
}
```

## ✨ Superset Method System

Each extended method (e.g. .label(), .widget()) is:

- Parsed as part of the chain
- Ignored by Zod parser
- Included by metadata parser

Supported methods can be declared dynamically, allowing developers or plugin authors to define new chainable extensions.

## 🧱 Extension Definition via Zod

New chainable methods can be defined using Zod itself:

```ts
const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),        // e.g. ["string", "number"]
  args: z.array(z.string()),             // e.g. ["string"]
  outputGroup: z.string(),               // e.g. "ui", "doc", "analytics"
  description: z.string().optional()
});
```

This allows plugins, config files, or UIs to validate, describe, or register extension methods.

## 📦 Deliverables

- NPM package: zod-superset
- TypeScript source and types
- Core parser (parseZodSchema)
- Metadata extractor (extractMetadata)
- AST structure shared across tools
- Support for registering new extension methods via config or code
- Registry of built-in methods: .label(), .widget(), .placeholder(), etc.
- Full test suite with valid/invalid examples
- Monaco editor mode compatibility (optional, do not include unless explicitly asked)

## 📚 Example Use Cases

- Convex or Vercel apps with server-validated schemas and client-generated forms
- AI agents that generate or update schema code
- Visual form builders or schema editors
- Documentation generators for APIs or UIs
- Future extensions for i18n, auth, analytics, and beyond

## 🛑 Out of Scope (V1)

- Complex logic like .refine(), .transform(), or .lazy()
- Conditional UI rules (e.g. .showIf(...))
- Runtime interactivity or rendering
- Backward-generation of the schema string from Zod

## 🔭 Future Possibilities

- `.showIf("field == value")`` or dependency logic
- describeZodDSL() function that generates a full JSON schema of the current DSL
- Monaco language tools for real-time linting and autocomplete of extension methods
- Companion GUI form-renderer (@zontax/ui?)
- LLM prompt helpers or schema editors

## Reference implementation

A reference implementation of a zod-subset-parser lives in reference-implementation/zod-subset-parser. Create a similar project layout to this with similar tests.
