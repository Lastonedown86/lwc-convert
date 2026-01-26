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
  .option('--preview', 'Generate and open HTML preview of converted component', false)
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
      preview: options.preview,
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
  .option('--preview', 'Generate and open HTML preview of converted component', false)
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
      preview: options.preview,
    });
  });

// Grading command
import { grade } from './cli/commands/grade';

// Dependency graph command
import { analyzeDeps } from './cli/commands/deps';

program
  .command('grade [target]')
  .description('Assess conversion complexity of components')
  .option('-t, --type <type>', 'Component type (aura, vf, both)', 'both')
  .option('-o, --output <file>', 'Output file for report')
  .option('--format <format>', 'Output format (json, console)', 'console')
  .option('--detailed', 'Show detailed breakdown', false)
  .option('--sort-by <field>', 'Sort by (score, complexity, name)')
  .option('--filter <filter>', 'Filter results (e.g., "grade:D,F")')
  .option('--dry-run', 'Run without writing files', false)
  .option('--verbose', 'Show detailed logs', false)
  .action(async (target, options) => {
    logger.setVerbose(options.verbose);
    await grade(target, options);
  });

// Dependency graph command
program
  .command('deps [target]')
  .description('Analyze and visualize component dependencies')
  .option('-t, --type <type>', 'Component type (aura, vf, both)', 'both')
  .option('-o, --output <file>', 'Output file path')
  .option('--format <format>', 'Output format (console, json, mermaid)', 'console')
  .option('--conversion-order', 'Show recommended conversion order', false)
  .option('--focus <component>', 'Focus on specific component and its dependencies')
  .option('--depth <n>', 'Maximum depth to traverse (0 = unlimited)', '0')
  .option('--include-base', 'Include base Lightning components', false)
  .option('--show-orphans', 'Show components with no dependencies', false)
  .option('--circular-only', 'Only show circular dependencies', false)
  .option('--verbose', 'Show detailed analysis logs', false)
  .action(async (target, options) => {
    logger.setVerbose(options.verbose);
    await analyzeDeps(target, {
      type: options.type,
      output: options.output,
      format: options.format,
      conversionOrder: options.conversionOrder,
      focus: options.focus,
      depth: options.depth,
      includeBase: options.includeBase,
      showOrphans: options.showOrphans,
      circularOnly: options.circularOnly,
      verbose: options.verbose,
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

  # Preview the converted UI in your browser
  $ ${CLI_NAME} aura MyComponent --preview
  $ ${CLI_NAME} vf ContactList --preview --full

  # Preview without writing files
  $ ${CLI_NAME} aura MyComponent --dry-run --verbose

  # Specify output directory
  $ ${CLI_NAME} vf ContactList -o ./src/lwc

  # View session data and learned patterns
  $ ${CLI_NAME} session
  $ ${CLI_NAME} session --report
  $ ${CLI_NAME} session --patterns

  # Analyze component dependencies
  $ ${CLI_NAME} deps
  $ ${CLI_NAME} deps --conversion-order
  $ ${CLI_NAME} deps --focus AccountCard
  $ ${CLI_NAME} deps --format mermaid -o deps.md
  $ ${CLI_NAME} deps --format json -o deps.json

Smart Path Resolution:
  The CLI searches common Salesforce project locations automatically:
  - Aura: force-app/main/default/aura/, src/aura/, aura/
  - VF:   force-app/main/default/pages/, src/pages/, pages/
  - Apex: force-app/main/default/classes/, src/classes/, classes/

UI Preview:
  Use --preview to generate a standalone HTML file that shows how your
  converted LWC will look using SLDS styling. Opens in your default browser.

Session Management:
  Conversion data is stored in a temp folder during your session.
  This helps the tool learn from patterns and provide better suggestions.
  Use 'session --report' to see full session statistics.
`);

// Parse and execute
// If no arguments provided, launch interactive TUI
const args = process.argv.slice(2);
const useLegacyTui = process.env.LWC_CONVERT_LEGACY_TUI === '1' || args.includes('--legacy-tui');
const useNewTui = args.includes('--new-tui');

// Remove TUI flags from args before parsing
const filteredArgs = args.filter(arg => arg !== '--legacy-tui' && arg !== '--new-tui');

if (filteredArgs.length === 0) {
  // No arguments - launch interactive TUI
  if (useLegacyTui) {
    // Use legacy @clack/prompts-based TUI
    import('./cli/interactive').then(async ({ runInteractiveTui }) => {
      const answers = await runInteractiveTui();

      if (answers) {
        // Execute the conversion based on user selections
        logger.setVerbose(false);

        if (answers.action === 'grade') {
          if (answers.gradingOptions) {
            await grade(answers.gradingOptions.targetPath, {
              type: answers.gradingOptions.type,
              output: answers.gradingOptions.exportDir,
              format: answers.gradingOptions.exportFormats?.[0],
              detailed: answers.gradingOptions.detailLevel === 'detailed',
              dryRun: false,
              verbose: false
            });
          }
        } else if (answers.conversionType === 'aura' && answers.componentPath) {
          await convertAura(answers.componentPath, {
            output: answers.outputDir || DEFAULT_OUTPUT_DIR,
            full: answers.conversionMode === 'full',
            dryRun: false,
            verbose: false,
            open: !!answers.openFolder,
            preview: !!answers.preview,
          });
        } else if (answers.conversionType === 'vf' && answers.componentPath) {
          await convertVf(answers.componentPath, {
            output: answers.outputDir || DEFAULT_OUTPUT_DIR,
            full: answers.conversionMode === 'full',
            dryRun: false,
            verbose: false,
            controller: answers.controllerPath,
            open: !!answers.openFolder,
            preview: !!answers.preview,
          });
        }
      }
    }).catch((err) => {
      logger.error(`Failed to start interactive mode: ${err.message}`);
      if (err.stack) logger.debug(err.stack);
      program.outputHelp();
    });
  } else {
    // Use new Ink-based TUI (default)
    import('./tui/index.js').then(({ startTui }) => {
      startTui();
    }).catch((err) => {
      logger.error(`Failed to start TUI: ${err.message}`);
      if (err.stack) logger.debug(err.stack);
      // Fallback to legacy TUI
      logger.info('Falling back to legacy interactive mode...');
      import('./cli/interactive').then(async ({ runInteractiveTui }) => {
        await runInteractiveTui();
      });
    });
  }
} else {
  program.parse(process.argv);
}
