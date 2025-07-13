# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-07-13

### Changed

- **Breaking Change:** Overhauled the entire API to support namespaces and schema composition.
  - The `ZontaxParser` constructor now accepts an array of schema registrations, which can be global or namespaced.
  - The `definition` object now has a new, more robust structure with top-level `extensions` and `namespaces` properties to prevent name collisions.
- The syntax for applying namespaced extensions is now `namespace$extension(...)`.

### Added

- Added the static helper method `ZontaxParser.getDefinitionByNamespace()` to provide a convenient, category-first view of the definition object.
- Added a comprehensive new test suite to validate the new API, syntax, and output structure.

## [0.3.0] - 2025-07-13

### Added

- Introduced a `mode` option to the `ZontaxParser` constructor.
  - `mode: 'strict'` (Default): Throws an error for unregistered methods.
  - `mode: 'loose'`: Captures unregistered methods under an `extra` category in the `definition` object.

## [0.2.0] - 2025-07-13

### Changed

- **Breaking Change:** The `parse` method's return value `metadata` has been renamed to `definition` to more accurately reflect that it contains the complete, structured schema definition, including both Zod validations and custom extensions.
- Updated `README.md` to reflect the new API and improve documentation clarity.

### Added

- Added a `CHANGELOG.md` file to track project changes.
- Added comprehensive tests to verify that Zod validations (e.g., `.min()`, `.optional()`) are correctly parsed into the `definition` object.
