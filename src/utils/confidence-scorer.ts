/**
 * Confidence scoring utilities for VF-to-LWC conversion
 *
 * Provides detailed confidence scoring at component, expression, data-binding,
 * and page levels to help developers understand conversion quality.
 */

/**
 * Categories of confidence factors
 */
export type ConfidenceCategory =
    | 'component'
    | 'data-binding'
    | 'expression'
    | 'apex'
    | 'markup'
    | 'formula';

/**
 * Individual factor contributing to confidence score
 */
export interface ConfidenceFactor {
    category: ConfidenceCategory;
    name: string;
    score: number; // 0-100
    weight: number; // 1-10 (higher = more important)
    details?: string;
}

/**
 * Aggregated confidence result for a conversion
 */
export interface ConversionConfidence {
    overall: number; // 0-100 weighted average
    level: 'high' | 'medium' | 'low';
    factors: ConfidenceFactor[];
    summary: string;
    breakdown: {
        components: number;
        dataBinding: number;
        expressions: number;
        apex: number;
    };
}

/**
 * Confidence scoring weights for different factor categories
 */
const CATEGORY_WEIGHTS: Record<ConfidenceCategory, number> = {
    component: 8,
    'data-binding': 9,
    expression: 6,
    apex: 10,
    markup: 5,
    formula: 7,
};

/**
 * Calculate confidence level from numeric score
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

/**
 * Create a confidence factor
 */
export function createFactor(
    category: ConfidenceCategory,
    name: string,
    score: number,
    details?: string,
    weight?: number
): ConfidenceFactor {
    return {
        category,
        name,
        score: Math.max(0, Math.min(100, score)),
        weight: weight ?? CATEGORY_WEIGHTS[category],
        details,
    };
}

/**
 * Aggregate multiple confidence factors into overall score
 */
export function aggregateConfidence(factors: ConfidenceFactor[]): ConversionConfidence {
    if (factors.length === 0) {
        return {
            overall: 100,
            level: 'high',
            factors: [],
            summary: 'No conversion complexity detected',
            breakdown: { components: 100, dataBinding: 100, expressions: 100, apex: 100 },
        };
    }

    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;

    for (const factor of factors) {
        weightedSum += factor.score * factor.weight;
        totalWeight += factor.weight;
    }

    const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

    // Calculate breakdown by category
    const categoryScores: Record<ConfidenceCategory, { sum: number; count: number }> = {
        component: { sum: 0, count: 0 },
        'data-binding': { sum: 0, count: 0 },
        expression: { sum: 0, count: 0 },
        apex: { sum: 0, count: 0 },
        markup: { sum: 0, count: 0 },
        formula: { sum: 0, count: 0 },
    };

    for (const factor of factors) {
        categoryScores[factor.category].sum += factor.score;
        categoryScores[factor.category].count += 1;
    }

    const breakdown = {
        components:
            categoryScores.component.count > 0
                ? Math.round(categoryScores.component.sum / categoryScores.component.count)
                : 100,
        dataBinding:
            categoryScores['data-binding'].count > 0
                ? Math.round(categoryScores['data-binding'].sum / categoryScores['data-binding'].count)
                : 100,
        expressions:
            categoryScores.expression.count > 0
                ? Math.round(categoryScores.expression.sum / categoryScores.expression.count)
                : 100,
        apex:
            categoryScores.apex.count > 0
                ? Math.round(categoryScores.apex.sum / categoryScores.apex.count)
                : 100,
    };

    // Generate summary
    const level = getConfidenceLevel(overall);
    const lowFactors = factors.filter((f) => f.score < 50);
    const mediumFactors = factors.filter((f) => f.score >= 50 && f.score < 80);

    let summary: string;
    if (level === 'high') {
        summary = 'Conversion is mostly automatic with minimal manual adjustments needed.';
    } else if (level === 'medium') {
        summary = `Conversion requires attention in ${mediumFactors.length + lowFactors.length} area(s).`;
        if (lowFactors.length > 0) {
            summary += ` Critical: ${lowFactors.map((f) => f.name).join(', ')}.`;
        }
    } else {
        summary = `Significant manual work required. ${lowFactors.length} critical area(s): ${lowFactors.map((f) => f.name).join(', ')}.`;
    }

    return {
        overall,
        level,
        factors,
        summary,
        breakdown,
    };
}

