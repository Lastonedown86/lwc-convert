/**
 * Session Store Tests
 * Tests for the session storage functionality that persists conversion data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TestComparisonResult, BehaviorTest } from '../../../src/generators/test-comparison';

// Session file location - persistent across invocations
const mockSessionDir = path.join(os.tmpdir(), 'lwc-convert-test-sessions');

// Helper to create a valid BehaviorTest
function createBehavior(
  id: string,
  category: BehaviorTest['category'],
  name: string,
  auraPattern: string,
  lwcPattern: string
): BehaviorTest {
  return {
    id,
    category,
    name,
    description: `Test behavior: ${name}`,
    auraBehavior: { pattern: auraPattern },
    lwcBehavior: { pattern: lwcPattern },
    testCode: {
      before: `// Before test for ${name}`,
      after: `// After test for ${name}`,
    },
  };
}

// Helper to create a valid TestComparisonResult
function createMockComparison(
  componentName: string,
  lwcName: string,
  behaviors: Array<{ id: string; category: BehaviorTest['category']; name: string; aura: string; lwc: string }>
): TestComparisonResult {
  return {
    componentName,
    lwcName,
    behaviorTests: behaviors.map(b => createBehavior(b.id, b.category, b.name, b.aura, b.lwc)),
    beforeTestFile: '// Before test file',
    afterTestFile: '// After test file',
    comparisonReport: '# Comparison Report',
  };
}

// Clean up before tests
beforeAll(async () => {
  try {
    await fs.promises.rm(mockSessionDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

// Clean up after all tests
afterAll(async () => {
  try {
    await fs.promises.rm(mockSessionDir, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('Session Store', () => {
  // Import fresh module for each test suite
  let SessionStoreClass: any;
  let sessionStore: any;

  beforeEach(async () => {
    // Clear module cache to get fresh instance
    jest.resetModules();
    
    // Import the module
    const module = await import('../../../src/utils/session-store');
    sessionStore = module.sessionStore;
    
    // Initialize the session
    await sessionStore.init();
  });

  afterEach(async () => {
    // Clean up session after each test
    try {
      await sessionStore.cleanup();
    } catch { /* ignore */ }
  });

  describe('Session Initialization', () => {
    test('should create a unique session ID', async () => {
      const sessionId = sessionStore.getSessionId();
      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^lwc-convert-\d+-[a-z0-9]+$/);
    });

    test('should create session directory', async () => {
      const sessionDir = sessionStore.getSessionDir();
      expect(sessionDir).toBeTruthy();
      expect(fs.existsSync(sessionDir)).toBe(true);
    });

    test('should create subdirectories', async () => {
      const sessionDir = sessionStore.getSessionDir();
      expect(fs.existsSync(path.join(sessionDir, 'conversions'))).toBe(true);
      expect(fs.existsSync(path.join(sessionDir, 'patterns'))).toBe(true);
      expect(fs.existsSync(path.join(sessionDir, 'tests'))).toBe(true);
    });

    test('should create session.json file', async () => {
      const sessionDir = sessionStore.getSessionDir();
      const sessionFile = path.join(sessionDir, 'session.json');
      expect(fs.existsSync(sessionFile)).toBe(true);
      
      const content = JSON.parse(await fs.promises.readFile(sessionFile, 'utf-8'));
      expect(content.sessionId).toBe(sessionStore.getSessionId());
      expect(content.startedAt).toBeTruthy();
      expect(content.platform).toBe(os.platform());
    });
  });

  describe('Session Summary', () => {
    test('should return empty summary for new session', () => {
      const summary = sessionStore.getSessionSummary();
      expect(summary.sessionId).toBe(sessionStore.getSessionId());
      expect(summary.conversions).toBe(0);
      expect(summary.totalBehaviors).toBe(0);
      expect(summary.patternLibrary).toEqual([]);
      expect(summary.commonWarnings).toEqual([]);
    });

    test('should track startedAt timestamp', () => {
      const summary = sessionStore.getSessionSummary();
      expect(summary.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('Store Conversion', () => {
    const mockTestComparison = createMockComparison(
      'TestComponent',
      'test-component',
      [
        { id: 'behavior-1', category: 'lifecycle', name: 'Init handler', aura: 'aura:handler name="init"', lwc: 'connectedCallback()' },
        { id: 'behavior-2', category: 'data', name: 'recordId attribute', aura: '<aura:attribute name="recordId">', lwc: '@api recordId' },
        { id: 'behavior-3', category: 'event', name: 'Custom event', aura: '<aura:registerEvent name="myEvent">', lwc: 'this.dispatchEvent(new CustomEvent(...))' },
      ]
    );

    test('should store conversion and return record', async () => {
      const record = await sessionStore.storeConversion(
        'aura',
        'TestComponent',
        'test-component',
        '/path/to/source',
        '/path/to/output',
        mockTestComparison,
        ['Warning 1', 'Warning 2']
      );

      expect(record).toBeTruthy();
      expect(record.id).toMatch(/^conv-\d+-[a-z0-9]+$/);
      expect(record.sourceType).toBe('aura');
      expect(record.sourceName).toBe('TestComponent');
      expect(record.targetName).toBe('test-component');
      expect(record.behaviorCount).toBe(3);
      expect(record.warnings).toEqual(['Warning 1', 'Warning 2']);
      expect(record.success).toBe(true);
    });

    test('should update session summary after storing conversion', async () => {
      await sessionStore.storeConversion(
        'aura',
        'TestComponent',
        'test-component',
        '/path/to/source',
        '/path/to/output',
        mockTestComparison,
        ['Warning 1']
      );

      const summary = sessionStore.getSessionSummary();
      expect(summary.conversions).toBe(1);
      expect(summary.totalBehaviors).toBe(3);
    });

    test('should extract and store patterns', async () => {
      await sessionStore.storeConversion(
        'aura',
        'TestComponent',
        'test-component',
        '/path/to/source',
        '/path/to/output',
        mockTestComparison,
        []
      );

      const summary = sessionStore.getSessionSummary();
      expect(summary.patternLibrary.length).toBe(3);
      
      const lifecyclePattern = summary.patternLibrary.find(
        (p: any) => p.type === 'lifecycle'
      );
      expect(lifecyclePattern).toBeTruthy();
      expect(lifecyclePattern.auraPattern).toBe('aura:handler name="init"');
      expect(lifecyclePattern.lwcPattern).toBe('connectedCallback()');
    });

    test('should track common warnings', async () => {
      // Store multiple conversions with same warning
      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out',
        mockTestComparison,
        ['Common warning', 'Unique warning 1']
      );
      
      await sessionStore.storeConversion(
        'aura', 'Comp2', 'comp-2', '/src', '/out',
        mockTestComparison,
        ['Common warning', 'Unique warning 2']
      );

      const summary = sessionStore.getSessionSummary();
      const commonWarning = summary.commonWarnings.find(
        (w: any) => w.warning === 'Common warning'
      );
      expect(commonWarning).toBeTruthy();
      expect(commonWarning.count).toBe(2);
    });

    test('should persist conversion to file', async () => {
      const record = await sessionStore.storeConversion(
        'aura',
        'TestComponent',
        'test-component',
        '/path/to/source',
        '/path/to/output',
        mockTestComparison,
        []
      );

      const conversionFile = path.join(
        sessionStore.getSessionDir(),
        'conversions',
        `${record.id}.json`
      );
      expect(fs.existsSync(conversionFile)).toBe(true);
      
      const saved = JSON.parse(await fs.promises.readFile(conversionFile, 'utf-8'));
      expect(saved.sourceName).toBe('TestComponent');
      expect(saved.behaviorCount).toBe(3);
    });

    test('should persist test comparison to file', async () => {
      await sessionStore.storeConversion(
        'aura',
        'TestComponent',
        'test-component',
        '/path/to/source',
        '/path/to/output',
        mockTestComparison,
        []
      );

      const testFile = path.join(
        sessionStore.getSessionDir(),
        'tests',
        'test-component-comparison.json'
      );
      expect(fs.existsSync(testFile)).toBe(true);
    });
  });

  describe('Get Conversions', () => {
    const mockTestComparison = createMockComparison('Test', 'test', [
      { id: 'b1', category: 'data', name: 'test', aura: 'aura', lwc: 'lwc' },
    ]);

    test('should return all conversions', async () => {
      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', mockTestComparison, []
      );
      await sessionStore.storeConversion(
        'vf', 'Page1', 'page-1', '/src', '/out', mockTestComparison, []
      );

      const conversions = sessionStore.getConversions();
      expect(conversions.length).toBe(2);
      expect(conversions[0].sourceName).toBe('Comp1');
      expect(conversions[1].sourceName).toBe('Page1');
    });

    test('should get conversion by ID', async () => {
      const record = await sessionStore.storeConversion(
        'aura', 'TestComp', 'test-comp', '/src', '/out', mockTestComparison, []
      );

      const found = sessionStore.getConversion(record.id);
      expect(found).toBeTruthy();
      expect(found.sourceName).toBe('TestComp');
    });

    test('should return undefined for non-existent ID', () => {
      const found = sessionStore.getConversion('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('Pattern Library', () => {
    const createPatternComparison = (patterns: Array<{ category: BehaviorTest['category']; aura: string; lwc: string }>) => 
      createMockComparison('Test', 'test', patterns.map((p, i) => ({
        id: `b${i}`,
        category: p.category,
        name: `Pattern ${i}`,
        aura: p.aura,
        lwc: p.lwc,
      })));

    test('should increment frequency for repeated patterns', async () => {
      const comparison = createPatternComparison([
        { category: 'lifecycle', aura: 'init handler', lwc: 'connectedCallback' },
      ]);

      // Store same pattern twice
      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', comparison, []
      );
      await sessionStore.storeConversion(
        'aura', 'Comp2', 'comp-2', '/src', '/out', comparison, []
      );

      const summary = sessionStore.getSessionSummary();
      const pattern = summary.patternLibrary.find(
        (p: any) => p.auraPattern === 'init handler'
      );
      expect(pattern.frequency).toBe(2);
    });

    test('should get common patterns by type', async () => {
      const comparison = createPatternComparison([
        { category: 'lifecycle', aura: 'init', lwc: 'connected' },
        { category: 'event', aura: 'fire event', lwc: 'dispatch' },
        { category: 'apex', aura: 'action', lwc: 'wire' },
      ]);

      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', comparison, []
      );

      const lifecyclePatterns = sessionStore.getCommonPatterns('lifecycle');
      expect(lifecyclePatterns.length).toBe(1);
      expect(lifecyclePatterns[0].auraPattern).toBe('init');
    });

    test('should get suggestions based on pattern', async () => {
      const comparison = createPatternComparison([
        { category: 'ui', aura: '<lightning:button>', lwc: '<lightning-button>' },
        { category: 'ui', aura: '<lightning:card>', lwc: '<lightning-card>' },
      ]);

      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', comparison, []
      );

      const suggestions = sessionStore.getSuggestions('lightning');
      expect(suggestions.length).toBe(2);
    });

    test('should persist pattern library to file', async () => {
      const comparison = createPatternComparison([
        { category: 'data', aura: 'v.attr', lwc: 'this.attr' },
      ]);

      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', comparison, []
      );

      const libraryFile = path.join(
        sessionStore.getSessionDir(),
        'patterns',
        'library.json'
      );
      expect(fs.existsSync(libraryFile)).toBe(true);
      
      const library = JSON.parse(await fs.promises.readFile(libraryFile, 'utf-8'));
      expect(library.length).toBe(1);
      expect(library[0].auraPattern).toBe('v.attr');
    });
  });

  describe('Test Results Tracking', () => {
    const mockTestComparison = createMockComparison('TestComp', 'test-comp', [
      { id: 'b1', category: 'data', name: 'test', aura: 'p1', lwc: 'p2' },
    ]);

    test('should update test results for conversion', async () => {
      const record = await sessionStore.storeConversion(
        'aura', 'TestComp', 'test-comp', '/src', '/out', mockTestComparison, []
      );

      await sessionStore.updateTestResults(record.id, {
        totalTests: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        runAt: new Date(),
      });

      const updated = sessionStore.getConversion(record.id);
      expect(updated.testResults).toBeTruthy();
      expect(updated.testResults.passed).toBe(8);
      expect(updated.testResults.failed).toBe(2);
      expect(updated.success).toBe(false); // Has failures
    });

    test('should mark conversion successful when all tests pass', async () => {
      const record = await sessionStore.storeConversion(
        'aura', 'TestComp', 'test-comp', '/src', '/out', mockTestComparison, []
      );

      await sessionStore.updateTestResults(record.id, {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
      });

      const updated = sessionStore.getConversion(record.id);
      expect(updated.success).toBe(true);
    });
  });

  describe('Similar Conversion Detection', () => {
    const mockTestComparison = createMockComparison('Test', 'test', []);

    test('should find similar conversion by name', async () => {
      await sessionStore.storeConversion(
        'aura', 'AccountCard', 'account-card', '/src', '/out', mockTestComparison, []
      );

      const similar = sessionStore.findSimilarConversion('Account');
      expect(similar).toBeTruthy();
      expect(similar.sourceName).toBe('AccountCard');
    });

    test('should return undefined when no similar found', async () => {
      await sessionStore.storeConversion(
        'aura', 'ContactList', 'contact-list', '/src', '/out', mockTestComparison, []
      );

      const similar = sessionStore.findSimilarConversion('Account');
      expect(similar).toBeUndefined();
    });
  });

  describe('Behavior Suggestions', () => {
    test('should suggest behaviors based on past conversions', async () => {
      const comparison1 = createMockComparison('Comp1', 'comp-1', [
        { id: 'b1', category: 'lifecycle', name: 'Init handler', aura: 'init', lwc: 'connected' },
        { id: 'b2', category: 'data', name: 'recordId', aura: 'v.recordId', lwc: '@api recordId' },
        { id: 'b3', category: 'apex', name: 'Apex call', aura: 'action', lwc: '@wire' },
      ]);

      await sessionStore.storeConversion(
        'aura', 'Comp1', 'comp-1', '/src', '/out', comparison1, []
      );

      // Get suggestions for a component that has some of the same behaviors
      const suggestions = sessionStore.getBehaviorSuggestions('aura', ['Init handler']);
      
      // Should suggest behaviors that appeared with Init handler but aren't in current list
      expect(suggestions).toContain('recordId');
      expect(suggestions).toContain('Apex call');
      expect(suggestions).not.toContain('Init handler');
    });
  });

  describe('Session Report Generation', () => {
    test('should generate markdown report', async () => {
      const mockTestComparison = createMockComparison('TestComponent', 'test-component', [
        { id: 'b1', category: 'data', name: 'test', aura: 'aura-pattern', lwc: 'lwc-pattern' },
      ]);

      await sessionStore.storeConversion(
        'aura', 'TestComponent', 'test-component', '/src', '/out',
        mockTestComparison, ['Warning message']
      );

      const report = sessionStore.generateSessionReport();
      
      expect(report).toContain('# LWC Convert Session Report');
      expect(report).toContain('## Session Info');
      expect(report).toContain('## Conversion Summary');
      expect(report).toContain('TestComponent');
      expect(report).toContain('test-component');
      expect(report).toContain('## Common Warnings');
      expect(report).toContain('## Pattern Library');
    });

    test('should include conversion table in report', async () => {
      const mockTestComparison = createMockComparison('TestComp', 'test-comp', [
        { id: 'b1', category: 'data', name: 'test', aura: '', lwc: '' },
      ]);

      await sessionStore.storeConversion('aura', 'Comp1', 'comp-1', '/src', '/out', mockTestComparison, []);
      await sessionStore.storeConversion('vf', 'Page1', 'page-1', '/src', '/out', mockTestComparison, []);

      const report = sessionStore.generateSessionReport();
      
      expect(report).toContain('| 1 |');
      expect(report).toContain('| 2 |');
      expect(report).toContain('Comp1');
      expect(report).toContain('Page1');
      expect(report).toContain('aura');
      expect(report).toContain('vf');
    });
  });

  describe('Session Cleanup', () => {
    test('should remove session directory on cleanup', async () => {
      const sessionDir = sessionStore.getSessionDir();
      expect(fs.existsSync(sessionDir)).toBe(true);

      await sessionStore.cleanup();

      expect(fs.existsSync(sessionDir)).toBe(false);
    });

    test('should reset internal state on cleanup', async () => {
      const mockTestComparison = createMockComparison('Test', 'test', []);

      await sessionStore.storeConversion(
        'aura', 'Test', 'test', '/src', '/out', mockTestComparison, []
      );

      const beforeCleanup = sessionStore.getConversions();
      expect(beforeCleanup.length).toBe(1);

      await sessionStore.cleanup();

      const afterCleanup = sessionStore.getConversions();
      expect(afterCleanup.length).toBe(0);
    });
  });
});

