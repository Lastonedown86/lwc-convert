import { LetterGrade, ComplexityLevel, CategoryScore } from './types';

export class GradeCalculator {
    static createCategoryScore(score: number, weightPercent: number, factors: string[]): CategoryScore {
        return {
            score,
            weight: weightPercent,
            weightedScore: score * (weightPercent / 100),
            factors
        };
    }

    static calculateOverallScore(categoryScores: Record<string, CategoryScore>): number {
        let totalWeightedScore = 0;

        for (const key in categoryScores) {
            totalWeightedScore += categoryScores[key].weightedScore;
        }

        return Math.round(totalWeightedScore);
    }

    static scoreToLetterGrade(score: number): LetterGrade {
        if (score >= 90) return 'A';
        if (score >= 75) return 'B';
        if (score >= 60) return 'C';
        if (score >= 45) return 'D';
        return 'F';
    }

    static gradeToComplexity(grade: LetterGrade): ComplexityLevel {
        switch (grade) {
            case 'A': return 'Simple';
            case 'B': return 'Easy';
            case 'C': return 'Moderate';
            case 'D': return 'Complex';
            case 'F': return 'Very Complex';
        }
    }
}
