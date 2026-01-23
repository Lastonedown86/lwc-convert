# lwc-convert CLI Development

You are helping develop the lwc-convert CLI tool. Use these patterns:

## Project Structure
```
src/
├── index.ts              # CLI entry point (Commander.js)
├── cli/
│   ├── commands/         # Command implementations
│   │   ├── aura.ts       # Aura conversion
│   │   └── vf.ts         # VF conversion
│   ├── interactive.ts    # TUI wizard (@clack/prompts)
│   └── options.ts        # CLI option types
├── parsers/              # Source file parsers
│   ├── aura/             # .cmp, Controller.js, Helper.js
│   └── vf/               # .page, .cls
├── transformers/         # Conversion logic
│   ├── aura-to-lwc/
│   └── vf-to-lwc/
├── generators/           # Output generators
├── mappings/             # Component mapping JSON
└── utils/                # Shared utilities
```

## Adding a New Command
```typescript
// src/cli/commands/new-command.ts
import { NewCommandOptions } from '../options';
import { logger } from '../../utils/logger';

export async function newCommand(
  input: string,
  options: NewCommandOptions
): Promise<void> {
  logger.banner();
  logger.header('New Command');

  try {
    logger.step(1, 'Processing...');
    // Implementation
    logger.success('Done!');
  } catch (error: any) {
    logger.error(error.message);
    process.exit(1);
  }
}
```

## Adding a New Parser
```typescript
// src/parsers/new/parser.ts
export interface ParsedResult {
  // Typed output
}

export function parseNewFormat(content: string): ParsedResult {
  // Parse logic
  return result;
}
```

## Logger Usage
```typescript
logger.banner();                    // ASCII art header
logger.header('Section');           // Bold section header
logger.step(1, 'Description');      // Numbered step
logger.success('Message');          // Green checkmark
logger.warn('Warning');             // Yellow warning
logger.error('Error');              // Red error
logger.file('CREATE', path);        // File operation
logger.summaryBox('Title', items);  // Summary box
logger.nextSteps(['Step 1', ...]);  // Next steps list
```

## Testing
```bash
npm test                           # Run all tests
npm test -- --watch               # Watch mode
npm test -- path/to/test.ts       # Single file
```

## Build & Run
```bash
npm run build                      # Compile TypeScript
node dist/index.js aura Component  # Test locally
npm link                           # Install globally
```

Follow existing patterns in the codebase for consistency.
