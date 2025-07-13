# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-07-13

### Changed

- **Breaking Change:** The `parse` method's return value `metadata` has been renamed to `definition` to more accurately reflect that it contains the complete, structured schema definition, including both Zod validations and custom extensions.
- Updated `README.md` to reflect the new API and improve documentation clarity.

### Added

- Added a `CHANGELOG.md` file to track project changes.
- Added comprehensive tests to verify that Zod validations (e.g., `.min()`, `.optional()`) are correctly parsed into the `definition` object.
