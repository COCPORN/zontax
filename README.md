# Zontax

[![NPM version](https://img.shields.io/npm/v/zontax.svg)](https://www.npmjs.com/package/zontax)
[![License](https://img.shields.io/npm/l/zontax.svg)](./LICENSE)

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. It provides a parser that transforms this augmented syntax into two separate, useful outputs from a single function call:

1.  A **clean Zod schema string** for validation.
2.  A **structured JSON object** containing all the extracted metadata for any purpose, such as UI generation, documentation, or API behavior.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures.

## Key Features

- **Unified API:** A single `parse()` method returns both the schema and metadata, ensuring efficiency and a great developer experience.
- **Declarative & Human-Readable:** Write schemas that look and feel like Zod, but with extra descriptive power for any domain.
- **Fully Extensible:** Define your own custom chainable methods using a Zod schema. Add domain-specific metadata for UI hints, documentation, analytics, API contracts, and more.
- **Safe & Secure:** Parses your schema definition using an Abstract Syntax Tree (AST), with no reliance on `eval()` or other unsafe code execution.
- **TypeScript First:** Written in TypeScript, with type definitions included.

## Installation

```bash
pnpm add zontax
# or
npm install zontax
# or
yarn add zontax
```

## How It Works

The `ZontaxParser` takes a string of Zontax code and returns an object containing both the cleaned Zod schema string and the structured metadata.

**Given this Zontax string:**
```javascript
const schemaString = `
  z.object({
    name: z.string()
      .min(1)
      .label("Full Name")         // A UI hint
      .internalDoc("Primary user identifier"), // An internal doc string

    age: z.number()
      .min(0)
      .optional()
      .label("Age")
  })
`;
```

**A single call to `parser.parse(schemaString)` returns:**
```javascript
{
  schema: 'z.object({name:z.string().min(1),age:z.number().min(0).optional()})',
  metadata: {
    type: 'object',
    fields: {
      name: {
        type: 'string',
        validations: { min: 1 },
        ui: { label: 'Full Name' },
        doc: { internalDoc: 'Primary user identifier' }
      },
      age: {
        type: 'number',
        optional: true,
        validations: { min: 0 },
        ui: { label: 'Age' }
      }
    }
  }
}
```
The `schema` string is by design. It avoids the use of `eval()` and allows the clean code to be passed to a dedicated, safe parser (like `zod-subset-parser`) to create a live, usable Zod schema object.

## Usage & Customization

### Registering Extensions

All extensions must conform to the `ExtensionMethodSchema`:

```typescript
import { z } from 'zod';

export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()), // e.g., ["string", "number"]
  args: z.array(z.string()),      // e.g., ["string"]
  category: z.string(),           // e.g., "ui", "doc", "analytics"
  description: z.string().optional()
});
```

### Example: Parsing a Schema

```typescript
import { ZontaxParser, Extension } from 'zontax';
// In a real-world scenario, you would also import a safe schema parser
// import { parseZodString } from 'zod-subset-parser';

// 1. Define the extensions you want to support
const myExtensions: Extension[] = [
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], category: 'ui' },
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'], category: 'doc' }
];

// 2. Create a parser instance
const parser = new ZontaxParser(myExtensions);

// 3. Your Zontax schema string
const schemaString = `
  z.object({
    name: z.string().min(1).label("Full Name").internalDoc("The user's full name"),
    age: z.number().min(0).optional().label("Age")
  })
`;

// 4. Parse the string to get the schema and metadata
const { schema, metadata } = parser.parse(schemaString);

// The `schema` is a clean Zod code string, ready for a safe parser
// const liveSchema = parseZodString(schema);

// The `metadata` contains the structured data from your extensions
console.log(JSON.stringify(metadata, null, 2));

// You can also filter the metadata by category
const { metadata: uiOnlyMetadata } = parser.parse(schemaString, { categories: ['ui'] });
console.log(JSON.stringify(uiOnlyMetadata, null, 2));
```

### Introspection

You can inspect which extensions are registered on a parser instance at any time.

```typescript
const registered = parser.getRegisteredExtensions();
console.log(registered.map(e => e.name)); // ['label', 'internalDoc']
```

## License

This project is licensed under the ISC License.
