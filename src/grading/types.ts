export type ComponentType = 'aura' | 'vf';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ComplexityLevel = 'Simple' | 'Easy' | 'Moderate' | 'Complex' | 'Very Complex';

export interface CategoryScore {
    score: number;           // 0-100
    weight: number;          // Percentage weight
    weightedScore: number;   // score * weight
    factors: string[];       // What contributed to this score
}

export interface ComplexityFactor {
    category: string;
    factor: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
    lineNumbers?: number[];  // Where in code this appears
}

export interface EffortEstimate {
    automatedPercentage: number;  // % that can be auto-converted
    manualHours: {
        min: number;
        max: number;
        estimate: number;
    };
    skillLevel: 'beginner' | 'intermediate' | 'expert';
}

export interface ComponentGrade {
    componentName: string;
    componentType: ComponentType;
    filePath: string;

    // Overall grade
    overallScore: number;        // 0-100
    letterGrade: LetterGrade;    // A, B, C, D, F
    complexity: ComplexityLevel; // Simple, Easy, Moderate, Complex, Very Complex

    // Category breakdowns
    categoryScores: Record<string, CategoryScore>;

    // Detailed factors
    complexityFactors: ComplexityFactor[];

    // Actionable insights
    conversionEffort: EffortEstimate;
    recommendations: string[];
    warnings: string[];

    // Metadata
    gradedAt: Date;
    gradedVersion: string;
}

export interface GradingSummary {
    totalComponents: number;
    averageScore: number;
    averageGrade: LetterGrade;
    distribution: Record<LetterGrade, number>;  // Count per grade
    totalEffort: {
        automatedPercentage: number;
        manualHours: { min: number; max: number; estimate: number };
    };
    recommendations: string[];
}

export interface GradingOptions {
    type: 'aura' | 'vf' | 'both';
    scope: 'project' | 'folder' | 'component' | 'file';
    targetPath?: string;
    detailLevel: 'summary' | 'standard' | 'detailed';
    sortBy?: 'score' | 'complexity' | 'name';
    filter?: string;
    exportFormats?: ('json' | 'csv' | 'html' | 'md' | 'console')[];
    exportDir?: string;
    dryRun?: boolean;
}
