#!/usr/bin/env node

/**
 * lwc-convert - CLI tool to convert Aura and Visualforce components to LWC
 */

import { Command } from 'commander';
import { CLI_NAME, CLI_DESCRIPTION, CLI_VERSION, DEFAULT_OUTPUT_DIR } from './cli/options';
import { convertAura } from './cli/commands/aura';
import { convertVf } from './cli/commands/vf';
import { logger } from './utils/logger';

const program = new Command();

program
  .name(CLI_NAME)
  .description(CLI_DESCRIPTION)
  .version(CLI_VERSION);

// Aura conversion command
program
  .command('aura <path>')
  .description('Convert an Aura component bundle to LWC')
  .option('--full', 'Run full automated conversion (default: scaffolding only)', false)
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('--open', 'Open output folder in file explorer after conversion', false)
  .option('--dry-run', 'Preview conversion without writing files', false)
  .option('--verbose', 'Show detailed conversion logs', false)
  .action(async (bundlePath: string, options) => {
    logger.setVerbose(options.verbose);
    await convertAura(bundlePath, {
      output: options.output,
      full: options.full,
      dryRun: options.dryRun,
      verbose: options.verbose,
      open: options.open,
    });
  });

// Visualforce conversion command
program
  .command('vf <path>')
  .description('Convert a Visualforce page to LWC')
  .option('--full', 'Run full automated conversion (default: scaffolding only)', false)
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('--controller <path>', 'Include Apex controller file for analysis')
  .option('--open', 'Open output folder in file explorer after conversion', false)
  .option('--dry-run', 'Preview conversion without writing files', false)
  .option('--verbose', 'Show detailed conversion logs', false)
  .action(async (pagePath: string, options) => {
    logger.setVerbose(options.verbose);
    await convertVf(pagePath, {
      output: options.output,
      full: options.full,
      dryRun: options.dryRun,
      verbose: options.verbose,
      controller: options.controller,
      open: options.open,
    });
  });

// Examples in help
program.addHelpText('after', `
Examples:
  # Convert Aura component (just use the name!)
  $ ${CLI_NAME} aura AccountCard
  $ ${CLI_NAME} aura AccountCard --full

  # Convert Visualforce page (just use the name!)
  $ ${CLI_NAME} vf ContactList
  $ ${CLI_NAME} vf ContactList --controller ContactListController

  # Full paths also work
  $ ${CLI_NAME} aura ./force-app/main/default/aura/MyComponent
  $ ${CLI_NAME} vf ./pages/MyPage.page --controller ./classes/MyController.cls

  # Preview without writing files
  $ ${CLI_NAME} aura MyComponent --dry-run --verbose

  # Specify output directory
  $ ${CLI_NAME} vf ContactList -o ./src/lwc

Smart Path Resolution:
  The CLI searches common Salesforce project locations automatically:
  - Aura: force-app/main/default/aura/, src/aura/, aura/
  - VF:   force-app/main/default/pages/, src/pages/, pages/
  - Apex: force-app/main/default/classes/, src/classes/, classes/
`);

// Parse and execute
// If no arguments provided, launch interactive TUI
if (process.argv.slice(2).length === 0) {
  // Dynamic import to avoid loading TUI dependencies if not needed
  import('./cli/interactive').then(async ({ runInteractiveTui }) => {
    const answers = await runInteractiveTui();
    
    if (answers) {
      // Execute the conversion based on user selections
      logger.setVerbose(false);
      
      if (answers.conversionType === 'aura') {
        await convertAura(answers.componentPath, {
          output: answers.outputDir,
          full: answers.conversionMode === 'full',
          dryRun: false,
          verbose: false,
          open: answers.openFolder,
        });
      } else {
        await convertVf(answers.componentPath, {
          output: answers.outputDir,
          full: answers.conversionMode === 'full',
          dryRun: false,
          verbose: false,
          controller: answers.controllerPath,
          open: answers.openFolder,
        });
      }
    }
  }).catch((err) => {
    console.error('Failed to start interactive mode:', err.message);
    program.outputHelp();
  });
} else {
  program.parse(process.argv);
}