// ============================================================================
// Component Confidence Scoring
// ============================================================================

/**
 * Component mapping confidence scores
 */
const COMPONENT_CONFIDENCE_SCORES: Record<string, { score: number; reason: string }> = {
    // High confidence - direct mappings
    'apex:inputtext': { score: 95, reason: 'Direct mapping to lightning-input' },
    'apex:inputtextarea': { score: 95, reason: 'Direct mapping to lightning-textarea' },
    'apex:inputcheckbox': { score: 90, reason: 'Direct mapping to lightning-input type=checkbox' },
    'apex:outputtext': { score: 100, reason: 'Simple text interpolation' },
    'apex:outputfield': { score: 90, reason: 'Direct mapping to lightning-output-field' },
    'apex:inputfield': { score: 90, reason: 'Direct mapping to lightning-input-field' },
    'apex:commandbutton': { score: 85, reason: 'Maps to lightning-button with handler conversion' },
    'apex:detail': { score: 90, reason: 'Direct mapping to lightning-record-form' },
    'apex:relatedlist': { score: 95, reason: 'Direct mapping to lightning-related-list-view' },

    // Medium confidence - require some adaptation
    'apex:selectlist': { score: 75, reason: 'Maps to lightning-combobox, options need conversion' },
    'apex:pageblock': { score: 70, reason: 'Maps to lightning-card, layout may differ' },
    'apex:pageblocksection': { score: 65, reason: 'Maps to lightning-layout, structure changes' },
    'apex:pageblocktable': { score: 60, reason: 'Maps to lightning-datatable, columns need definition' },
    'apex:repeat': { score: 80, reason: 'Maps to for:each template directive' },
    'apex:outputpanel': { score: 75, reason: 'Maps to div with conditional rendering' },
    'apex:form': { score: 70, reason: 'Maps to lightning-record-edit-form or div' },
    'apex:commandlink': { score: 70, reason: 'Maps to lightning-button or anchor' },
    'apex:iframe': { score: 65, reason: 'Standard iframe, check CSP restrictions' },

    // Low confidence - significant manual work
    'apex:actionfunction': { score: 40, reason: 'Requires imperative Apex call implementation' },
    'apex:actionsupport': { score: 45, reason: 'Requires event handler implementation' },
    'apex:actionpoller': { score: 35, reason: 'Requires setInterval implementation' },
    'apex:pagemessages': { score: 50, reason: 'Requires ShowToastEvent implementation' },
    'apex:includescript': { score: 45, reason: 'Requires loadScript implementation' },
    'apex:stylesheet': { score: 45, reason: 'Requires loadStyle implementation' },
    'apex:remoteobjects': { score: 30, reason: 'Requires complete Apex controller replacement' },
};

/**
 * Get confidence score for a VF component
 */
export function getComponentConfidence(
    componentName: string
): { score: number; reason: string } {
    const lowerName = componentName.toLowerCase();
    const mapping = COMPONENT_CONFIDENCE_SCORES[lowerName];

    if (mapping) {
        return mapping;
    }

    // Default scores for unknown components
    if (lowerName.startsWith('apex:')) {
        return { score: 40, reason: 'No direct mapping - requires custom implementation' };
    }

    if (lowerName.startsWith('c:')) {
        return { score: 50, reason: 'Custom VF component - verify LWC equivalent exists' };
    }

    // HTML elements pass through
    return { score: 100, reason: 'Standard HTML element' };
}

/**
 * Calculate confidence factors for a set of VF components
 */
