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
            const searchPaths = options.targetPath ? [options.targetPath] : this.getStandardPaths(options.type);

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
        return (filePath.endsWith('.page') || filePath.endsWith('.component')) ? 'vf' : 'aura';
    }

    private getStandardPaths(type: 'aura' | 'vf' | 'both'): string[] {
        const paths: string[] = [];
        const cwd = process.cwd();

        if (type === 'aura' || type === 'both') {
            paths.push(path.join(cwd, 'force-app/main/default/aura'));
            paths.push(path.join(cwd, 'src/aura'));
        }

        if (type === 'vf' || type === 'both') {
            paths.push(path.join(cwd, 'force-app/main/default/pages'));
            paths.push(path.join(cwd, 'src/pages'));
            paths.push(path.join(cwd, 'force-app/main/default/components'));
            paths.push(path.join(cwd, 'src/components'));
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
                    if (type !== 'aura' && (entry.name.endsWith('.page') || entry.name.endsWith('.component'))) {
                        results.push(fullPath);
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
