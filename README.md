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
- **Flexible Modes:** Use `strict` mode for production and `loose` mode for rapid development.
- **Helper Utilities:** Includes built-in static methods to easily query and transform the `definition` object.

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
```javascript
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
            "label": { "category": "ui", "value": "Full Name" }
          }
        }
      },
      "id": {
        "type": "string",
        "validations": { "uuid": true },
        "extensions": {
          "analyticsId": { "category": "tracking", "value": "user-id" }
        }
      }
    }
  }
}
```

## Usage & Customization

### Registering Schemas and Namespaces

The `ZontaxParser` constructor accepts an array of schema registrations.

```typescript
import { ZontaxParser, Extension } from 'zontax';

// Define a reusable schema for UI extensions
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'], category: 'ui' },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'], category: 'ui' }
];

// Define a global schema for this project
const trackingSchema: Extension[] = [
  { name: 'analyticsId', allowedOn: ['string'], args: ['string'], category: 'tracking' }
];

// Create a parser instance
const parser = new ZontaxParser([
  // Register uiSchema under the 'ui' namespace
  { namespace: 'ui', extensions: uiSchema },
  
  // Register trackingSchema to the global namespace
  trackingSchema 
]);
```

### Modes

The parser can be configured with a `mode` option:

- **`mode: 'strict'` (Default):** Throws an error for any unregistered method, whether global (`.unregistered()`) or namespaced (`.fake$unregistered()`).
- **`mode: 'loose'`:** Captures any unregistered method and adds it to the `definition` object under the `extra` category.

### Helper Methods

Zontax includes static helper methods to make working with the `definition` object easier.

#### `getDefinitionByNamespace(definition, namespace)`

This method returns a new object containing only the fields that have extensions from the specified namespace.

```typescript
const { definition } = parser.parse(someSchema);
const uiView = ZontaxParser.getDefinitionByNamespace(definition, 'ui');

// uiView will contain only the 'name' and 'age' fields,
// and only their 'ui' extensions.
```

## License
This project is licensed under the ISC License.
