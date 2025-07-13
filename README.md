# Zontax

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. It provides a parser that transforms this augmented syntax into two separate, useful outputs:

1.  A **clean Zod schema string** for validation.
2.  A **structured JSON `definition` object** containing all the extracted metadata, perfect for UI generation, documentation, or API behavior.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures.

## Key Features

- **Namespaces:** Register extensions under namespaces (`ui`, `doc`, etc.) to prevent name collisions and organize your schemas.
- **Collaborative Schemas:** The namespace system allows teams and open-source projects to create and share reusable extension libraries.
- **Intuitive Syntax:** Use a clean and visually distinct syntax (`ui$label(...)`) for applying namespaced extensions.
- **Safe & Secure:** Parses your schema definition using an Abstract Syntax Tree (AST), with no reliance on `eval()` or other unsafe code execution.
- **Flexible Modes:** Use `strict` mode for production and `loose` mode for rapid development and schema bootstrapping.
- **Helper Utilities:** Includes built-in static methods to easily query and transform the `definition` object, and even generate new schemas.

## Installation

```bash
pnpm add zontax
# or
npm install zontax
# or
yarn add zontax
```

## How It Works

The `ZontaxParser` takes a string of Zontax code and returns an object containing both the cleaned Zod schema string and the structured `definition`.

**Given this Zontax string:**
```javascript
const schemaString = `
  z.object({
    // A namespaced extension from a 'ui' schema
    name: z.string().min(1).ui$label("Full Name"),

    // A global extension
    id: z.string().uuid().analyticsId("user-id")
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
          "ui": {
            "label": { "value": "Full Name" }
          }
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

## Usage & Customization

### Registering Schemas and Namespaces

The `ZontaxParser` constructor accepts an array of schema registrations. The `Extension` schema is simple and no longer uses `category`.

```typescript
import { ZontaxParser, Extension } from 'zontax';

// Define a reusable schema for UI extensions
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'] },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'] }
];

// Create a parser instance
const parser = new ZontaxParser([
  // Register uiSchema under the 'ui' namespace
  { namespace: 'ui', extensions: uiSchema }
]);
```

### Modes

- **`mode: 'strict'` (Default):** Throws an error for any unregistered method.
- **`mode: 'loose'`:** Captures any unregistered method, making it easy to prototype and evolve schemas.

### Helper Methods

Zontax includes static helper methods to make working with the `definition` object easier.

#### `getDefinitionByNamespace(definition, namespace)`

This method returns a new object containing only the fields that have extensions from the specified namespace.

#### `generateSchemaFromDefinition(definition, namespace?)`

This powerful helper generates a formal `Extension[]` array from a `definition` object created in `loose` mode. This makes it incredibly easy to bootstrap a formal schema from a prototype.

```typescript
const looseParser = new ZontaxParser([], { mode: 'loose' });
const { definition } = looseParser.parse('z.string().ui$label("Name")');

// Generate a schema for the 'ui' namespace
const generatedUiSchema = ZontaxParser.generateSchemaFromDefinition(definition, 'ui');
// Result: [{ name: 'label', allowedOn: ['string'], args: ['string'] }]
```

## License
This project is licensed under the ISC License.