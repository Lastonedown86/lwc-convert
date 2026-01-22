import * as fs from 'fs';
import * as path from 'path';
import { parseAuraController } from '../../../src/parsers/aura/controller-parser';

describe('Aura Controller Parser', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/aura/SampleComponent');

  let sampleController: string;

  beforeAll(() => {
    sampleController = fs.readFileSync(
      path.join(fixturesPath, 'SampleComponentController.js'),
      'utf-8'
    );
  });

  test('should parse controller functions', () => {
    const result = parseAuraController(sampleController);

    expect(result.functions.length).toBe(3);

    const funcNames = result.functions.map((f) => f.name);
    expect(funcNames).toContain('doInit');
    expect(funcNames).toContain('handleRefresh');
    expect(funcNames).toContain('handleSelect');
  });

  test('should identify function parameters', () => {
    const result = parseAuraController(sampleController);

    const doInit = result.functions.find((f) => f.name === 'doInit');
    expect(doInit?.params).toContain('component');
    expect(doInit?.params).toContain('event');
    expect(doInit?.params).toContain('helper');

    expect(doInit?.hasComponent).toBe(true);
    expect(doInit?.hasEvent).toBe(true);
    expect(doInit?.hasHelper).toBe(true);
  });

  test('should detect component.get/set usage', () => {
    const result = parseAuraController(sampleController);

    const doInit = result.functions.find((f) => f.name === 'doInit');
    expect(doInit?.usesGetSet).toBe(true);

    // Should detect attribute access
    const loadingAccess = doInit?.attributeAccess.find((a) => a.name === 'isLoading');
    expect(loadingAccess).toBeDefined();
    expect(loadingAccess?.operation).toBe('set');
  });

  test('should detect helper calls', () => {
    const result = parseAuraController(sampleController);

    const doInit = result.functions.find((f) => f.name === 'doInit');
    expect(doInit?.helperCalls).toContain('loadAccountData');
  });

  test('should detect event firing', () => {
    const result = parseAuraController(sampleController);

    const handleSelect = result.functions.find((f) => f.name === 'handleSelect');
    expect(handleSelect?.eventFires.length).toBeGreaterThan(0);
  });

  test('should preserve raw source', () => {
    const result = parseAuraController(sampleController);
    expect(result.rawSource).toBe(sampleController);
  });
});
