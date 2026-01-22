import * as fs from 'fs';
import * as path from 'path';
import { parseAuraMarkup } from '../../../src/parsers/aura/markup-parser';

describe('Aura Markup Parser', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/aura/SampleComponent');

  let sampleMarkup: string;

  beforeAll(() => {
    sampleMarkup = fs.readFileSync(
      path.join(fixturesPath, 'SampleComponent.cmp'),
      'utf-8'
    );
  });

  test('should parse component name', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    expect(result.componentName).toBe('SampleComponent');
  });

  test('should extract controller reference', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    expect(result.controller).toBe('SampleController');
  });

  test('should parse implements interfaces', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    expect(result.implements).toContain('flexipage:availableForAllPageTypes');
    expect(result.implements).toContain('force:hasRecordId');
  });

  test('should parse aura:attribute definitions', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');

    expect(result.attributes.length).toBeGreaterThanOrEqual(4);

    const recordIdAttr = result.attributes.find((a) => a.name === 'recordId');
    expect(recordIdAttr).toBeDefined();
    expect(recordIdAttr?.type).toBe('String');
    expect(recordIdAttr?.access).toBe('public');

    const contactsAttr = result.attributes.find((a) => a.name === 'contacts');
    expect(contactsAttr).toBeDefined();
    expect(contactsAttr?.type).toBe('List');
    expect(contactsAttr?.default).toBe('[]');
  });

  test('should parse aura:handler definitions', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');

    const initHandler = result.handlers.find((h) => h.name === 'init');
    expect(initHandler).toBeDefined();
    expect(initHandler?.action).toContain('doInit');
  });

  test('should parse aura:registerEvent definitions', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');

    expect(result.registeredEvents.length).toBe(1);
    expect(result.registeredEvents[0].name).toBe('accountSelected');
  });

  test('should extract expressions from markup', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');

    // Should find v.* expressions
    const attrExpressions = result.expressions.filter((e) => e.type === 'attribute');
    expect(attrExpressions.length).toBeGreaterThan(0);

    // Should find c.* expressions
    const controllerExpressions = result.expressions.filter(
      (e) => e.type === 'controller'
    );
    expect(controllerExpressions.length).toBeGreaterThan(0);
  });

  test('should find component dependencies', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');

    expect(result.dependencies).toContain('lightning:card');
    expect(result.dependencies).toContain('lightning:button');
    expect(result.dependencies).toContain('lightning:spinner');
    expect(result.dependencies).toContain('lightning:icon');
  });

  test('should have body nodes', () => {
    const result = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    expect(result.body.length).toBeGreaterThan(0);
  });
});
