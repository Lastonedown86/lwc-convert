/**
 * CLI command handler for dependency graph analysis
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { DependencyAnalyzer } from '../../dependency-graph/analyzer';
import { DependencyAnalysisOptions } from '../../dependency-graph/types';
import { calculateConversionOrder } from '../../dependency-graph/conversion-order';
import { formatConsoleOutput } from '../../dependency-graph/formatters/console-formatter';
import { formatJsonOutput, serializeJson } from '../../dependency-graph/formatters/json-formatter';
import { formatMermaidOutput, formatSimpleMermaidOutput } from '../../dependency-graph/formatters/mermaid-formatter';

export interface DepsCommandOptions {
  type: 'aura' | 'vf' | 'both';
  output?: string;
  format: 'console' | 'json' | 'mermaid' | 'html' | 'dot';
  conversionOrder: boolean;
  focus?: string;
  depth: string;
  includeBase: boolean;
  showOrphans: boolean;
  circularOnly: boolean;
  verbose: boolean;
}

/**
 * Execute the deps command
 */
export async function analyzeDeps(
  target: string | undefined,
  options: DepsCommandOptions
): Promise<void> {
  logger.setVerbose(options.verbose);

  const targetPath = target ? path.resolve(target) : process.cwd();

  logger.banner();
  logger.header('Dependency Graph Analysis');
  logger.info(`Analyzing: ${targetPath}`);
  logger.blank();

  const analysisOptions: DependencyAnalysisOptions = {
    type: options.type,
    scope: 'project',
    targetPath,
    focusComponent: options.focus,
    maxDepth: parseInt(options.depth, 10) || 0,
    includeBaseComponents: options.includeBase,
    showOrphans: options.showOrphans,
    circularOnly: options.circularOnly,
    format: options.format,
    outputPath: options.output,
    showConversionOrder: options.conversionOrder,
    verbose: options.verbose,
  };

  try {
    const analyzer = new DependencyAnalyzer();
    const graph = await analyzer.analyze(analysisOptions);

    if (graph.stats.totalNodes === 0) {
      logger.warn('No components found to analyze.');
      logger.info('Make sure you are in a Salesforce project directory or specify a valid path.');
      return;
    }

    // Calculate conversion order if requested
    const conversionOrder = options.conversionOrder
      ? calculateConversionOrder(graph)
      : undefined;

    // Format output based on selected format
    let output: string | undefined;

    switch (options.format) {
      case 'json':
        const jsonOutput = formatJsonOutput(graph, conversionOrder);
        output = serializeJson(jsonOutput);
        if (options.output) {
          await writeOutput(options.output, output);
          logger.success(`JSON report written to: ${options.output}`);
        } else {
          console.log(output);
        }
        break;

      case 'mermaid':
        // Use simplified output for large graphs
        output = graph.stats.totalNodes > 30
          ? formatSimpleMermaidOutput(graph, 30)
          : formatMermaidOutput(graph);
        if (options.output) {
          await writeOutput(options.output, output);
          logger.success(`Mermaid diagram written to: ${options.output}`);
        } else {
          console.log(output);
        }
        break;

      case 'html':
        logger.warn('HTML format not yet implemented. Using console output.');
        formatConsoleOutput(graph, conversionOrder, options.showOrphans);
        break;

      case 'dot':
        logger.warn('DOT format not yet implemented. Using console output.');
        formatConsoleOutput(graph, conversionOrder, options.showOrphans);
        break;

      case 'console':
      default:
        formatConsoleOutput(graph, conversionOrder, options.showOrphans);
        break;
    }

    // Show summary
    if (options.format === 'console') {
      logger.blank();
      logger.success('Analysis complete!');
    }
  } catch (error: any) {
    logger.error(`Analysis failed: ${error.message}`);
    if (options.verbose && error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Write output to file
 */
async function writeOutput(filePath: string, content: string): Promise<void> {
  const outputPath = path.resolve(filePath);
  const outputDir = path.dirname(outputPath);

  await fs.ensureDir(outputDir);
  await fs.writeFile(outputPath, content, 'utf-8');
}
