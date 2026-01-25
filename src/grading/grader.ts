import * as fs from 'fs-extra';
import * as path from 'path';
import { AuraGrader } from './aura-grader';
import { VfGrader } from './vf-grader';
import { GradeCalculator } from './grade-calculator';
import { ComponentGrade, GradingOptions, GradingSummary } from './types';
import { logger } from '../utils/logger';

export class Grader {
    private auraGrader: AuraGrader;
    private vfGrader: VfGrader;

    constructor() {
        this.auraGrader = new AuraGrader();
        this.vfGrader = new VfGrader();
    }

    /**
     * Read sfdx-project.json and return package directories
     */
    private async getPackageDirectories(rootPath: string): Promise<string[]> {
        const sfdxProjectPath = path.join(rootPath, 'sfdx-project.json');

        if (await fs.pathExists(sfdxProjectPath)) {
            try {
                const projectConfig = await fs.readJson(sfdxProjectPath);
                if (projectConfig.packageDirectories && Array.isArray(projectConfig.packageDirectories)) {
                    return projectConfig.packageDirectories.map((pkg: { path: string }) =>
                        path.join(rootPath, pkg.path)
                    );
                }
            } catch (error) {
                logger.debug(`Error reading sfdx-project.json: ${error}`);
            }
        }

        return [];
    }

