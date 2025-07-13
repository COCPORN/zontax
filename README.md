# Zontax

Zontax is a powerful superset of the Zod schema language that allows you to embed arbitrary metadata directly within your schema definitions. It provides a parser that transforms and composes multiple schema strings into two separate, useful outputs:

1.  A **clean, merged Zod schema string** for validation.
2.  A **structured JSON `definition` object** containing all the extracted metadata, perfect for UI generation, documentation, or API behavior.

This allows you to maintain a single source of truth for both data validation and any contextual information attached to your data structures, even when those concerns are separated across different files or modules.

## Key Features

- **Schema Composition:** Intelligently deep-merge multiple schema strings into a single, unified definition.
- **Conflict Detection:** Automatically throws an error on conflicting types or validations during a merge, ensuring schema integrity.
- **Namespaces:** Register extensions under namespaces (`ui`, `doc`, etc.) to prevent name collisions and organize your schemas.
- **Intuitive Syntax:** Use a clean and visually distinct syntax (`ui$label(...)`) for applying namespaced extensions.
- **Flexible Modes:** Use `strict` mode for production and `loose` mode for rapid development and schema bootstrapping.
- **Helper Utilities:** Includes built-in static methods to easily query the `definition` object and generate new schemas from it.

## Installation

```bash
pnpm add zontax
# or
npm install zontax
# or
yarn add zontax
```

## How It Works: Composition

The `ZontaxParser` can take multiple schema strings and merge them intelligently.

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

The `ZontaxParser` constructor accepts an array of schema registrations.

```typescript
import { ZontaxParser, Extension } from 'zontax';

const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'] },
];

const parser = new ZontaxParser([
  { namespace: 'ui', extensions: uiSchema }
]);
```

### Helper Methods

Zontax includes static helper methods to make working with the `definition` object easier.

#### `generateSchemaFromDefinition(definition, namespace?)`

This powerful helper generates a formal `Extension[]` array from a `definition` object created in `loose` mode. This makes it incredibly easy to bootstrap a formal schema from a prototype.

## License
This project is licensed under the ISC License.
