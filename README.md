# Zontax

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. It provides a parser that transforms and composes multiple schema strings into two separate, useful outputs:

1.  A **clean, merged Zod schema string** (using lowercase `z`) for validation.
2.  A **structured JSON `definition` object** containing all the extracted metadata, perfect for UI generation, documentation, or API behavior.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures.

## Key Features

- **Distinct Syntax:** Uses a capital `Z` (`Z.object`) to clearly distinguish Zontax schemas from standard Zod schemas.
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
const parser = new ZontaxParser([/* ...registrations */]);
const { schema, definition } = parser.parse(baseSchema, uiSchema);
```

**Result:**
- `schema`: `"z.object({ username: z.string().min(3) })"`
- `definition`: A merged object containing both the `min(3)` validation and the `ui$label` extension.

## Usage & Customization

### Registering Schemas and Namespaces

The `ZontaxParser` constructor accepts an array of schema registrations. The `Extension` schema allows for powerful, self-documenting validation rules.

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
const parser = new ZontaxParser([
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

### Helper Methods

Zontax includes static helper methods to make working with the `definition` object easier.

#### `generateSchemaFromDefinition(definition, namespace?)`

This powerful helper generates a formal `Extension[]` array from a `definition` object created in `loose` mode. This makes it incredibly easy to bootstrap a formal schema from a prototype.

## License
This project is licensed under the ISC License.