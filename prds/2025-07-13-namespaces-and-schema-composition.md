# PRD: Zontax Namespaces and Schema Composition

**Date:** 2025-07-13

## 1. Objective

To evolve Zontax from a single-file utility into a scalable, collaborative platform by introducing a robust system for namespacing extensions and composing schemas. This will allow developers to create, share, and consume reusable extension libraries without naming conflicts, paving the way for a rich ecosystem.

## 2. Background

The current version of Zontax is powerful for individual projects but has limitations that hinder its growth:

- **Name Collisions:** All extensions live in a single global namespace, making it impossible to use two extensions with the same name from different sources.
- **Scalability:** As the number of extensions grows, managing them in a flat list becomes cumbersome.
- **Collaboration:** There is no clear mechanism for teams or open-source projects to create and share standardized sets of extensions (e.g., a "bootstrap-ui" or "material-ui" extension pack).

This proposal addresses these issues by introducing a first-class concept of **namespaces**.

## 3. Core Requirements

- **Namespace-based Registration:** Users must be able to register a collection of extensions under a unique namespace.
- **Namespace-based Syntax:** The parser must support a new, intuitive syntax for applying namespaced extensions (e.g., `z.string().ui$label(...)`).
- **Global Namespace:** The parser must continue to support existing "global" extensions for simplicity and backward compatibility.
- **Robust Output:** The `definition` object returned by the parser must be restructured to cleanly separate global extensions from namespaced extensions, preventing any possibility of data collision.
- **Error Handling:** The parser must provide clear error messages for invalid namespaces or extensions.

## 4. Proposed API & Syntax

### 4.1. Extension Definition (Unchanged)

The `Extension` schema itself remains the same.

```typescript
export const ExtensionMethodSchema = z.object({
  name: z.string(),
  allowedOn: z.array(z.string()),
  args: z.array(z.string()),
  category: z.string(),
  description: z.string().optional()
});
```

### 4.2. Parser Initialization

The `ZontaxParser` constructor accepts an array of schema registrations and an optional options object.

**Interface Definitions:**
```typescript
// An object defining a namespaced or global schema
interface SchemaRegistrationObject {
  namespace?: string; // If omitted, extensions are global
  extensions: Extension[];
}

// A registration can be a direct array (for globals) or the object
type SchemaRegistration = Extension[] | SchemaRegistrationObject;

// Parser options
interface ZontaxParserOptions {
  mode?: 'strict' | 'loose';
}
```

**Initialization Examples:**
```typescript
// Define a set of UI extensions
const uiSchema: Extension[] = [
  { name: 'label', allowedOn: ['string'], args: ['string'], category: 'ui' },
  { name: 'placeholder', allowedOn: ['string'], args: ['string'], category: 'ui' }
];

// Define a set of documentation extensions
const docSchema: Extension[] = [
  { name: 'internalDoc', allowedOn: ['string', 'object'], args: ['string'], category: 'doc' }
];

// --- Example 1: Mixed global and namespaced schemas ---
const parser = new ZontaxParser(
  [
    uiSchema, // Registers `label` and `placeholder` to the global namespace
    { namespace: 'doc', extensions: docSchema } // Registers `internalDoc` to the 'doc' namespace
  ],
  { mode: 'loose' }
);

// --- Example 2: Using object notation for globals ---
const parser2 = new ZontaxParser([
  { extensions: uiSchema }, // Also registers to the global namespace
  { namespace: 'doc', extensions: docSchema }
]);
```

### 4.3. Zontax Syntax

The syntax for applying extensions will be updated to support namespaces.

**Zontax String Example:**
```javascript
const zontaxString = `
  z.object({
    // Applying a namespaced extension
    firstName: z.string().min(1).ui$label("First Name"),

    // Applying a global extension
    email: z.string().email().analyticsId("user-email-field"),

    // Applying multiple extensions from different namespaces
    bio: z.string().optional().ui$placeholder("Tell us about yourself").doc$internalDoc("User's biography")
  })
`;
```

## 5. Proposed Output Structure

The `definition` object will be restructured to cleanly separate global and namespaced extensions.

**Output `definition` Example:**
```json
{
  "type": "object",
  "fields": {
    "firstName": {
      "type": "string",
      "validations": { "min": 1 },
      "namespaces": {
        "ui": {
          "label": {
            "category": "ui",
            "value": "First Name"
          }
        }
      }
    },
    "email": {
      "type": "string",
      "validations": { "email": true },
      "extensions": {
        "analyticsId": {
          "category": "tracking",
          "value": "user-email-field"
        }
      }
    },
    "bio": {
      "type": "string",
      "optional": true,
      "namespaces": {
        "ui": {
          "placeholder": {
            "category": "ui",
            "value": "Tell us about yourself"
          }
        },
        "doc": {
          "internalDoc": {
            "category": "doc",
            "value": "User's biography"
          }
        }
      }
    }
  }
}
```
This structure is highly predictable and prevents any possibility of name collisions between namespaces, global extensions, or core Zod properties.

## 6. Non-Goals

- **Dynamic Registration:** This proposal focuses on initializing the parser with a static set of schemas. Dynamically adding or removing namespaces after initialization is not in scope for this iteration.
- **Nested Namespaces:** We will only support a single level of namespacing (e.g., `ui$label`). Nested namespaces (e.g., `ui$forms$label`) are not in scope.
- **Cross-Schema Dependencies:** The ability for one extension schema to depend on another is out of scope.

This PRD provides a solid foundation for the next major evolution of Zontax.
