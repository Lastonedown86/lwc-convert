# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

lwc-convert is a CLI tool for converting Salesforce Aura and Visualforce components to Lightning Web Components (LWC). It supports both scaffolding mode (generates skeleton with TODOs) and full conversion mode (attempts complete transformation).

## Build and Development Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Run directly with ts-node
npm test               # Run all Jest tests
npm test -- --testPathPattern="aura-markup"  # Run single test file
npm run lint           # ESLint check
npm run format         # Prettier formatting
```

## Architecture

The codebase follows a **parser → transformer → generator** pipeline:

```
Source Files → Parsers → Parsed AST → Transformers → Transformed Code → Generators → LWC Bundle
```

### Core Directories

- **`src/parsers/`** - Extract structure from source files
  - `aura/` - Aura component bundle parsers (markup, controller, helper, style)
  - `vf/` - Visualforce parsers (page-parser, apex-parser)

- **`src/transformers/`** - Convert parsed structures to LWC equivalents
  - `aura-to-lwc/` - Aura transformations (markup, controller, events)
  - `vf-to-lwc/` - VF transformations (markup, components, data-binding)

- **`src/generators/`** - Produce output files
  - `scaffolding.ts` - Generates skeleton code with TODO comments
  - `full-conversion.ts` - Generates complete transformed code
  - `test-generator.ts` - Generates Jest tests for converted components

- **`src/cli/`** - Command-line interface
  - `commands/aura.ts`, `commands/vf.ts` - Conversion commands
  - `interactive.ts` - Interactive TUI mode (launches when no args)

- **`src/utils/`** - Shared utilities
  - `session-store.ts` - Persists conversion data and learned patterns
  - `confidence-scorer.ts` - Calculates conversion confidence metrics
  - `path-resolver.ts` - Smart path resolution for Salesforce projects

### Key Types

- `LwcBundle` - Output bundle containing html, js, css, meta files
- `ParsedAuraMarkup` / `ParsedVfPage` - Parsed source structures
- `ConversionConfidence` - Confidence scoring with factors breakdown

## Testing

Tests are in `tests/__tests__/` with fixtures in `tests/fixtures/`. Jest configuration uses ts-jest preset.

```bash
npm test                                      # All tests
npm test -- --watch                           # Watch mode
npm test -- --coverage                        # With coverage
npm test -- -t "should parse attributes"      # By test name
```

## CLI Usage Examples

```bash
# Interactive mode (no arguments)
node dist/index.js

# Aura conversion
node dist/index.js aura AccountCard
node dist/index.js aura AccountCard --full --preview

# Visualforce conversion
node dist/index.js vf ContactList --controller ContactListController

# Session management
node dist/index.js session --report
node dist/index.js session --patterns
```

## Key Conversion Mappings

### Aura → LWC
| Aura | LWC |
|------|-----|
| `{!v.attribute}` | `{property}` |
| `<aura:attribute>` | `@api property` |
| `<aura:handler name="init">` | `connectedCallback()` |
| `<aura:iteration>` | `<template for:each>` |
| `<aura:if>` | `<template lwc:if>` |

### Visualforce → LWC
| VF | LWC |
|----|-----|
| `<apex:inputText>` | `<lightning-input>` |
| `<apex:commandButton>` | `<lightning-button>` |
| `<apex:pageBlockTable>` | `<lightning-datatable>` |
| `{!controller.property}` | `{property}` |

## Output Structure

Generated LWC components are written to `lwc-output/` (configurable via `-o`):

```
lwc-output/
└── componentName/
    ├── componentName.html
    ├── componentName.js
    ├── componentName.css (if styles exist)
    ├── componentName.js-meta.xml
    ├── conversion-notes.md
    └── __tests__/
        └── componentName.test.js
```

## AI Skills Reference

The `.claude/skills/` directory contains domain-specific knowledge:
- `sf-to-lwc-conversion.md` - Conversion patterns and mappings
- `typescript-cli.md` - Commander.js CLI patterns
- `terminal-ui.md` - Inquirer.js and Chalk TUI patterns
- `migration/` - Detailed migration guides (aura-to-lwc, vf-to-lwc)
- `lwc/` - LWC patterns (wire adapters, events, component architecture)
