# LWC Convert - AI Assistant Instructions

## Project Overview
This is a CLI tool for converting Salesforce legacy components (Aura and Visualforce) to Lightning Web Components (LWC).

## Domain Skills

When working on this project, use these specialized skills for domain-specific knowledge:

| Name | Description | File | Triggers |
|------|-------------|------|----------|
| sf-to-lwc-conversion | Salesforce to LWC conversion patterns, mappings, and best practices | `.agent/skills/sf-to-lwc-conversion.md` | Writing/reviewing conversion code, implementing transformers, mapping Aura/VF syntax to LWC, updating conversion logic |
| typescript-cli | TypeScript CLI development with Commander.js patterns and conventions | `.agent/skills/typescript-cli.md` | Implementing CLI commands, adding command-line options, parsing arguments, CLI error handling |
| terminal-ui | Interactive terminal UI with Inquirer.js and Chalk styling patterns | `.agent/skills/terminal-ui.md` | Building interactive prompts, creating selection menus, adding user input validation, terminal formatting |

## Code Conventions

### File Organization
- **Parsers** (`src/parsers/`): Extract structure from source files
- **Transformers** (`src/transformers/`): Convert parsed structures to LWC
- **Generators** (`src/generators/`): Produce output files
- **CLI** (`src/cli/`): Command-line interface and interactive mode

### Testing
- Use Jest for all tests
- Place tests in `tests/__tests__/` with `.test.ts` extension
- Use fixtures in `tests/fixtures/` for test data

### Output
- Generated LWC components go to `lwc-output/`
- Include conversion notes as `.md` files alongside components
- Generate metadata files (`.js-meta.xml`)

## Development Workflow
1. Changes to parsers/transformers should include tests
2. CLI changes should be tested interactively
3. Run `npm run build` before publishing
4. Update conversion notes when changing transformation logic
