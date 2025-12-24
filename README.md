# Zontax

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. The code usecase is to be able to store schemas as *data*, not *code*. It provides a parser that transforms and composes multiple schema strings into two separate, useful outputs:

1.  A **clean, merged Zod schema string** (using lowercase `z`) for validation.
2.  A **structured JSON `definition` object** containing all the extracted metadata, perfect for UI generation, documentation, or API behavior.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures.

## Key Features

- **Distinct Syntax:** Uses a capital `Z` (`Z.object`) to clearly distinguish Zontax schemas from standard Zod schemas.
- **Multi-Version Support:** Write once, target any Zod version - generate compatible schemas for both Zod 3 and Zod 4.
- **Complete Zod Method Coverage:** Supports all 22 standard Zod methods including complex types like `enum`, `tuple`, `union`, and `literal`.
- **Namespaces:** Register extensions under namespaces (`ui`, `doc`, etc.) to prevent name collisions and organize your schemas.
- **Schema Composition:** Intelligently deep-merge multiple schema strings into a single, unified definition.
- **Conflict Detection:** Automatically throws an error on conflicting types or validations during a merge.
- **Flexible Modes:** Use `strict` mode for production and `loose` mode for rapid development.
- **Helper Utilities:** Includes built-in static methods to query the `definition` object and generate new schemas from it.

## Installation

```bash
pnpm add zontax
# or
npm install zontax
# or
yarn add zontax
```

## How It Works: A Simple Example

The `ZontaxParser` takes a Zontax string (using `Z.`) and returns a standard Zod string (using `z.`) and a structured `definition` object.

**Given this Zontax string:**
```javascript
const schemaString = `
  Z.object({
    name: Z.string().min(1).ui$label("Full Name"),
    id: Z.string().uuid().analyticsId("user-id")
  })
`;
```

**A single call to `parser.parse(schemaString)` returns:**
```json
{
  "schema": "z.object({ name: z.string().min(1), id: z.string().uuid() })",
  "definition": {
    "type": "object",
    "fields": {
      "name": {
        "type": "string",
        "validations": { "min": 1 },
        "namespaces": {
          "ui": { "label": { "value": "Full Name" } }
        }
      },
      "id": {
        "type": "string",
        "validations": { "uuid": true },
        "extensions": {
          "analyticsId": { "value": "user-id" }
        }
      }
    }
  }
}
```

## Schema Composition

A key feature of Zontax is its ability to compose multiple schemas. The `parse` method accepts multiple strings and merges them using an "Intelligent Deep Merge" strategy.

**`base.schema.js`**
```javascript
const baseSchema = `Z.object({ username: Z.string().min(3) })`;
```

**`ui.schema.js`**
```javascript
const uiSchema = `Z.object({ username: Z.string().ui$label("Username") })`;
```

**Composition:**
```javascript
import { ZontaxParser } from 'zontax';
const parser = new ZontaxParser({}, [/* ...registrations */]);
const { schema, definition } = parser.parse(baseSchema, uiSchema);
```

**Result:**
- `schema`: `"z.object({ username: z.string().min(3) })"`
- `definition`: A merged object containing both the `min(3)` validation and the `ui$label` extension.

## Zod Version Support

One of Zontax's most powerful features is its ability to generate compatible schemas for different Zod versions. This is particularly useful for teams migrating between Zod versions or maintaining multiple codebases.

### Usage

```typescript
import { ZontaxParser } from 'zontax';

// Default (Zod 4)
const parser = new ZontaxParser();

// Explicit Zod 4
const parser4 = new ZontaxParser([], { zodVersion: '4' });

// Explicit Zod 3
const parser3 = new ZontaxParser([], { zodVersion: '3' });
```

### Example: Single Schema, Multiple Targets

```typescript
const userSchema = `
  Z.object({
    name: Z.string().min(1).describe('Full name'),
    email: Z.string().email(),
    role: Z.enum(['admin', 'user']).default('user'),
    metadata: Z.object({
      createdAt: Z.date(),
      tags: Z.array(Z.string()).optional()
    }).optional()
  })
