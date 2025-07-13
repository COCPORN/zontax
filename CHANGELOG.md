# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.0] - 2025-07-13

### Changed
- Renamed `getRegistrations()` to `getExtensions()` for clarity.
- Updated documentation for `allowedOnPath` and `getExtensions`.

## [0.10.0] - 2025-07-13

### Added
- Added the `getExtensions()` method for inspecting the parser's configuration.

## [0.9.0] - 2025-07-13

### Added
- Added `allowedOnPath` to the `ExtensionMethodSchema` to allow for path-based validation of extensions, with support for both string and RegExp patterns.

### Changed
- Improved error messages for merge conflicts to include the schema index and field path.

### Fixed
- Added more comprehensive tests for multi-schema composition and error message validation.

## [0.6.0] - 2025-07-13

### Changed
- **Breaking Change:** The root identifier for all Zontax schemas has been changed from `z` to `Z` to create a distinct brand identity and prevent tooling conflicts.

## [0.5.0] - 2025-07-13

### Changed
- **Breaking Change:** The `parse` method now accepts multiple schema strings (`parse(...sources: string[])`) and acts as a composition engine.
- **Breaking Change:** The internal parsing logic has been completely rewritten to support the new "Intelligent Deep Merge" strategy.

### Added
- The parser now intelligently merges multiple schemas, combining extensions and adding validations.
- The parser now throws a `ZontaxMergeError` on type or validation conflicts.
- The parser now generates the final schema string from the *merged* definition, ensuring it reflects the complete set of validations.

## [0.4.0] - 2025-07-13

### Changed

- **Breaking Change:** Overhauled the entire API to support namespaces and a simpler, more robust data structure.
  - The `category` property has been removed from the `ExtensionMethodSchema` in favor of namespaces.
  - The `ZontaxParser` constructor now accepts a more flexible array of schema registrations.
  - The `definition` object now has a cleaner, category-less structure.
- The syntax for applying namespaced extensions is now `namespace$extension(...)`.

### Added

- Added the static helper method `ZontaxParser.generateSchemaFromDefinition()` to bootstrap formal schemas from a `definition` object created in `loose` mode.
- Added the static helper method `ZontaxParser.getDefinitionByNamespace()` to provide a convenient, namespace-first view of the definition object.

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
