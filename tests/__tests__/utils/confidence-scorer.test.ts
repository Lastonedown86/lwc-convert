import {
    getConfidenceLevel,
    createFactor,
    aggregateConfidence,
    getComponentConfidence,
    calculateComponentsConfidence,
    getExpressionConfidence,
    calculateExpressionsConfidence,
    calculateDataBindingConfidence,
    calculateApexConfidence,
    formatConfidenceScore,
    generateConfidenceReport,
    ConfidenceFactor,
} from '../../../src/utils/confidence-scorer';

describe('Confidence Scorer Utility', () => {
    describe('getConfidenceLevel', () => {
        test('should return high for scores >= 80', () => {
            expect(getConfidenceLevel(100)).toBe('high');
            expect(getConfidenceLevel(80)).toBe('high');
            expect(getConfidenceLevel(90)).toBe('high');
        });

        test('should return medium for scores 50-79', () => {
            expect(getConfidenceLevel(79)).toBe('medium');
            expect(getConfidenceLevel(50)).toBe('medium');
            expect(getConfidenceLevel(65)).toBe('medium');
        });

        test('should return low for scores < 50', () => {
            expect(getConfidenceLevel(49)).toBe('low');
            expect(getConfidenceLevel(0)).toBe('low');
            expect(getConfidenceLevel(30)).toBe('low');
        });
    });

    describe('createFactor', () => {
        test('should create a factor with all properties', () => {
            const factor = createFactor('component', 'apex:inputText', 95, 'Direct mapping');
            expect(factor.category).toBe('component');
            expect(factor.name).toBe('apex:inputText');
            expect(factor.score).toBe(95);
            expect(factor.details).toBe('Direct mapping');
            expect(factor.weight).toBe(8); // Default component weight
        });

        test('should clamp scores to 0-100 range', () => {
            expect(createFactor('component', 'test', 150).score).toBe(100);
            expect(createFactor('component', 'test', -10).score).toBe(0);
        });

        test('should use custom weight if provided', () => {
            const factor = createFactor('component', 'test', 50, undefined, 5);
            expect(factor.weight).toBe(5);
        });
    });

    describe('aggregateConfidence', () => {
        test('should return 100 for empty factors', () => {
            const result = aggregateConfidence([]);
            expect(result.overall).toBe(100);
            expect(result.level).toBe('high');
        });

        test('should calculate weighted average', () => {
            const factors: ConfidenceFactor[] = [
                { category: 'component', name: 'test1', score: 100, weight: 10 },
                { category: 'component', name: 'test2', score: 50, weight: 10 },
            ];
            const result = aggregateConfidence(factors);
            expect(result.overall).toBe(75); // (100*10 + 50*10) / 20 = 75
        });

        test('should calculate breakdown by category', () => {
            const factors: ConfidenceFactor[] = [
                { category: 'component', name: 'comp1', score: 80, weight: 5 },
                { category: 'component', name: 'comp2', score: 60, weight: 5 },
                { category: 'data-binding', name: 'db1', score: 90, weight: 5 },
            ];
            const result = aggregateConfidence(factors);
            expect(result.breakdown.components).toBe(70); // (80+60)/2
            expect(result.breakdown.dataBinding).toBe(90);
        });

        test('should generate summary for high confidence', () => {
            const factors: ConfidenceFactor[] = [
                { category: 'component', name: 'test', score: 95, weight: 10 },
            ];
            const result = aggregateConfidence(factors);
            expect(result.level).toBe('high');
            expect(result.summary).toContain('mostly automatic');
        });

        test('should generate summary for low confidence with critical areas', () => {
            const factors: ConfidenceFactor[] = [
                { category: 'component', name: 'critical-issue', score: 30, weight: 10 },
            ];
            const result = aggregateConfidence(factors);
            expect(result.level).toBe('low');
            expect(result.summary).toContain('critical-issue');
        });
    });

    describe('getComponentConfidence', () => {
        test('should return high confidence for direct mappings', () => {
            const result = getComponentConfidence('apex:inputText');
            expect(result.score).toBeGreaterThanOrEqual(90);
        });

        test('should return medium confidence for partial mappings', () => {
            const result = getComponentConfidence('apex:selectList');
            expect(result.score).toBeGreaterThanOrEqual(50);
            expect(result.score).toBeLessThan(90);
        });

        test('should return low confidence for action components', () => {
            const result = getComponentConfidence('apex:actionFunction');
            expect(result.score).toBeLessThan(50);
        });

        test('should return 100 for HTML elements', () => {
            const result = getComponentConfidence('div');
            expect(result.score).toBe(100);
        });

        test('should handle custom VF components', () => {
            const result = getComponentConfidence('c:myCustomComponent');
            expect(result.score).toBe(50);
            expect(result.reason).toContain('Custom VF component');
        });
    });

    describe('calculateComponentsConfidence', () => {
        test('should aggregate multiple components', () => {
            const factors = calculateComponentsConfidence([
                'apex:inputText',
                'apex:outputText',
                'apex:commandButton',
            ]);
            expect(factors.length).toBe(3);
            expect(factors.every((f) => f.category === 'component')).toBe(true);
        });

        test('should count duplicate components', () => {
            const factors = calculateComponentsConfidence([
                'apex:inputText',
                'apex:inputText',
                'apex:inputText',
            ]);
            expect(factors.length).toBe(1);
            expect(factors[0].details).toContain('3 occurrences');
        });
    });

    describe('getExpressionConfidence', () => {
        test('should return high confidence for $User', () => {
            const result = getExpressionConfidence('{!$User.Id}');
            expect(result.score).toBeGreaterThanOrEqual(80);
        });

        test('should return medium-high confidence for $CurrentPage', () => {
            const result = getExpressionConfidence('{!$CurrentPage.parameters.id}');
            expect(result.score).toBeGreaterThanOrEqual(80);
        });

        test('should return medium confidence for formulas', () => {
            const result = getExpressionConfidence('{!NOT(ISBLANK(record.Id))}');
            expect(result.score).toBe(75);
        });

        test('should return 100 for simple property bindings', () => {
            const result = getExpressionConfidence('{!myProperty}');
            expect(result.score).toBe(100);
        });
    });

    describe('calculateDataBindingConfidence', () => {
        test('should return high confidence for wire adapters', () => {
            const factors = calculateDataBindingConfidence({
                hasWireAdapters: true,
                hasImperativeApex: false,
                hasRemoteActions: false,
                hasActionFunctions: false,
                actionFunctionsWithParams: 0,
                hasRemoteObjects: false,
            });
            expect(factors.length).toBe(1);
            expect(factors[0].score).toBe(90);
        });

        test('should return low confidence for remote objects', () => {
            const factors = calculateDataBindingConfidence({
                hasWireAdapters: false,
                hasImperativeApex: false,
                hasRemoteActions: false,
                hasActionFunctions: false,
                actionFunctionsWithParams: 0,
                hasRemoteObjects: true,
            });
            expect(factors.length).toBe(1);
            expect(factors[0].score).toBe(30);
        });

        test('should lower action function score when params present', () => {
            const withParams = calculateDataBindingConfidence({
                hasWireAdapters: false,
                hasImperativeApex: false,
                hasRemoteActions: false,
                hasActionFunctions: true,
                actionFunctionsWithParams: 2,
                hasRemoteObjects: false,
            });

            const withoutParams = calculateDataBindingConfidence({
                hasWireAdapters: false,
                hasImperativeApex: false,
                hasRemoteActions: false,
                hasActionFunctions: true,
                actionFunctionsWithParams: 0,
                hasRemoteObjects: false,
            });

            expect(withParams[0].score).toBeLessThan(withoutParams[0].score);
        });
    });

    describe('calculateApexConfidence', () => {
        test('should return medium confidence when controller not available', () => {
            const factors = calculateApexConfidence({
                totalMethods: 0,
                auraEnabledMethods: 0,
                remoteActionMethods: 0,
                hasSoqlQueries: false,
                hasDmlOperations: false,
                controllerAvailable: false,
            });
            expect(factors.length).toBe(1);
            expect(factors[0].score).toBe(50);
        });

        test('should return higher confidence when all methods are @AuraEnabled', () => {
            const factors = calculateApexConfidence({
                totalMethods: 5,
                auraEnabledMethods: 5,
                remoteActionMethods: 0,
                hasSoqlQueries: false,
                hasDmlOperations: false,
                controllerAvailable: true,
            });
            const methodFactor = factors.find((f) => f.name === 'auraenabled-methods');
            expect(methodFactor).toBeDefined();
            expect(methodFactor!.score).toBe(100);
        });
    });

    describe('formatConfidenceScore', () => {
        test('should format high confidence with green emoji', () => {
            const confidence = aggregateConfidence([
                { category: 'component', name: 'test', score: 90, weight: 5 },
            ]);
            const formatted = formatConfidenceScore(confidence);
            expect(formatted).toContain('🟢');
            expect(formatted).toContain('HIGH');
        });

        test('should format low confidence with red emoji', () => {
            const confidence = aggregateConfidence([
                { category: 'component', name: 'test', score: 30, weight: 5 },
            ]);
            const formatted = formatConfidenceScore(confidence);
            expect(formatted).toContain('🔴');
            expect(formatted).toContain('LOW');
        });
    });

    describe('generateConfidenceReport', () => {
        test('should generate markdown report', () => {
            const confidence = aggregateConfidence([
                { category: 'component', name: 'apex:actionFunction', score: 40, weight: 5 },
            ]);
            const report = generateConfidenceReport(confidence);
            expect(report).toContain('## Conversion Confidence');
            expect(report).toContain('### Breakdown');
            expect(report).toContain('### Areas Requiring Attention');
            expect(report).toContain('apex:actionFunction');
        });
    });
});
