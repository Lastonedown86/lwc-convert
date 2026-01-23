---
name: TypeScript CLI Development
description: Patterns for building TypeScript CLI applications with Commander.js
---

# TypeScript CLI Development Skill

## Core Technologies
- **Commander.js** - CLI argument parsing and command structure
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment

## Command Structure Pattern

```typescript
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('my-cli')
  .description('CLI description')
  .version('1.0.0');

program
  .command('action <input>')
  .description('Command description')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--verbose', 'Verbose logging', false)
  .action(async (input, options) => {
    // Command logic
  });

program.parse(process.argv);
```

## Option Types
- Boolean flags: `--verbose`, `--full`
- Value options: `-o, --output <dir>`
- Optional values: `--config [path]`
- Required: `.requiredOption()`

## Best Practices
1. Use async/await for all file operations
2. Provide helpful error messages with suggestions
3. Support both interactive and non-interactive modes
4. Add `--dry-run` for preview functionality
5. Use consistent exit codes (0=success, 1=error)
