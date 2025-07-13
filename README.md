# Zontax

[![NPM version](https://img.shields.io/npm/v/zontax.svg)](https://www.npmjs.com/package/zontax)
[![License](https://img.shields.io/npm/l/zontax.svg)](./LICENSE)

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. It provides a parser that can transform this augmented syntax into two separate, useful outputs:

1.  A **standard, runtime Zod schema** for validation.
2.  A **structured JSON object** containing all the extracted metadata for any purpose, such as UI generation, documentation, API behavior, or agent-driven tooling.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures.

## Key Features

- **Declarative & Human-Readable:** Write schemas that look and feel like Zod, but with extra descriptive power for any domain.
- **Dual Output:** Generate both a validation schema and a metadata object from the same source code.
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

Zontax parses a Zod-like string into an AST and then allows you to process that tree to extract what you need.

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

**You can get two outputs:**

**1. A valid Zod schema string:**
```javascript
z.object({
  name: z.string().min(1),
  age: z.number().min(0).optional()
})
```

**2. A structured metadata object:**
```json
{
  "type": "object",
  "fields": {
    "name": {
      "type": "string",
      "validations": { "min": 1 },
      "ui": { "label": "Full Name" },
      "doc": { "internalDoc": "Primary user identifier" }
    },
    "age": {
      "type": "number",
      "optional": true,
      "validations": { "min": 0 },
      "ui": { "label": "Age" }
    }
  }
}
```

## Usage & Customization

The power of Zontax comes from its configurable parser. You define what custom methods are allowed and how their metadata should be grouped.

### Registering Extensions

All extensions must conform to the `ExtensionMethodSchema`:

```typescript
import { z } from 'zod';

export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()), // e.g., ["string", "number"]
  args: z.array(z.string()),      // e.g., ["string"]
  outputGroup: z.string(),        // e.g., "ui", "doc", "analytics"
  description: z.string().optional()
});
```

### Example: Parsing with UI and Doc Extensions

```typescript
import { ZontaxParser, Extension } from 'zontax';

// 1. Define the extensions you want to support
const myExtensions: Extension[] = [
  // UI-related extensions
  { name: 'label', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  { name: 'widget', allowedOn: ['string', 'number'], args: ['string'], outputGroup: 'ui' },
  // Documentation-related extension
  { name: 'internalDoc', allowedOn: ['string', 'number', 'object'], args: ['string'], outputGroup: 'doc' }
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

// 4. Parse it!
const zodCode = parser.parseZodSchema(schemaString);
const metadata = parser.extractMetadata(schemaString);

console.log(zodCode);
console.log(JSON.stringify(metadata, null, 2));
```

## License

This project is licensed under the ISC License.
