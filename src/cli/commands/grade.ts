import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from '../../utils/logger';
import { Grader } from '../../grading/grader';
import { GradingOptions, ComponentGrade, GradingSummary } from '../../grading/types';
import { resolveAuraPath, resolveVfPath } from '../../utils/path-resolver';
import { launchGradeTui, shouldUseInteractive } from '../tui/grade-tui';

export async function grade(
    target: string | undefined,
    options: any
): Promise<void> {
    const grader = new Grader();

    // Determine scope and target
    let scope: GradingOptions['scope'] = 'project';
    let targetPath = target;

    if (target) {
        if (await fs.pathExists(target)) {
            const stat = await fs.stat(target);
            if (stat.isDirectory()) {
                // Check if it's a component bundle or just a folder
                const files = await fs.readdir(target);
                if (files.some(f => f.endsWith('.cmp'))) {
                    scope = 'component';
                } else {
                    scope = 'folder';
                }
            } else {
                scope = 'file';
            }
        } else {
            // Try to resolve as component name
            if (options.type === 'aura') {
                const resolved = await resolveAuraPath(target);
                if (resolved.found) {
                    targetPath = resolved.path;
                    scope = 'component';
                }
            } else if (options.type === 'vf') {
                const resolved = await resolveVfPath(target);
                if (resolved.found) {
                    targetPath = resolved.path;
                    scope = 'file'; // VF pages are single files
                }
            }
        }
    }

    const gradingOptions: GradingOptions = {
        type: options.type || 'both',
        scope,
        targetPath,
        detailLevel: options.detailed ? 'detailed' : 'summary',
        sortBy: options.sortBy,
        filter: options.filter,
        exportFormats: options.format ? [options.format] : ['console'],
        exportDir: options.output,
        dryRun: options.dryRun
    };

    logger.banner();
    logger.header('Conversion Complexity Grading');
    logger.info(`Type: ${gradingOptions.type}`);
    logger.info(`Scope: ${gradingOptions.scope}`);
    if (targetPath) logger.info(`Target: ${targetPath}`);
    logger.divider();

    try {
        logger.info('Grading components...');
        const results = await grader.grade(gradingOptions);

        if (results.length === 0) {
            logger.warn('No components found to grade.');
            return;
        }

        // Sort results
        if (options.sortBy) {
            sortResults(results, options.sortBy);
        } else {
            // Default sort by score ascending (hardest first? or easiest? Plan says score-high default in TUI)
            // Let's sort by score ascending (lowest score/hardest first) to highlight issues?
            // Or descending (best first)?
            // Plan says "Sort by score (highest first)" in TUI example.
            results.sort((a, b) => b.overallScore - a.overallScore);
        }

        // Filter results
        const filteredResults = filterResults(results, options.filter);

        // Generate summary
        const summary = grader.generateSummary(filteredResults);

        // Output results
        if (options.format === 'json') {
            const output = { summary, components: filteredResults };
            if (options.output) {
                await fs.writeJson(options.output, output, { spaces: 2 });
                logger.success(`Results written to ${options.output}`);
            } else {
                console.log(JSON.stringify(output, null, 2));
            }
        } else if (options.interactive !== false && shouldUseInteractive() && !options.output) {
            // Launch interactive TUI
            await launchGradeTui(filteredResults, summary);
        } else {
            // Console output (non-interactive)
            printConsoleReport(filteredResults, summary, options.detailed);
        }

    } catch (error: any) {
        logger.error(`Grading failed: ${error.message}`);
        if (options.verbose) console.error(error);
        process.exit(1);
    }
}

function sortResults(results: ComponentGrade[], sortBy: string) {
    switch (sortBy) {
        case 'score':
            results.sort((a, b) => b.overallScore - a.overallScore);
            break;
        case 'complexity':
            // Map complexity to number
            const complexityMap: Record<string, number> = {
                'Simple': 1, 'Easy': 2, 'Moderate': 3, 'Complex': 4, 'Very Complex': 5
            };
            results.sort((a, b) => complexityMap[a.complexity] - complexityMap[b.complexity]);
            break;
        case 'name':
            results.sort((a, b) => a.componentName.localeCompare(b.componentName));
            break;
    }
}

function filterResults(results: ComponentGrade[], filter?: string): ComponentGrade[] {
    if (!filter) return results;

    // Simple filter implementation: "grade:D,F" or "score:<60"
    if (filter.startsWith('grade:')) {
        const grades = filter.substring(6).split(',');
        return results.filter(r => grades.includes(r.letterGrade));
    }

    if (filter.startsWith('score:')) {
        const condition = filter.substring(6);
        if (condition.startsWith('<')) {
            const val = parseInt(condition.substring(1));
            return results.filter(r => r.overallScore < val);
        }
        if (condition.startsWith('>')) {
            const val = parseInt(condition.substring(1));
            return results.filter(r => r.overallScore > val);
        }
    }

    return results;
}

function printConsoleReport(results: ComponentGrade[], summary: GradingSummary, detailed: boolean) {
    // Summary Table
    console.log('Component'.padEnd(30) + 'Type'.padEnd(10) + 'Score'.padEnd(10) + 'Grade'.padEnd(10) + 'Complexity');
    console.log('-'.repeat(80));

    results.forEach(r => {
        console.log(
            r.componentName.padEnd(30) +
            r.componentType.padEnd(10) +
            r.overallScore.toString().padEnd(10) +
            r.letterGrade.padEnd(10) +
            r.complexity
        );
    });

    logger.blank();
    logger.summaryBox('Grading Summary', [
        { label: 'Total Components', value: summary.totalComponents.toString(), type: 'info' },
        { label: 'Average Score', value: `${summary.averageScore} (${summary.averageGrade})`, type: 'info' },
        { label: 'Manual Effort', value: `${summary.totalEffort.manualHours.estimate} hours`, type: 'warn' }
    ]);

    if (detailed) {
        logger.divider();
        logger.subheader('Detailed Breakdown');
        results.forEach(r => {
            logger.info(`${r.componentName} (${r.letterGrade})`);
            r.complexityFactors.forEach(f => {
                console.log(`  - [${f.category}] ${f.factor}`);
            });
            logger.blank();
        });
    }
}
