/**
 * Aura to LWC conversion command
 */

import * as path from 'path';
import { AuraConversionOptions } from '../options';
import { readAuraBundle, writeLwcBundle, writeConversionNotes } from '../../utils/file-io';
import { logger } from '../../utils/logger';
import { parseAuraMarkup } from '../../parsers/aura/markup-parser';
import { parseAuraController } from '../../parsers/aura/controller-parser';
import { parseAuraHelper } from '../../parsers/aura/helper-parser';
import { parseAuraStyle } from '../../parsers/aura/style-parser';
import { transformAuraMarkup } from '../../transformers/aura-to-lwc/markup';
import { generateAuraScaffolding } from '../../generators/scaffolding';
import { generateAuraFullConversion } from '../../generators/full-conversion';
import { resolveAuraPath, formatSearchLocations } from '../../utils/path-resolver';
import { sessionStore } from '../../utils/session-store';
import { writePreviewFile, openPreview } from '../../utils/preview-generator';
import { ensureProjectRoot } from '../../utils/project-detector.js';

export async function convertAura(
  inputPath: string,
  options: AuraConversionOptions
): Promise<void> {
  // Auto-detect project root
  const { root, changed } = await ensureProjectRoot();
  if (changed) {
    logger.success(`Found project root: ${root}`);
  }

  // Resolve the path (supports just component name)
  const resolved = await resolveAuraPath(inputPath);
  
  if (!resolved.found) {
    const searchInfo = resolved.searchedLocations && resolved.searchedLocations.length > 0
      ? `\nSearched in:\n${formatSearchLocations(resolved.searchedLocations, process.cwd())}`
      : '';
    throw new Error(
      `Component not found: ${inputPath}${searchInfo}\n\nTip: You can provide just the component name (e.g., "AccountCard") or a full path (e.g., "./force-app/main/default/aura/AccountCard")`
    );
  }

  const bundlePath = resolved.path;
  
  // Show banner and conversion info
  logger.banner();
  logger.header('Aura → LWC Conversion');
  logger.info(`Source: ${bundlePath}`);
  logger.info(`Mode: ${options.full ? 'Full Conversion' : 'Scaffolding'}`);
  logger.info(`Output: ${options.output}`);
  if (options.dryRun) {
    logger.warn('Dry run mode - no files will be written');
  }
  logger.divider();

  // Step 1: Read Aura bundle
    logger.step(1, 'Reading Aura component bundle...');
    const bundle = await readAuraBundle(bundlePath);
    logger.success(`Read component: ${bundle.name}`);

    // Step 2: Parse markup
    logger.step(2, 'Parsing component markup...');
    if (!bundle.markup) {
      throw new Error('No markup (.cmp) file found in bundle');
    }
    const parsedMarkup = parseAuraMarkup(bundle.markup, bundle.name);
    logger.success(`Parsed ${parsedMarkup.attributes.length} attributes, ${parsedMarkup.handlers.length} handlers`);

    // Step 3: Parse controller (if exists)
    let parsedController;
    if (bundle.controller) {
      logger.step(3, 'Parsing JavaScript controller...');
      parsedController = parseAuraController(bundle.controller);
      logger.success(`Parsed ${parsedController.functions.length} controller functions`);
    } else {
      logger.step(3, 'No JavaScript controller found');
    }

    // Step 4: Parse helper (if exists)
    let parsedHelper;
    if (bundle.helper) {
      logger.step(4, 'Parsing JavaScript helper...');
      parsedHelper = parseAuraHelper(bundle.helper);
      logger.success(`Parsed ${parsedHelper.functions.length} helper functions`);
    } else {
      logger.step(4, 'No JavaScript helper found');
    }

    // Step 5: Parse styles (if exists)
    let parsedStyle;
    if (bundle.style) {
      logger.step(5, 'Parsing CSS styles...');
      parsedStyle = parseAuraStyle(bundle.style);
      logger.success(`Parsed ${parsedStyle.rules.length} CSS rules`);
    } else {
      logger.step(5, 'No CSS styles found');
    }

    // Step 6: Transform and generate
    logger.step(6, options.full ? 'Generating full conversion...' : 'Generating scaffolding...');

    let result;
    if (options.full) {
      result = generateAuraFullConversion(
        parsedMarkup,
        parsedController,
        parsedHelper,
        parsedStyle
      );
    } else {
      const transformedMarkup = transformAuraMarkup(parsedMarkup);
      result = generateAuraScaffolding(
        parsedMarkup,
        transformedMarkup,
        parsedController,
        parsedHelper,
        parsedStyle
      );
    }

    logger.success(`Generated LWC: ${result.bundle.name}`);

    // Step 7: Write output
    logger.step(7, 'Writing output files...');
    const outputDir = path.resolve(options.output);
    const writtenFiles = await writeLwcBundle(outputDir, result.bundle, options.dryRun);

    // Write conversion notes
    if (result.notes.length > 0) {
      await writeConversionNotes(outputDir, result.bundle.name, result.notes, options.dryRun);
    }

    // Write Jest tests if generated
    if (result.tests) {
      const testDir = path.join(outputDir, result.bundle.name, '__tests__');
      const testFilePath = path.join(testDir, result.tests.filename);
      const { writeFile } = await import('../../utils/file-io');
      await writeFile(testFilePath, result.tests.content, options.dryRun);
    }
    
    // Write behavior spec document
    if (result.behaviorSpec) {
      const specFilePath = path.join(outputDir, result.bundle.name, `${result.bundle.name}-behavior-spec.md`);
      const { writeFile } = await import('../../utils/file-io');
      await writeFile(specFilePath, result.behaviorSpec, options.dryRun);
    }

    // Write test comparison files (before/after tests)
    if (result.testComparison) {
      const { writeFile } = await import('../../utils/file-io');
      const testDir = path.join(outputDir, result.bundle.name, '__tests__');
      
      // Write "before" test documentation (Aura behaviors)
      const beforeTestPath = path.join(testDir, `${result.bundle.name}.before.spec.js`);
      await writeFile(beforeTestPath, result.testComparison.beforeTestFile, options.dryRun);
      
      // Write "after" test file (LWC verification)
      const afterTestPath = path.join(testDir, `${result.bundle.name}.after.test.js`);
      await writeFile(afterTestPath, result.testComparison.afterTestFile, options.dryRun);
      
      // Write comparison report
      const comparisonReportPath = path.join(outputDir, result.bundle.name, `${result.bundle.name}-test-comparison.md`);
      await writeFile(comparisonReportPath, result.testComparison.comparisonReport, options.dryRun);
    }

    logger.divider();

    // Store conversion in session for learning
    if (result.testComparison) {
      const conversionRecord = await sessionStore.storeConversion(
        'aura',
        bundle.name,
        result.bundle.name,
        bundlePath,
        path.join(outputDir, result.bundle.name),
        result.testComparison,
        result.warnings
      );
      logger.debug(`Session stored: ${conversionRecord.id}`);
    }

    // Calculate file count
    let totalFiles = writtenFiles.length + 1; // +1 for notes
    if (result.tests) totalFiles++;
    if (result.behaviorSpec) totalFiles++;
    if (result.testComparison) totalFiles += 3; // before spec, after test, comparison report

    // Show success toast
    logger.successToast(
      'Conversion Complete',
      [
        `${bundle.name} → ${result.bundle.name}`,
        `${totalFiles} files created`,
      ],
      path.join(outputDir, result.bundle.name)
    );

    // Summary box with detailed info
    const sessionSummary = sessionStore.getSessionSummary();
    logger.summaryBox('Conversion Summary', [
      { label: 'Component', value: `${bundle.name} → ${result.bundle.name}`, type: 'success' },
      { label: 'Files created', value: `${totalFiles}`, type: 'info' },
      { label: 'Behaviors mapped', value: `${result.testComparison?.behaviorTests.length || 0}`, type: 'info' },
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

    // Next steps guidance
    logger.nextSteps([
      `Review generated files in ${result.bundle.name}/`,
      'Check conversion-notes.md for manual action items',
      'Run Jest tests: npm test -- --findRelatedTests',
      'Verify behavior matches original component',
      `Session data stored in: ${sessionStore.getSessionDir()}`,
    ]);

    // Generate and open preview if requested
    if (options.preview) {
      logger.step(8, 'Generating UI preview...');
      const previewPath = await writePreviewFile(outputDir, result.bundle, options.dryRun);
      if (!options.dryRun) {
        logger.success('Preview generated');
        await openPreview(previewPath);
      }
    }

    // Open folder if requested
    if (options.open && !options.dryRun) {
      const { openFolder } = await import('../../utils/open-folder');
      logger.info('Opening output folder...');
      await openFolder(outputDir);
    }
}