export function calculateComponentsConfidence(
    componentNames: string[]
): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];
    const componentCounts = new Map<string, number>();

    // Count component occurrences
    for (const name of componentNames) {
        const lowerName = name.toLowerCase();
        componentCounts.set(lowerName, (componentCounts.get(lowerName) || 0) + 1);
    }

    // Create factors for each unique component
    for (const [name, count] of componentCounts) {
        const { score, reason } = getComponentConfidence(name);
        factors.push(
            createFactor(
                'component',
                name,
                score,
                `${reason}${count > 1 ? ` (${count} occurrences)` : ''}`
            )
        );
    }

    return factors;
}

// ============================================================================
// Expression Confidence Scoring
// ============================================================================

/**
 * Expression pattern confidence scores
 */
const EXPRESSION_CONFIDENCE: Record<string, { score: number; reason: string }> = {
    $CurrentPage: { score: 85, reason: 'Wire CurrentPageReference adapter' },
    $User: { score: 90, reason: 'Import from @salesforce/user' },
    $Label: { score: 95, reason: 'Import from @salesforce/label' },
    $Resource: { score: 90, reason: 'Import from @salesforce/resourceUrl' },
    $ObjectType: { score: 85, reason: 'Import from @salesforce/schema' },
    $MessageChannel: { score: 70, reason: 'Wire Lightning Message Service' },
    $Action: { score: 40, reason: 'Requires NavigationMixin implementation' },
    $Api: { score: 50, reason: 'Platform-specific, may need alternative' },
};

/**
 * Get confidence score for a global variable expression
 */
export function getExpressionConfidence(
    expression: string
): { score: number; reason: string } {
    for (const [pattern, confidence] of Object.entries(EXPRESSION_CONFIDENCE)) {
        if (expression.includes(pattern)) {
            return confidence;
        }
    }

    // Simple property bindings
    if (/^\{![a-zA-Z_]\w*\}$/.test(expression)) {
        return { score: 100, reason: 'Simple property binding' };
    }

    // Object.field bindings
    if (/^\{![a-zA-Z_]\w*\.[a-zA-Z_]\w*\}$/.test(expression)) {
        return { score: 95, reason: 'Object field binding' };
    }

    // Formula expressions
    if (/^\{!(NOT|ISBLANK|ISNULL|AND|OR|IF|LEN|CONTAINS|BEGINS)/i.test(expression)) {
        return { score: 75, reason: 'Formula requires getter implementation' };
    }

    return { score: 60, reason: 'Complex expression - verify conversion' };
}

/**
 * Calculate confidence factors for expressions
 */
export function calculateExpressionsConfidence(
    expressions: string[]
): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];
    const seenPatterns = new Set<string>();

    for (const expr of expressions) {
        // Extract the key pattern to avoid duplicates
        let patternKey = expr;
        for (const pattern of Object.keys(EXPRESSION_CONFIDENCE)) {
            if (expr.includes(pattern)) {
                patternKey = pattern;
                break;
            }
        }

        if (seenPatterns.has(patternKey)) continue;
        seenPatterns.add(patternKey);

        const { score, reason } = getExpressionConfidence(expr);
        factors.push(createFactor('expression', patternKey, score, reason));
    }

    return factors;
}

// ============================================================================
// Data Binding Confidence Scoring
// ============================================================================

/**
 * Calculate confidence for data binding patterns
 */
export function calculateDataBindingConfidence(options: {
    hasWireAdapters: boolean;
    hasImperativeApex: boolean;
    hasRemoteActions: boolean;
    hasActionFunctions: boolean;
    actionFunctionsWithParams: number;
    hasRemoteObjects: boolean;
}): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];

    if (options.hasWireAdapters) {
        factors.push(
            createFactor('data-binding', 'wire-adapters', 90, 'Wire adapters are well-supported in LWC')
        );
    }

    if (options.hasImperativeApex) {
        factors.push(
            createFactor('data-binding', 'imperative-apex', 85, 'Imperative Apex calls are straightforward')
        );
    }

    if (options.hasRemoteActions) {
        factors.push(
            createFactor(
                'data-binding',
                'remote-actions',
                65,
                'Remote actions need @AuraEnabled annotation and import'
            )
        );
    }

    if (options.hasActionFunctions) {
        const baseScore = options.actionFunctionsWithParams > 0 ? 55 : 70;
        factors.push(
            createFactor(
                'data-binding',
                'action-functions',
                baseScore,
                options.actionFunctionsWithParams > 0
                    ? `${options.actionFunctionsWithParams} action function(s) with parameters need imperative conversion`
                    : 'Action functions converted to imperative Apex'
            )
        );
    }

    if (options.hasRemoteObjects) {
        factors.push(
            createFactor(
                'data-binding',
                'remote-objects',
                30,
                'Remote Objects require complete Apex controller replacement'
            )
        );
    }

    return factors;
}

