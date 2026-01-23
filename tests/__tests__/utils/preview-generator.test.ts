/**
 * Tests for the Preview Generator utility
 */

import { generatePreviewHtml } from '../../../src/utils/preview-generator';
import { LwcBundle } from '../../../src/utils/file-io';

describe('Preview Generator', () => {
  describe('generatePreviewHtml', () => {
    it('should generate valid HTML document structure', () => {
      const bundle: LwcBundle = {
        name: 'testComponent',
        html: '<template><div>Hello World</div></template>',
        js: 'export default class TestComponent extends LightningElement {}',
        meta: '<LightningComponentBundle></LightningComponentBundle>',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('<title>LWC Preview: testComponent</title>');
      expect(result).toContain('Hello World');
    });

    it('should include SLDS CSS from CDN', () => {
      const bundle: LwcBundle = {
        name: 'testComponent',
        html: '<template><div>Test</div></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('salesforce-lightning-design-system');
    });

    it('should transform lightning-button to HTML button with SLDS classes', () => {
      const bundle: LwcBundle = {
        name: 'buttonTest',
        html: '<template><lightning-button label="Click Me" variant="brand"></lightning-button></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('<button');
      expect(result).toContain('slds-button');
      expect(result).toContain('Click Me');
    });

    it('should transform lightning-input to form element with SLDS styling', () => {
      const bundle: LwcBundle = {
        name: 'inputTest',
        html: '<template><lightning-input label="Name" placeholder="Enter name"></lightning-input></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('slds-form-element');
      expect(result).toContain('slds-input');
      expect(result).toContain('Name');
    });

    it('should transform lightning-card to article with SLDS card styling', () => {
      const bundle: LwcBundle = {
        name: 'cardTest',
        html: '<template><lightning-card title="My Card"><p>Content</p></lightning-card></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('slds-card');
      expect(result).toContain('My Card');
    });

    it('should handle lwc:if conditionals with visual indicators', () => {
      const bundle: LwcBundle = {
        name: 'conditionalTest',
        html: '<template><template lwc:if={isVisible}><div>Visible content</div></template></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('lwc-preview-conditional');
      expect(result).toContain('data-condition="if: isVisible"');
      expect(result).toContain('Visible content');
    });

    it('should handle for:each iterations with visual indicators', () => {
      const bundle: LwcBundle = {
        name: 'iterationTest',
        html: '<template><template for:each={items} for:item="item"><div key={item.id}>{item.name}</div></template></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('lwc-preview-iteration');
      expect(result).toContain('data-loop');
    });

    it('should transform data expressions to visual placeholders', () => {
      const bundle: LwcBundle = {
        name: 'expressionTest',
        html: '<template><div>{userName}</div></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('lwc-preview-data');
      expect(result).toContain('{userName}');
    });

    it('should handle custom c-* components with placeholder', () => {
      const bundle: LwcBundle = {
        name: 'customComponentTest',
        html: '<template><c-custom-child title="Child"></c-custom-child></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('lwc-preview-custom-component');
      expect(result).toContain('c-custom-child');
    });

    it('should include component CSS when provided', () => {
      const bundle: LwcBundle = {
        name: 'styledComponent',
        html: '<template><div class="custom">Styled</div></template>',
        js: '',
        css: '.custom { color: red; }',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('.custom { color: red; }');
    });

    it('should include legend explaining visual indicators', () => {
      const bundle: LwcBundle = {
        name: 'legendTest',
        html: '<template><div>Test</div></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('preview-legend');
      expect(result).toContain('Dynamic Data');
      expect(result).toContain('Conditional Block');
      expect(result).toContain('Loop/Iteration');
      expect(result).toContain('Custom Component');
    });

    it('should include preview notice explaining limitations', () => {
      const bundle: LwcBundle = {
        name: 'noticeTest',
        html: '<template><div>Test</div></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('preview-notice');
      expect(result).toContain('Preview Mode');
    });

    it('should transform lightning-spinner correctly', () => {
      const bundle: LwcBundle = {
        name: 'spinnerTest',
        html: '<template><lightning-spinner size="large"></lightning-spinner></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('slds-spinner');
    });

    it('should transform lightning-datatable to table placeholder', () => {
      const bundle: LwcBundle = {
        name: 'tableTest',
        html: '<template><lightning-datatable data={records} columns={columns}></lightning-datatable></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('slds-table');
      expect(result).toContain('Sample Data');
    });

    it('should handle self-closing lightning components', () => {
      const bundle: LwcBundle = {
        name: 'selfClosingTest',
        html: '<template><lightning-badge label="Status" /><lightning-icon icon-name="utility:check" /></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('slds-badge');
      expect(result).toContain('Status');
    });

    it('should handle legacy if:true and if:false directives', () => {
      const bundle: LwcBundle = {
        name: 'legacyIfTest',
        html: '<template><template if:true={showMe}><div>Shown</div></template><template if:false={hideMe}><div>Hidden</div></template></template>',
        js: '',
        meta: '',
      };

      const result = generatePreviewHtml(bundle);

      expect(result).toContain('data-condition="if: showMe"');
      expect(result).toContain('data-condition="if not: hideMe"');
    });
  });
});