`;

const legacyParser = new ZontaxParser({ zodVersion: '3' });
const modernParser = new ZontaxParser({ zodVersion: '4' });

const legacyZod = legacyParser.parse(userSchema).schema;
const modernZod = modernParser.parse(userSchema).schema;

// Both schemas are functionally identical and work with their respective Zod versions!
// The team can maintain one Zontax schema and deploy to both codebases.
```

### Supported Zod Methods

Zontax supports all 22 standard Zod methods across both versions:

**Basic Types:** `string`, `number`, `boolean`, `date`  
**Validations:** `min`, `max`, `length`, `email`, `url`, `uuid`, `int`, `positive`, `negative`  
**Modifiers:** `optional`, `nullable`, `default`, `describe`  
**Complex Types:** `object`, `array`, `enum`, `literal`, `tuple`, `union`

## Usage & Customization

### Registering Schemas and Namespaces

The `ZontaxParser` constructor accepts an array of schema registrations and optional configuration. The `Extension` schema allows for powerful, self-documenting validation rules.

```typescript
import { ZontaxParser, Extension } from 'zontax';

const uiSchema: Extension[] = [
  { 
    name: 'label', 
    allowedOn: ['string'], 
    args: ['string'],
    // Restrict this extension to specific paths
    allowedOnPath: [
        'user.name', // Exact match
        'user.profile.*', // Wildcard match for direct children
        /^user\.address\.(street|city)$/ // RegExp for advanced matching
    ]
  },
];

// Register uiSchema under the 'ui' namespace
const parser = new ZontaxParser({
  mode: 'strict',      // or 'loose' for development
  zodVersion: '4'      // or '3' for legacy support
}, [
  { namespace: 'ui', extensions: uiSchema }
]);
```

### Introspection

You can inspect the parser's configuration at any time.

#### `getExtensions()`
Returns a map of all registered extensions, keyed by their namespace. Global extensions are stored under the `_global` key.

```typescript
const extensions = parser.getExtensions();
// { _global: [...], ui: [...] }
```

### Parser Configuration Options

The `ZontaxParser` constructor accepts these options:

```typescript
interface ZontaxParserOptions {
  mode?: 'strict' | 'loose';     // Default: 'strict'
  zodVersion?: '3' | '4';         // Default: '4'
}
```

- **`mode`**: In `strict` mode, unregistered extensions throw errors. In `loose` mode, they're captured for later introspection.
- **`zodVersion`**: Specifies the target Zod version for generated schemas.

### Helper Methods

Zontax includes static helper methods to make working with the `definition` object easier.

#### `generateSchemaFromDefinition(definition, namespace?)`

This powerful helper generates a formal `Extension[]` array from a `definition` object created in `loose` mode. This makes it incredibly easy to bootstrap a formal schema from a prototype.

## Recent Improvements

### v0.15.0 - Complete Zod Method Coverage & Multi-Version Support

- **🎯 Complete Zod Method Coverage**: All 22 standard Zod methods now fully supported
  - Fixed `nullable`, `default`, `int`, `positive`, `negative` methods
  - Enhanced complex type support for `enum`, `literal`, `tuple`, `union`
  - Improved argument parsing for array-based methods
  
- **🔄 Multi-Version Support**: Write once, target any Zod version
  - Single Zontax syntax generates compatible schemas for both Zod 3 and 4
  - Seamless migration support for teams upgrading between versions
  - Future-proof architecture for upcoming Zod releases

- **🐛 Bug Fixes**: 
  - Fixed object property parsing for quoted keys (e.g., `{'summary': Z.string()}`)
  - Enhanced `.describe()` method forwarding to generated schemas
  - Improved type inference and validation handling

- **📚 Enhanced Documentation**: Updated README with comprehensive examples and usage patterns

## License
This project is licensed under the ISC License.
