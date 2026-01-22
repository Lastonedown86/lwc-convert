import * as fs from 'fs';
import * as path from 'path';
import { parseVfPage } from '../../../src/parsers/vf/page-parser';

describe('Visualforce Page Parser', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/vf');

  let samplePage: string;

  beforeAll(() => {
    samplePage = fs.readFileSync(path.join(fixturesPath, 'SamplePage.page'), 'utf-8');
  });

  test('should parse page name', () => {
    const result = parseVfPage(samplePage, 'SamplePage');
    expect(result.pageName).toBe('SamplePage');
  });

  test('should extract standard controller', () => {
    const result = parseVfPage(samplePage, 'SamplePage');
    expect(result.pageAttributes.standardController).toBe('Account');
  });

  test('should extract controller extensions', () => {
    const result = parseVfPage(samplePage, 'SamplePage');
    expect(result.pageAttributes.extensions).toContain('SamplePageController');
  });

  test('should detect lightningStylesheets attribute', () => {
    const result = parseVfPage(samplePage, 'SamplePage');
    expect(result.pageAttributes.lightningStylesheets).toBe(true);
  });

  test('should find VF components', () => {
    const result = parseVfPage(samplePage, 'SamplePage');

    // Top-level should contain apex:page
    const topLevelNames = result.components.map((c) => c.name.toLowerCase());
    expect(topLevelNames).toContain('apex:page');
    
    // apex:form should be a child of apex:page
    const apexPage = result.components.find(c => c.name.toLowerCase() === 'apex:page');
    expect(apexPage).toBeDefined();
    
    // Collect all component names recursively
    function getAllComponentNames(comp: any): string[] {
      let names = [comp.name.toLowerCase()];
      for (const child of comp.children || []) {
        names = names.concat(getAllComponentNames(child));
      }
      return names;
    }
    
    const allComponentNames = result.components.flatMap(getAllComponentNames);
    expect(allComponentNames).toContain('apex:form');
    expect(allComponentNames).toContain('apex:pageblock');
    expect(allComponentNames).toContain('apex:pageblocktable');
  });

  test('should extract expressions', () => {
    const result = parseVfPage(samplePage, 'SamplePage');

    expect(result.expressions.length).toBeGreaterThan(0);

    // Should find field expressions
    const fieldExpressions = result.expressions.filter((e) => e.type === 'field');
    expect(fieldExpressions.length).toBeGreaterThan(0);
  });

  test('should find action functions', () => {
    const result = parseVfPage(samplePage, 'SamplePage');

    expect(result.actionFunctions.length).toBeGreaterThanOrEqual(1);

    const refreshAction = result.actionFunctions.find(
      (af) => af.name === 'refreshContacts'
    );
    expect(refreshAction).toBeDefined();
    expect(refreshAction?.rerender).toBe('contactPanel');
  });

  test('should find rerendered sections', () => {
    const result = parseVfPage(samplePage, 'SamplePage');
    expect(result.rerenderedSections).toContain('contactPanel');
  });
});
