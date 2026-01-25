import { GradeCalculator } from '../../../src/grading/grade-calculator';
import { CategoryScore } from '../../../src/grading/types';

describe('GradeCalculator', () => {
    describe('createCategoryScore', () => {
        it('should calculate weighted score correctly', () => {
            const score = GradeCalculator.createCategoryScore(80, 25, ['Factor 1']);
            expect(score.score).toBe(80);
            expect(score.weight).toBe(25);
            expect(score.weightedScore).toBe(20); // 80 * 0.25
            expect(score.factors).toEqual(['Factor 1']);
        });
    });

    describe('calculateOverallScore', () => {
        it('should sum weighted scores correctly', () => {
            const categories: Record<string, CategoryScore> = {
                cat1: { score: 100, weight: 50, weightedScore: 50, factors: [] },
                cat2: { score: 50, weight: 50, weightedScore: 25, factors: [] },
            };

            const total = GradeCalculator.calculateOverallScore(categories);
            expect(total).toBe(75);
        });

        it('should round to nearest integer', () => {
            const categories: Record<string, CategoryScore> = {
                cat1: { score: 33, weight: 100, weightedScore: 33.33, factors: [] },
            };

            const total = GradeCalculator.calculateOverallScore(categories);
            expect(total).toBe(33);
        });
    });

    describe('scoreToLetterGrade', () => {
        it('should return A for 90-100', () => {
            expect(GradeCalculator.scoreToLetterGrade(100)).toBe('A');
            expect(GradeCalculator.scoreToLetterGrade(90)).toBe('A');
        });

        it('should return B for 75-89', () => {
            expect(GradeCalculator.scoreToLetterGrade(89)).toBe('B');
            expect(GradeCalculator.scoreToLetterGrade(75)).toBe('B');
        });

        it('should return C for 60-74', () => {
            expect(GradeCalculator.scoreToLetterGrade(74)).toBe('C');
            expect(GradeCalculator.scoreToLetterGrade(60)).toBe('C');
        });

        it('should return D for 45-59', () => {
            expect(GradeCalculator.scoreToLetterGrade(59)).toBe('D');
            expect(GradeCalculator.scoreToLetterGrade(45)).toBe('D');
        });

        it('should return F for 0-44', () => {
            expect(GradeCalculator.scoreToLetterGrade(44)).toBe('F');
            expect(GradeCalculator.scoreToLetterGrade(0)).toBe('F');
        });
    });

    describe('gradeToComplexity', () => {
        it('should map grades to complexity levels', () => {
            expect(GradeCalculator.gradeToComplexity('A')).toBe('Simple');
            expect(GradeCalculator.gradeToComplexity('B')).toBe('Easy');
            expect(GradeCalculator.gradeToComplexity('C')).toBe('Moderate');
            expect(GradeCalculator.gradeToComplexity('D')).toBe('Complex');
            expect(GradeCalculator.gradeToComplexity('F')).toBe('Very Complex');
        });
    });
});