    /**
     * Recursively find 'pages', 'components', and 'aura' directories within a path
     */
    private async findSalesforceDirs(basePath: string): Promise<{ pages: string[]; components: string[]; aura: string[] }> {
        const pagesDirectories: string[] = [];
        const componentsDirectories: string[] = [];
        const auraDirectories: string[] = [];

        const searchDir = async (dirPath: string, depth: number = 0): Promise<void> => {
            if (depth > 5) return; // Limit recursion depth

            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const fullPath = path.join(dirPath, entry.name);

                        if (entry.name === 'pages') {
                            pagesDirectories.push(fullPath);
                        } else if (entry.name === 'components') {
                            componentsDirectories.push(fullPath);
                        } else if (entry.name === 'aura') {
                            auraDirectories.push(fullPath);
                        } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            await searchDir(fullPath, depth + 1);
                        }
                    }
                }
            } catch {
                // Ignore permission errors
            }
        };

        await searchDir(basePath);
        return { pages: pagesDirectories, components: componentsDirectories, aura: auraDirectories };
    }

    async grade(options: GradingOptions): Promise<ComponentGrade[]> {
        const results: ComponentGrade[] = [];

        if (options.scope === 'component' || options.scope === 'file') {
            if (!options.targetPath) {
                throw new Error('Target path is required for component/file scope');
            }

            const grade = await this.gradeSingle(options.targetPath, options.type);
            if (grade) results.push(grade);
        } else {
            // Project or folder scope
            const searchPaths = options.targetPath ? [options.targetPath] : await this.getStandardPaths(options.type);

            for (const searchPath of searchPaths) {
                const found = await this.scanDirectory(searchPath, options.type);
                for (const file of found) {
                    try {
                        const grade = await this.gradeSingle(file, options.type === 'both' ? this.detectType(file) : options.type);
                        if (grade) results.push(grade);
                    } catch (err: any) {
                        logger.error(`Failed to grade ${file}: ${err.message}`);
                    }
                }
            }
        }

        return results;
    }

    private async gradeSingle(filePath: string, type: 'aura' | 'vf' | 'both'): Promise<ComponentGrade | null> {
        const resolvedType = type === 'both' ? this.detectType(filePath) : type;

        if (resolvedType === 'aura') {
            // For Aura, filePath might be the folder or the .cmp file
            // AuraGrader expects the folder path usually, but let's check
            const bundlePath = filePath.endsWith('.cmp') ? path.dirname(filePath) : filePath;
            return this.auraGrader.grade(bundlePath);
        } else if (resolvedType === 'vf') {
            return this.vfGrader.grade(filePath);
        }
        return null;
    }

    private detectType(filePath: string): 'aura' | 'vf' {
        if (filePath.endsWith('.cmp') || filePath.includes('/aura/') || filePath.includes('\\aura\\')) return 'aura';
        if (filePath.endsWith('.page') || filePath.endsWith('.component') ||
            filePath.includes('/pages/') || filePath.includes('\\pages\\') ||
            filePath.includes('/components/') || filePath.includes('\\components\\')) return 'vf';
        // Default fallback - check file extension
        if (filePath.endsWith('.page') || filePath.endsWith('.component')) return 'vf';
        return 'aura';
    }

    private async getStandardPaths(type: 'aura' | 'vf' | 'both'): Promise<string[]> {
        const paths: string[] = [];
        const cwd = process.cwd();

        // First, try to read sfdx-project.json for package directories
        const packageDirs = await this.getPackageDirectories(cwd);

        if (packageDirs.length > 0) {
            // Search within each package directory for Salesforce directories
            for (const pkgDir of packageDirs) {
                const foundDirs = await this.findSalesforceDirs(pkgDir);
                if (type === 'aura' || type === 'both') {
                    paths.push(...foundDirs.aura);
                }
                if (type === 'vf' || type === 'both') {
                    paths.push(...foundDirs.pages);
                    paths.push(...foundDirs.components);
                }
            }
            logger.debug(`Found directories from sfdx-project.json: ${paths.join(', ')}`);
        }

        // Also add fallback standard locations
        if (type === 'aura' || type === 'both') {
            const auraFallbacks = [
                path.join(cwd, 'force-app/main/default/aura'),
                path.join(cwd, 'src/aura'),
            ];
            for (const fallback of auraFallbacks) {
                if (!paths.includes(fallback)) {
                    paths.push(fallback);
                }
            }
        }

        if (type === 'vf' || type === 'both') {
            const vfFallbacks = [
                path.join(cwd, 'force-app/main/default/pages'),
                path.join(cwd, 'src/pages'),
                path.join(cwd, 'force-app/main/default/components'),
                path.join(cwd, 'src/components'),
            ];
            for (const fallback of vfFallbacks) {
                if (!paths.includes(fallback)) {
                    paths.push(fallback);
                }
            }
        }

        return paths;
    }

    private async scanDirectory(dir: string, type: 'aura' | 'vf' | 'both'): Promise<string[]> {
        const results: string[] = [];

        if (!await fs.pathExists(dir)) return results;

        async function walk(currentDir: string) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory()) {
                    // If it's an Aura bundle folder (contains .cmp), add it
                    if (type !== 'vf') {
                        const children = await fs.readdir(fullPath);
                        if (children.some(f => f.endsWith('.cmp'))) {
                            results.push(fullPath);
                            continue; // Don't recurse into bundle
                        }
                    }
                    await walk(fullPath);
                } else {
                    // Find VF pages (.page) and VF components (.component)
                    if (type !== 'aura') {
                        if (entry.name.endsWith('.page') || entry.name.endsWith('.component')) {
                            results.push(fullPath);
                        }
                    }
                }
            }
        }

        await walk(dir);
        return results;
    }

    generateSummary(grades: ComponentGrade[]): GradingSummary {
        const distribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        let totalScore = 0;
        let totalAutomated = 0;
        let totalManualMin = 0;
        let totalManualMax = 0;
        let totalManualEst = 0;

        grades.forEach(g => {
            distribution[g.letterGrade]++;
            totalScore += g.overallScore;
            totalAutomated += g.conversionEffort.automatedPercentage;
            totalManualMin += g.conversionEffort.manualHours.min;
            totalManualMax += g.conversionEffort.manualHours.max;
            totalManualEst += g.conversionEffort.manualHours.estimate;
        });

        const count = grades.length;

        return {
            totalComponents: count,
            averageScore: count ? Math.round(totalScore / count) : 0,
            averageGrade: GradeCalculator.scoreToLetterGrade(count ? totalScore / count : 0),
            distribution: distribution as any,
            totalEffort: {
                automatedPercentage: count ? Math.round(totalAutomated / count) : 0,
                manualHours: {
                    min: totalManualMin,
                    max: totalManualMax,
                    estimate: totalManualEst
                }
            },
            recommendations: this.aggregateRecommendations(grades)
        };
    }

    private aggregateRecommendations(grades: ComponentGrade[]): string[] {
        // Collect top recommendations
        const counts = new Map<string, number>();
        grades.forEach(g => {
            g.recommendations.forEach(r => {
                counts.set(r, (counts.get(r) || 0) + 1);
            });
        });

        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([rec, count]) => `${rec} (${count} components)`);
    }
}