describe('Session Persistence Across Invocations', () => {
  // This test simulates multiple CLI invocations by reinitializing the store
  
  test('should resume existing session within expiry window', async () => {
    // First "invocation" - create session and store conversion
    jest.resetModules();
    const { sessionStore: store1 } = await import('../../../src/utils/session-store');
    await store1.init();
    
    const originalSessionId = store1.getSessionId();
    
    const mockTestComparison: import('../../../src/generators/test-comparison').TestComparisonResult = {
      componentName: 'FirstComponent',
      lwcName: 'first-component',
      behaviorTests: [
        {
          id: 'b1',
          category: 'data',
          name: 'test',
          description: 'Test behavior',
          auraBehavior: { pattern: 'p1' },
          lwcBehavior: { pattern: 'p2' },
          testCode: { before: '// before', after: '// after' },
        },
      ],
      beforeTestFile: '',
      afterTestFile: '',
      comparisonReport: '',
    };

    await store1.storeConversion(
      'aura', 'FirstComponent', 'first-component', '/src', '/out',
      mockTestComparison, []
    );

    // Second "invocation" - should resume same session
    jest.resetModules();
    const { sessionStore: store2 } = await import('../../../src/utils/session-store');
    await store2.init();

    // Should have same session ID
    expect(store2.getSessionId()).toBe(originalSessionId);
    
    // Should have the conversion from first invocation
    const conversions = store2.getConversions();
    expect(conversions.length).toBe(1);
    expect(conversions[0].sourceName).toBe('FirstComponent');

    // Clean up
    await store2.cleanup();
  });
});