// ============================================================================
// Apex Controller Confidence Scoring
// ============================================================================

/**
 * Calculate confidence for Apex controller readiness
 */
export function calculateApexConfidence(options: {
    totalMethods: number;
    auraEnabledMethods: number;
    remoteActionMethods: number;
    hasSoqlQueries: boolean;
    hasDmlOperations: boolean;
    controllerAvailable: boolean;
}): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];

    if (!options.controllerAvailable) {
        factors.push(
            createFactor(
                'apex',
                'controller-missing',
                50,
                'Apex controller not provided - methods cannot be analyzed'
            )
        );
        return factors;
    }

    // Method readiness
    if (options.totalMethods > 0) {
        const readyRatio =
            (options.auraEnabledMethods + options.remoteActionMethods) / options.totalMethods;
        const methodScore = Math.round(50 + readyRatio * 50);

        if (options.auraEnabledMethods > 0) {
            factors.push(
                createFactor(
                    'apex',
                    'auraenabled-methods',
                    methodScore,
                    `${options.auraEnabledMethods}/${options.totalMethods} methods have @AuraEnabled`
                )
            );
        } else if (options.remoteActionMethods > 0) {
            factors.push(
                createFactor(
                    'apex',
                    'remoteaction-methods',
                    methodScore - 10,
                    `${options.remoteActionMethods} @RemoteAction methods need @AuraEnabled annotation`
                )
            );
        } else {
            factors.push(
                createFactor(
                    'apex',
                    'methods-not-exposed',
                    40,
                    'No methods have @AuraEnabled - all need annotation'
                )
            );
        }
    }

    // Security considerations
    if (options.hasSoqlQueries) {
        factors.push(
            createFactor('apex', 'soql-security', 75, 'Verify FLS/CRUD checks on SOQL queries')
        );
    }

    if (options.hasDmlOperations) {
        factors.push(
            createFactor('apex', 'dml-operations', 80, 'DML operations should use imperative calls')
        );
    }

    return factors;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format confidence score for display
 */
export function formatConfidenceScore(confidence: ConversionConfidence): string {
    const emoji =
        confidence.level === 'high' ? '🟢' : confidence.level === 'medium' ? '🟡' : '🔴';
    return `${emoji} ${confidence.overall}/100 (${confidence.level.toUpperCase()})`;
}

/**
 * Generate detailed confidence report
 */
export function generateConfidenceReport(confidence: ConversionConfidence): string {
    const lines: string[] = [
        `## Conversion Confidence: ${formatConfidenceScore(confidence)}`,
        '',
        confidence.summary,
        '',
        '### Breakdown',
        `- Components: ${confidence.breakdown.components}/100`,
        `- Data Binding: ${confidence.breakdown.dataBinding}/100`,
        `- Expressions: ${confidence.breakdown.expressions}/100`,
        `- Apex Integration: ${confidence.breakdown.apex}/100`,
    ];

    const lowFactors = confidence.factors.filter((f) => f.score < 50);
    if (lowFactors.length > 0) {
        lines.push('', '### Areas Requiring Attention');
        for (const factor of lowFactors) {
            lines.push(`- **${factor.name}** (${factor.score}/100): ${factor.details || ''}`);
        }
    }

    return lines.join('\n');
}
