/**
 * Visualforce to LWC conversion command
 */

import * as path from 'path';
import { VfConversionOptions } from '../options';
import { readVfPage, writeLwcBundle, writeConversionNotes } from '../../utils/file-io';
import { logger } from '../../utils/logger';
import { parseVfPage } from '../../parsers/vf/page-parser';
import { parseApexController } from '../../parsers/vf/apex-parser';
import { transformVfMarkup } from '../../transformers/vf-to-lwc/markup';
import { generateVfScaffolding } from '../../generators/scaffolding';
import { generateVfFullConversion } from '../../generators/full-conversion';
import { resolveVfPath, resolveApexPath, formatSearchLocations } from '../../utils/path-resolver';

export async function convertVf(
  inputPath: string,
  options: VfConversionOptions
): Promise<void> {
  // Resolve the VF page path (supports just page name)
  const resolved = await resolveVfPath(inputPath);
  
  if (!resolved.found) {
    logger.error(`Page not found: ${inputPath}`);
    if (resolved.searchedLocations && resolved.searchedLocations.length > 0) {
      logger.subheader('Searched in:');
      console.log(formatSearchLocations(resolved.searchedLocations, process.cwd()));
    }
    logger.blank();
    logger.info('Tip: You can provide just the page name (e.g., "ContactList")');
    logger.info('     or a full path (e.g., "./force-app/main/default/pages/ContactList.page")');
    process.exit(1);
  }

  const pagePath = resolved.path;

  // Resolve controller path if provided
  let controllerPath = options.controller;
  if (controllerPath) {
    const resolvedController = await resolveApexPath(controllerPath);
    if (!resolvedController.found) {
      logger.warn(`Controller not found: ${controllerPath}`);
      if (resolvedController.searchedLocations && resolvedController.searchedLocations.length > 0) {
        logger.subheader('Searched in:');
        console.log(formatSearchLocations(resolvedController.searchedLocations, process.cwd()));
      }
      logger.info('Continuing without controller analysis...');
      logger.blank();
      controllerPath = undefined;
    } else {
      controllerPath = resolvedController.path;
    }
  }

  // Update options with resolved controller path
  // Controller path is used directly below

  // Show banner and conversion info
  logger.banner();
  logger.header('Visualforce → LWC Conversion');
  logger.info(`Source: ${pagePath}`);
  logger.info(`Mode: ${options.full ? 'Full Conversion' : 'Scaffolding'}`);
  logger.info(`Output: ${options.output}`);
  if (controllerPath) {
    logger.info(`Controller: ${controllerPath}`);
  }
  if (options.dryRun) {
    logger.warn('Dry run mode - no files will be written');
  }
  logger.divider();

  try {
    // Step 1: Read VF page
    logger.step(1, 'Reading Visualforce page...');
    const vfPage = await readVfPage(pagePath, controllerPath);
    logger.success(`Read page: ${vfPage.name}`);

    // Step 2: Parse VF markup
    logger.step(2, 'Parsing Visualforce markup...');
    const parsedPage = parseVfPage(vfPage.markup, vfPage.name);
    logger.success(
      `Parsed ${parsedPage.components.length} components, ${parsedPage.expressions.length} expressions`
    );

    // Log page attributes
    if (parsedPage.pageAttributes.controller) {
      logger.info(`  Controller: ${parsedPage.pageAttributes.controller}`);
    }
    if (parsedPage.pageAttributes.standardController) {
      logger.info(`  Standard Controller: ${parsedPage.pageAttributes.standardController}`);
    }
    if (parsedPage.pageAttributes.extensions) {
      logger.info(`  Extensions: ${parsedPage.pageAttributes.extensions.join(', ')}`);
    }

    // Step 3: Parse Apex controller (if provided or detected)
    let parsedController;
    if (vfPage.controller) {
      logger.step(3, 'Parsing Apex controller...');
      parsedController = parseApexController(vfPage.controller);
      logger.success(
        `Parsed ${parsedController.properties.length} properties, ${parsedController.methods.length} methods`
      );

      // Log useful info
      const auraEnabled = parsedController.methods.filter((m) => m.isAuraEnabled);
      const remoteActions = parsedController.methods.filter((m) => m.isRemoteAction);
      if (auraEnabled.length > 0) {
        logger.info(`  @AuraEnabled methods: ${auraEnabled.map((m) => m.name).join(', ')}`);
      }
      if (remoteActions.length > 0) {
        logger.info(`  @RemoteAction methods: ${remoteActions.map((m) => m.name).join(', ')}`);
      }
    } else {
      logger.step(3, 'No Apex controller provided');
      if (parsedPage.pageAttributes.controller) {
        logger.warn(
          `Page references controller "${parsedPage.pageAttributes.controller}" - provide with --controller flag for better conversion`
        );
      }
    }

    // Step 4: Log page analysis
    logger.step(4, 'Analyzing page structure...');
    if (parsedPage.actionFunctions.length > 0) {
      logger.info(`  Action functions: ${parsedPage.actionFunctions.map((af) => af.name).join(', ')}`);
    }
    if (parsedPage.remoteActions.length > 0) {
      logger.info(
        `  Remote actions: ${parsedPage.remoteActions.map((ra) => `${ra.controller}.${ra.method}`).join(', ')}`
      );
    }
    if (parsedPage.rerenderedSections.length > 0) {
      logger.info(`  Rerendered sections: ${parsedPage.rerenderedSections.join(', ')}`);
    }
    if (parsedPage.includedScripts.length > 0) {
      logger.info(`  Included scripts: ${parsedPage.includedScripts.length}`);
    }

    // Step 5: Transform and generate
    logger.step(5, options.full ? 'Generating full conversion...' : 'Generating scaffolding...');

    let result;
    if (options.full) {
      result = generateVfFullConversion(parsedPage, parsedController);
    } else {
      const transformedMarkup = transformVfMarkup(parsedPage);
      result = generateVfScaffolding(parsedPage, transformedMarkup, parsedController);
    }

    logger.success(`Generated LWC: ${result.bundle.name}`);

    // Step 6: Write output
    logger.step(6, 'Writing output files...');
    const outputDir = path.resolve(options.output);
    const writtenFiles = await writeLwcBundle(outputDir, result.bundle, options.dryRun);

    // Write conversion notes
    if (result.notes.length > 0) {
      await writeConversionNotes(outputDir, result.bundle.name, result.notes, options.dryRun);
    }

    logger.divider();
    logger.success('Conversion complete!');

    // Summary box with key info
    logger.summaryBox('Conversion Summary', [
      { label: 'Page', value: `${vfPage.name} → ${result.bundle.name}`, type: 'success' },
      { label: 'Files created', value: `${writtenFiles.length + 1}`, type: 'info' },
      { label: 'Warnings', value: `${result.warnings.length}`, type: result.warnings.length > 0 ? 'warn' : 'success' },
      { label: 'Output', value: path.join(outputDir, result.bundle.name), type: 'info' },
    ]);

    if (result.warnings.length > 0) {
      if (options.verbose) {
        logger.subheader('Warnings:');
        for (const warning of result.warnings) {
          logger.todo(warning);
        }
      } else {
        logger.info('Run with --verbose to see all warnings');
      }
      logger.blank();
    }

    // Display important notes
    if (parsedPage.pageAttributes.renderAs === 'pdf') {
      logger.warn('Page renders as PDF - LWC cannot directly render PDFs');
    }

    // Next steps guidance
    logger.nextSteps([
      `Review generated files in ${result.bundle.name}/`,
      'Check conversion-notes.md for manual action items',
      'Verify Apex @AuraEnabled methods are configured',
      'Test in a scratch org before deploying',
    ]);

    // Open folder if requested
    if (options.open && !options.dryRun) {
      const { openFolder } = await import('../../utils/open-folder');
      logger.info('Opening output folder...');
      await openFolder(outputDir);
    }
  } catch (error: any) {
    logger.error(error.message);
    if (options.verbose && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
