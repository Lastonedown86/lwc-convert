#!/usr/bin/env node

/**
 * lwc-convert - CLI tool to convert Aura and Visualforce components to LWC
 */

import { Command } from 'commander';
import { CLI_NAME, CLI_DESCRIPTION, CLI_VERSION, DEFAULT_OUTPUT_DIR } from './cli/options';
import { convertAura } from './cli/commands/aura';
import { convertVf } from './cli/commands/vf';
import { logger } from './utils/logger';
import { sessionStore } from './utils/session-store';

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

// Session management command
program
  .command('session')
  .description('View session information and conversion history')
  .option('--report', 'Generate full session report', false)
  .option('--patterns', 'Show learned patterns from session', false)
  .option('--cleanup', 'Clean up session data', false)
  .action(async (options) => {
    await sessionStore.init();
    const summary = sessionStore.getSessionSummary();
    
    if (options.cleanup) {
      await sessionStore.cleanup();
      logger.success('Session data cleaned up');
      return;
    }
    
    if (options.report) {
      const report = sessionStore.generateSessionReport();
      console.log(report);
      return;
    }
    
    if (options.patterns) {
      logger.header('Session Pattern Library');
      const patterns = summary.patternLibrary;
      if (patterns.length === 0) {
        logger.info('No patterns learned yet. Run some conversions first!');
      } else {
        logger.info(`${patterns.length} patterns learned:`);
        logger.blank();
        for (const pattern of patterns.slice(0, 20)) {
          console.log(`  [${pattern.type}] ${pattern.auraPattern} → ${pattern.lwcPattern}`);
          console.log(`         Used: ${pattern.frequency}x, Success: ${(pattern.successRate * 100).toFixed(0)}%`);
        }
      }
      return;
    }
    
    // Default: show session summary
    logger.banner();
    logger.header('Current Session');
    logger.info(`Session ID: ${summary.sessionId}`);
    logger.info(`Started: ${summary.startedAt.toISOString()}`);
    logger.info(`Conversions: ${summary.conversions}`);
    logger.info(`Behaviors mapped: ${summary.totalBehaviors}`);
    logger.info(`Patterns learned: ${summary.patternLibrary.length}`);
    logger.info(`Session directory: ${sessionStore.getSessionDir()}`);
    
    if (summary.conversions > 0) {
      logger.blank();
      logger.subheader('Recent Conversions:');
      const conversions = sessionStore.getConversions().slice(-5);
      for (const conv of conversions) {
        console.log(`  • ${conv.sourceName} → ${conv.targetName} (${conv.behaviorCount} behaviors)`);
      }
    }
    
    if (summary.commonWarnings.length > 0) {
      logger.blank();
      logger.subheader('Common Warnings:');
      for (const { warning, count } of summary.commonWarnings.slice(0, 5)) {
        console.log(`  [${count}x] ${warning.substring(0, 70)}...`);
      }
    }
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

  # View session data and learned patterns
  $ ${CLI_NAME} session
  $ ${CLI_NAME} session --report
  $ ${CLI_NAME} session --patterns

Smart Path Resolution:
  The CLI searches common Salesforce project locations automatically:
  - Aura: force-app/main/default/aura/, src/aura/, aura/
  - VF:   force-app/main/default/pages/, src/pages/, pages/
  - Apex: force-app/main/default/classes/, src/classes/, classes/

Session Management:
  Conversion data is stored in a temp folder during your session.
  This helps the tool learn from patterns and provide better suggestions.
  Use 'session --report' to see full session statistics.
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
