import * as fs from 'fs';
import * as path from 'path';
import { parseAuraMarkup } from '../../../src/parsers/aura/markup-parser';
import { transformAuraMarkup } from '../../../src/transformers/aura-to-lwc/markup';

describe('Aura to LWC Markup Transformer', () => {
  const fixturesPath = path.join(__dirname, '../../fixtures/aura/SampleComponent');

  let sampleMarkup: string;

  beforeAll(() => {
    sampleMarkup = fs.readFileSync(
      path.join(fixturesPath, 'SampleComponent.cmp'),
      'utf-8'
    );
  });

  test('should wrap content in template tags', () => {
    const parsed = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    const result = transformAuraMarkup(parsed);

    expect(result.html).toMatch(/^<template>/);
    expect(result.html).toMatch(/<\/template>$/);
  });

  test('should convert aura:if to template lwc:if', () => {
    const parsed = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    const result = transformAuraMarkup(parsed);

    expect(result.html).toContain('lwc:if=');
    expect(result.usedDirectives).toContain('lwc:if');
  });

  test('should convert aura:iteration to for:each', () => {
    // Create a simpler markup with just iteration
    const simpleMarkup = `<aura:component>
      <aura:attribute name="items" type="List" />
      <aura:iteration items="{!v.items}" var="item">
        <div>{!item.Name}</div>
      </aura:iteration>
    </aura:component>`;
    const parsed = parseAuraMarkup(simpleMarkup, 'TestComponent');
    const result = transformAuraMarkup(parsed);

    expect(result.html).toContain('for:each=');
    expect(result.html).toContain('for:item=');
    expect(result.usedDirectives).toContain('for:each');
  });

  test('should convert lightning: components to lightning- format', () => {
    const parsed = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    const result = transformAuraMarkup(parsed);

    // These components are at the top level, not nested in aura:set
    expect(result.html).toContain('lightning-card');
    expect(result.html).toContain('lightning-button');
    expect(result.html).toContain('lightning-spinner');
    // lightning-icon is inside aura:set/aura:iteration which gets converted to TODO
    // so we check usedComponents instead
    expect(result.usedComponents).toContain('lightning-card');
    expect(result.usedComponents).toContain('lightning-button');
  });

  test('should convert {!v.x} expressions to {x}', () => {
    // Use simpler markup to test expression conversion
    const simpleMarkup = `<aura:component>
      <aura:attribute name="myValue" type="String" />
      <p>{!v.myValue}</p>
    </aura:component>`;
    const parsed = parseAuraMarkup(simpleMarkup, 'TestComponent');
    const result = transformAuraMarkup(parsed);

    // Should not contain {!v.
    expect(result.html).not.toContain('{!v.');

    // Should contain converted property reference
    expect(result.html).toContain('{myValue}');
  });

  test('should convert {!c.x} expressions to {x}', () => {
    // Use simpler markup with controller reference
    const simpleMarkup = `<aura:component>
      <lightning:button label="Click" onclick="{!c.handleClick}"/>
    </aura:component>`;
    const parsed = parseAuraMarkup(simpleMarkup, 'TestComponent');
    const result = transformAuraMarkup(parsed);

    // Should not contain {!c.
    expect(result.html).not.toContain('{!c.');

    // Should contain converted method reference
    expect(result.html).toContain('{handleClick}');
  });

  test('should convert aura:id to data-id', () => {
    // Use simpler markup with aura:id
    const simpleMarkup = `<aura:component>
      <div aura:id="myDiv">Content</div>
    </aura:component>`;
    const parsed = parseAuraMarkup(simpleMarkup, 'TestComponent');
    const result = transformAuraMarkup(parsed);

    expect(result.html).toContain('data-id="myDiv"');
  });

  test('should track used components', () => {
    const parsed = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    const result = transformAuraMarkup(parsed);

    expect(result.usedComponents).toContain('lightning-card');
    expect(result.usedComponents).toContain('lightning-button');
  });

  test('should generate warnings for manual review items', () => {
    const parsed = parseAuraMarkup(sampleMarkup, 'SampleComponent');
    const result = transformAuraMarkup(parsed);

    // Should have some warnings about iteration keys, etc.
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
