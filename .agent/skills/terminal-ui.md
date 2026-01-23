---
name: Terminal UI Development
description: Building interactive terminal interfaces with Inquirer and Chalk
---

# Terminal UI (TUI) Development Skill

## Core Technologies
- **Inquirer.js** - Interactive prompts
- **Chalk** - Terminal styling
- **ora** - Spinners (optional)
- **cli-table3** - Tables (optional)

## Prompt Patterns

### Selection Menu
```typescript
import inquirer from 'inquirer';

const { selected } = await inquirer.prompt([{
  type: 'list',
  name: 'selected',
  message: 'Choose an option:',
  choices: [
    { name: '⚡ Option A', value: 'a' },
    { name: '📄 Option B', value: 'b' },
    new inquirer.Separator('─────────'),
    { name: '📝 Custom...', value: '__custom__' },
  ],
}]);
```

### Multi-Select Checkbox
```typescript
const { items } = await inquirer.prompt([{
  type: 'checkbox',
  name: 'items',
  message: 'Select items:',
  choices: ['Item 1', 'Item 2', 'Item 3'],
}]);
```

### Validated Input
```typescript
const { path } = await inquirer.prompt([{
  type: 'input',
  name: 'path',
  message: 'Enter path:',
  validate: (input) => {
    if (!input.trim()) return 'Path is required';
    if (!fs.existsSync(input)) return 'Path does not exist';
    return true;
  },
}]);
```

## Styling Patterns

```typescript
import chalk from 'chalk';

// Headers
console.log(chalk.cyan.bold('=== Header ==='));

// Status messages
console.log(chalk.green('✓ Success'));
console.log(chalk.yellow('⚠ Warning'));
console.log(chalk.red('✗ Error'));
console.log(chalk.gray('  Info'));

// Styled boxes
const BANNER = `
${chalk.cyan('╔════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.white.bold('My CLI Tool')}            ${chalk.cyan('║')}
${chalk.cyan('╚════════════════════════════╝')}
`;
```

## Best Practices
1. Always provide escape routes (cancel options)
2. Show summaries before destructive actions
3. Use consistent emoji/icon patterns
4. Keep prompts focused and concise
5. Provide sensible defaults
