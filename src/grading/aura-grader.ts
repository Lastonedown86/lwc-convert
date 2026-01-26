import { ComponentGrade, CategoryScore, ComplexityFactor, EffortEstimate } from './types';
import { GradeCalculator } from './grade-calculator';
import { MetricExtractor } from './complexity-metrics';
import { parseAuraMarkup } from '../parsers/aura/markup-parser';
import { readAuraBundle } from '../utils/file-io';
import { CLI_VERSION } from '../cli/options';
import * as path from 'path';

export class AuraGrader {
    async grade(bundlePath: string): Promise<ComponentGrade> {
        const bundle = await readAuraBundle(bundlePath);
        const componentName = bundle.name;

        // Parse markup
        const parsedMarkup = parseAuraMarkup(bundle.markup || '', componentName);
        const metrics = MetricExtractor.extractAuraMetrics(parsedMarkup, bundle.markup || '');

        // Calculate scores for each category
        const componentMappings = this.scoreComponentMappings(metrics, parsedMarkup);
        const jsPatterns = this.scoreJsPatterns(bundle.controller || '', bundle.helper || '');
        const dataBinding = this.scoreDataBinding(metrics, parsedMarkup);
        const lifecycleEvents = this.scoreLifecycleEvents(metrics, parsedMarkup);
        const dependencies = this.scoreDependencies(metrics, parsedMarkup);
        const styling = this.scoreStyling(bundle.style || '');

        const categoryScores: Record<string, CategoryScore> = {
            componentMappings,
            jsPatterns,
            dataBinding,
            lifecycleEvents,
            dependencies,
            styling
        };

        const overallScore = GradeCalculator.calculateOverallScore(categoryScores);
        const letterGrade = GradeCalculator.scoreToLetterGrade(overallScore);
        const complexity = GradeCalculator.gradeToComplexity(letterGrade);

        const complexityFactors = this.collectComplexityFactors(categoryScores);
        const conversionEffort = this.estimateEffort(overallScore, complexityFactors);
        const recommendations = this.generateRecommendations(complexityFactors);

        // Check for extension-related warnings and recommendations
        const warnings: string[] = [];
        if (parsedMarkup.extends) {
            warnings.push(`Extends: ${parsedMarkup.extends}`);
            if (parsedMarkup.isSimpleExtension) {
                recommendations.unshift(
                    `Simple extension of ${parsedMarkup.extends} - consider using composition or removing if unused`
                );
            } else {
                recommendations.unshift(
                    `Extends ${parsedMarkup.extends} - convert parent first, then use class inheritance in LWC`
                );
            }
        }

        return {
            componentName,
            componentType: 'aura',
            filePath: bundlePath,
            overallScore,
            letterGrade,
            complexity,
            categoryScores,
            complexityFactors,
            conversionEffort,
            recommendations,
            warnings,
            gradedAt: new Date(),
            gradedVersion: CLI_VERSION,
            // Add extension metadata
            metadata: parsedMarkup.extends ? {
                extends: parsedMarkup.extends,
                isSimpleExtension: parsedMarkup.isSimpleExtension || false
            } : undefined
        };
    }

    private scoreComponentMappings(metrics: any, markup: any): CategoryScore {
        let score = 100;
        const factors: string[] = [];

        // Deduct for complex tags
        // This is a simplified heuristic
        if (markup.facets.size > 0) {
            score -= 10;
            factors.push('Uses aura:set/facets');
        }

        // Check for legacy components that are hard to convert
        const legacyTags = ['ui:', 'force:recordPreview'];
        const foundLegacy = markup.dependencies.filter((d: string) => legacyTags.some(t => d.startsWith(t)));
        if (foundLegacy.length > 0) {
            score -= 15 * foundLegacy.length;
            factors.push(`Uses legacy components: ${foundLegacy.join(', ')}`);
        }

        return GradeCalculator.createCategoryScore(Math.max(0, score), 25, factors);
    }

    private scoreJsPatterns(controller: string, helper: string): CategoryScore {
        let score = 100;
        const factors: string[] = [];
        const combined = controller + helper;

        if (combined.includes('$A.createComponent')) {
            score -= 30;
            factors.push('Dynamic component creation ($A.createComponent)');
        }

        if (combined.includes('window.') || combined.includes('document.')) {
            score -= 20;
            factors.push('Direct DOM manipulation');
        }

        if (combined.includes('jQuery') || combined.includes('$ (')) {
            score -= 25;
            factors.push('Uses jQuery');
        }

        return GradeCalculator.createCategoryScore(Math.max(0, score), 25, factors);
    }

    private scoreDataBinding(metrics: any, markup: any): CategoryScore {
        let score = 100;
        const factors: string[] = [];

        if (metrics.hasUnboundExpressions) {
            score -= 10;
            factors.push('Uses unbound expressions (!v.val)');
        }

        return GradeCalculator.createCategoryScore(Math.max(0, score), 20, factors);
    }

    private scoreLifecycleEvents(metrics: any, markup: any): CategoryScore {
        let score = 100;
        const factors: string[] = [];

        const renderHandlers = markup.handlers.filter((h: any) => h.name === 'render');
        if (renderHandlers.length > 0) {
            score -= 15;
            factors.push('Custom render handler');
        }

        return GradeCalculator.createCategoryScore(Math.max(0, score), 15, factors);
    }

    private scoreDependencies(metrics: any, markup: any): CategoryScore {
        let score = 100;
        const factors: string[] = [];

        if (metrics.dependencyCount > 5) {
            score -= 10;
            factors.push('High number of dependencies');
        }

        // Check if component extends another
        if (markup.extends) {
            score -= 15; // Extension adds conversion complexity
            factors.push(`Extends ${markup.extends} (convert parent first)`);

            if (markup.isSimpleExtension) {
                score += 10; // Simple extensions are easier
                factors.push('Simple extension - consider removing or using composition');
            }
        }

        return GradeCalculator.createCategoryScore(Math.max(0, score), 10, factors);
    }

    private scoreStyling(style: string): CategoryScore {
        const score = 100;
        const factors: string[] = [];

        if (style.includes('.THIS')) {
            // Standard, no penalty
        }

        // Check for hardcoded values or complex selectors?
        // For now, keep it simple.

        return GradeCalculator.createCategoryScore(Math.max(0, score), 5, factors);
    }

    private collectComplexityFactors(categoryScores: Record<string, CategoryScore>): ComplexityFactor[] {
        const factors: ComplexityFactor[] = [];
        for (const [category, data] of Object.entries(categoryScores)) {
            data.factors.forEach(f => {
                factors.push({
                    category,
                    factor: f,
                    impact: 'medium', // Default
                    description: f
                });
            });
        }
        return factors;
    }

    private estimateEffort(score: number, factors: ComplexityFactor[]): EffortEstimate {
        // Heuristic based on score
        const automated = Math.max(0, Math.min(100, score)); // Rough proxy

        return {
            automatedPercentage: automated,
            manualHours: {
                min: 1,
                max: 8,
                estimate: 4
            },
            skillLevel: score > 80 ? 'beginner' : score > 60 ? 'intermediate' : 'expert'
        };
    }

    private generateRecommendations(factors: ComplexityFactor[]): string[] {
        return factors.map(f => `Address ${f.factor}`);
    }
}
