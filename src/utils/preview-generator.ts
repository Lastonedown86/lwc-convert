/**
 * Preview Generator - Creates standalone HTML previews of converted LWC components
 *
 * This allows users to evaluate the UI of their converted components in a browser
 * without needing a full Salesforce deployment.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';
import { LwcBundle } from './file-io';

/**
 * Mapping of Lightning Web Components to HTML approximations
 * These provide visual approximations using standard HTML + SLDS classes
 * selfContained: true means the transform returns complete element with closing tag
 */
const LIGHTNING_TO_HTML: Record<string, { tag: string; class?: string; selfContained?: boolean; transform?: (attrs: Record<string, string>) => string }> = {
  'lightning-button': {
    tag: 'button',
    class: 'slds-button slds-button_neutral',
    selfContained: true,
    transform: (attrs) => {
      let className = 'slds-button';
      if (attrs.variant === 'brand') className = 'slds-button slds-button_brand';
      else if (attrs.variant === 'destructive') className = 'slds-button slds-button_destructive';
      else if (attrs.variant === 'success') className = 'slds-button slds-button_success';
      else className = 'slds-button slds-button_neutral';
      const label = attrs.label || 'Button';
      const disabled = attrs.disabled ? 'disabled' : '';
      return `<button class="${className}" ${disabled}>${label}</button>`;
    }
  },
  'lightning-input': {
    tag: 'div',
    class: 'slds-form-element',
    transform: (attrs) => {
      const type = attrs.type || 'text';
      const label = attrs.label || 'Input';
      const placeholder = attrs.placeholder || '';
      const value = attrs.value || '';
      const required = attrs.required ? '<abbr class="slds-required" title="required">*</abbr>' : '';
      return `
        <div class="slds-form-element">
          <label class="slds-form-element__label">${required}${label}</label>
          <div class="slds-form-element__control">
            <input type="${type}" class="slds-input" placeholder="${placeholder}" value="${value}">
          </div>
        </div>`;
    }
  },
  'lightning-card': {
    tag: 'article',
    class: 'slds-card',
    transform: (attrs) => {
      const title = attrs.title || 'Card Title';
      return `
        <article class="slds-card">
          <div class="slds-card__header slds-grid">
            <header class="slds-media slds-media_center slds-has-flexi-truncate">
              <div class="slds-media__body">
                <h2 class="slds-card__header-title">
                  <span>${title}</span>
                </h2>
              </div>
            </header>
          </div>
          <div class="slds-card__body slds-card__body_inner">
            <!-- SLOT_CONTENT -->
          </div>
        </article>`;
    }
  },
  'lightning-icon': {
    tag: 'span',
    transform: (attrs) => {
      const iconName = attrs['icon-name'] || 'utility:info';
      const size = attrs.size || 'medium';
      return `<span class="slds-icon_container" title="${iconName}">
        <svg class="slds-icon slds-icon_${size}" aria-hidden="true">
          <title>${iconName}</title>
        </svg>
        <span class="slds-assistive-text">${iconName}</span>
      </span>`;
    }
  },
  'lightning-spinner': {
    tag: 'div',
    transform: (attrs) => {
      const size = attrs.size || 'medium';
      return `
        <div role="status" class="slds-spinner slds-spinner_${size}">
          <span class="slds-assistive-text">Loading</span>
          <div class="slds-spinner__dot-a"></div>
          <div class="slds-spinner__dot-b"></div>
        </div>`;
    }
  },
  'lightning-datatable': {
    tag: 'div',
    transform: () => `
      <div class="slds-table_header-fixed_container">
        <table class="slds-table slds-table_bordered slds-table_cell-buffer">
          <thead>
            <tr class="slds-line-height_reset">
              <th scope="col"><div class="slds-truncate" title="Column 1">Column 1</div></th>
              <th scope="col"><div class="slds-truncate" title="Column 2">Column 2</div></th>
              <th scope="col"><div class="slds-truncate" title="Column 3">Column 3</div></th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Sample Data</td><td>Sample Data</td><td>Sample Data</td></tr>
            <tr><td>Sample Data</td><td>Sample Data</td><td>Sample Data</td></tr>
          </tbody>
        </table>
      </div>`
  },
  'lightning-combobox': {
    tag: 'div',
    transform: (attrs) => {
      const label = attrs.label || 'Select';
      const placeholder = attrs.placeholder || '-- Select an Option --';
      return `
        <div class="slds-form-element">
          <label class="slds-form-element__label">${label}</label>
          <div class="slds-form-element__control">
            <div class="slds-combobox_container">
              <select class="slds-input slds-combobox__input">
                <option>${placeholder}</option>
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
            </div>
          </div>
        </div>`;
    }
  },
  'lightning-textarea': {
    tag: 'div',
    transform: (attrs) => {
      const label = attrs.label || 'Text Area';
      const placeholder = attrs.placeholder || '';
      return `
        <div class="slds-form-element">
          <label class="slds-form-element__label">${label}</label>
          <div class="slds-form-element__control">
            <textarea class="slds-textarea" placeholder="${placeholder}"></textarea>
          </div>
        </div>`;
    }
  },
  'lightning-checkbox-group': {
    tag: 'fieldset',
    transform: (attrs) => {
      const label = attrs.label || 'Checkbox Group';
      return `
        <fieldset class="slds-form-element">
          <legend class="slds-form-element__legend slds-form-element__label">${label}</legend>
          <div class="slds-form-element__control">
            <div class="slds-checkbox">
              <input type="checkbox" id="cb1"><label class="slds-checkbox__label" for="cb1"><span class="slds-checkbox_faux"></span><span class="slds-form-element__label">Option 1</span></label>
            </div>
            <div class="slds-checkbox">
              <input type="checkbox" id="cb2"><label class="slds-checkbox__label" for="cb2"><span class="slds-checkbox_faux"></span><span class="slds-form-element__label">Option 2</span></label>
            </div>
          </div>
        </fieldset>`;
    }
  },
  'lightning-radio-group': {
    tag: 'fieldset',
    transform: (attrs) => {
      const label = attrs.label || 'Radio Group';
      return `
        <fieldset class="slds-form-element">
          <legend class="slds-form-element__legend slds-form-element__label">${label}</legend>
          <div class="slds-form-element__control">
            <div class="slds-radio">
              <input type="radio" name="radio" id="r1"><label class="slds-radio__label" for="r1"><span class="slds-radio_faux"></span><span class="slds-form-element__label">Option 1</span></label>
            </div>
            <div class="slds-radio">
              <input type="radio" name="radio" id="r2"><label class="slds-radio__label" for="r2"><span class="slds-radio_faux"></span><span class="slds-form-element__label">Option 2</span></label>
            </div>
          </div>
        </fieldset>`;
    }
  },
  'lightning-tabset': {
    tag: 'div',
    transform: () => `
      <div class="slds-tabs_default">
        <ul class="slds-tabs_default__nav" role="tablist">
          <li class="slds-tabs_default__item slds-is-active" role="presentation">
            <a class="slds-tabs_default__link" role="tab" tabindex="0">Tab 1</a>
          </li>
          <li class="slds-tabs_default__item" role="presentation">
            <a class="slds-tabs_default__link" role="tab" tabindex="-1">Tab 2</a>
          </li>
        </ul>
        <div class="slds-tabs_default__content slds-show" role="tabpanel">
          <!-- TAB_CONTENT -->
        </div>
      </div>`
  },
  'lightning-tab': {
    tag: 'div',
    transform: (attrs) => {
      const label = attrs.label || 'Tab';
      return `<div class="slds-tabs_default__content" data-tab-label="${label}"><!-- TAB_CONTENT --></div>`;
    }
  },
  'lightning-accordion': {
    tag: 'ul',
    class: 'slds-accordion'
  },
  'lightning-accordion-section': {
    tag: 'li',
    transform: (attrs) => {
      const label = attrs.label || 'Section';
      return `
        <li class="slds-accordion__list-item">
          <section class="slds-accordion__section slds-is-open">
            <div class="slds-accordion__summary">
              <h2 class="slds-accordion__summary-heading">
                <button class="slds-button slds-button_reset slds-accordion__summary-action">
                  <span class="slds-accordion__summary-content">${label}</span>
                </button>
              </h2>
            </div>
            <div class="slds-accordion__content">
              <!-- SLOT_CONTENT -->
            </div>
          </section>
        </li>`;
    }
  },
  'lightning-badge': {
    tag: 'span',
    transform: (attrs) => {
      const label = attrs.label || 'Badge';
      return `<span class="slds-badge">${label}</span>`;
    }
  },
  'lightning-progress-bar': {
    tag: 'div',
    transform: (attrs) => {
      const value = attrs.value || '50';
      return `
        <div class="slds-progress-bar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" role="progressbar">
          <span class="slds-progress-bar__value" style="width: ${value}%;">
            <span class="slds-assistive-text">Progress: ${value}%</span>
          </span>
        </div>`;
    }
  },
  'lightning-helptext': {
    tag: 'div',
    transform: (attrs) => {
      const content = attrs.content || 'Help text';
      return `
        <div class="slds-form-element__icon">
          <button class="slds-button slds-button_icon" title="${content}">
            <span class="slds-assistive-text">Help</span>
          </button>
        </div>`;
    }
  },
  'lightning-formatted-text': {
    tag: 'span',
    transform: (attrs) => {
      const value = attrs.value || '{text}';
      return `<span class="lwc-preview-data">${value}</span>`;
    }
  },
  'lightning-formatted-number': {
    tag: 'span',
    transform: (attrs) => {
      const value = attrs.value || '0';
      return `<span class="lwc-preview-data">${value}</span>`;
    }
  },
  'lightning-formatted-date-time': {
    tag: 'span',
    transform: () => `<span class="lwc-preview-data">{date/time}</span>`
  },
  'lightning-record-edit-form': {
    tag: 'form',
    class: 'slds-form',
    transform: () => `
      <form class="slds-form">
        <div class="lwc-preview-placeholder">
          <span class="lwc-preview-label">Record Edit Form</span>
          <!-- SLOT_CONTENT -->
        </div>
      </form>`
  },
  'lightning-record-view-form': {
    tag: 'div',
    transform: () => `
      <div class="slds-form">
        <div class="lwc-preview-placeholder">
          <span class="lwc-preview-label">Record View Form</span>
          <!-- SLOT_CONTENT -->
        </div>
      </div>`
  },
  'lightning-input-field': {
    tag: 'div',
    transform: (attrs) => {
      const fieldName = attrs['field-name'] || 'Field';
      return `
        <div class="slds-form-element">
          <label class="slds-form-element__label">${fieldName}</label>
          <div class="slds-form-element__control">
            <input class="slds-input" placeholder="{${fieldName}}">
          </div>
        </div>`;
    }
  },
  'lightning-output-field': {
    tag: 'div',
    transform: (attrs) => {
      const fieldName = attrs['field-name'] || 'Field';
      return `
        <div class="slds-form-element">
          <span class="slds-form-element__label">${fieldName}</span>
          <div class="slds-form-element__control slds-form-element__static">
            <span class="lwc-preview-data">{${fieldName}}</span>
          </div>
        </div>`;
    }
  },
  'lightning-tile': {
    tag: 'div',
    transform: (attrs) => {
      const label = attrs.label || 'Tile';
      return `
        <article class="slds-tile">
          <h3 class="slds-tile__title slds-truncate">
            <a href="#">${label}</a>
          </h3>
          <div class="slds-tile__detail">
            <!-- SLOT_CONTENT -->
          </div>
        </article>`;
    }
  },
  // Custom LWC components get a placeholder
  'c-': {
    tag: 'div',
    transform: (attrs) => {
      const componentName = attrs._componentName || 'custom-component';
      return `
        <div class="lwc-preview-custom-component">
          <span class="lwc-preview-label">&lt;${componentName}&gt;</span>
          <!-- SLOT_CONTENT -->
        </div>`;
    }
  }
};

/**
 * Parse attributes from an HTML tag string
 */
function parseAttributes(tagContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // Match attribute patterns: name="value" or name={expression} or name
  const attrRegex = /(\S+?)(?:=(?:"([^"]*)"|{([^}]*)})|(?=\s|>|$))/g;
  let match;
  while ((match = attrRegex.exec(tagContent)) !== null) {
    const name = match[1];
    const value = match[2] || match[3] || 'true';
    attrs[name] = value;
  }
  return attrs;
}

/**
 * Transform LWC HTML to preview HTML
 */
function transformLwcToPreviewHtml(lwcHtml: string): string {
  let previewHtml = lwcHtml;

  // Remove <template> root tag
  previewHtml = previewHtml.replace(/^\s*<template>\s*/i, '');
  previewHtml = previewHtml.replace(/\s*<\/template>\s*$/i, '');

  // Handle lwc:if, lwc:elseif, lwc:else - keep content visible with indicator
  previewHtml = previewHtml.replace(/<template\s+lwc:if={([^}]+)}>/gi,
    '<div class="lwc-preview-conditional" data-condition="if: $1">');
  previewHtml = previewHtml.replace(/<template\s+lwc:elseif={([^}]+)}>/gi,
    '<div class="lwc-preview-conditional" data-condition="elseif: $1">');
  previewHtml = previewHtml.replace(/<template\s+lwc:else>/gi,
    '<div class="lwc-preview-conditional" data-condition="else">');

  // Legacy if:true, if:false
  previewHtml = previewHtml.replace(/<template\s+if:true={([^}]+)}>/gi,
    '<div class="lwc-preview-conditional" data-condition="if: $1">');
  previewHtml = previewHtml.replace(/<template\s+if:false={([^}]+)}>/gi,
    '<div class="lwc-preview-conditional" data-condition="if not: $1">');

  // Handle for:each loops - show one iteration with indicator
  previewHtml = previewHtml.replace(/<template\s+for:each={([^}]+)}\s+for:item="([^"]+)"(?:\s+for:index="([^"]+)")?>/gi,
    '<div class="lwc-preview-iteration" data-loop="for each $2 in $1">');

  // Close template tags that were converted to divs
  previewHtml = previewHtml.replace(/<\/template>/gi, '</div>');

  // Transform Lightning components
  for (const [lwcTag, config] of Object.entries(LIGHTNING_TO_HTML)) {
    if (lwcTag === 'c-') {
      // Handle custom components (c-* prefix)
      const customRegex = new RegExp(`<(c-[a-z0-9-]+)([^>]*)>`, 'gi');
      previewHtml = previewHtml.replace(customRegex, (_, tagName, attributes) => {
        const attrs = parseAttributes(attributes);
        attrs._componentName = tagName;
        if (config.transform) {
          return config.transform(attrs);
        }
        return `<div class="lwc-preview-custom-component" data-component="${tagName}">`;
      });
      previewHtml = previewHtml.replace(/<\/c-[a-z0-9-]+>/gi, '</div>');
    } else {
      // Handle standard Lightning components
      const selfClosingRegex = new RegExp(`<${lwcTag}([^>]*?)\\s*/>`, 'gi');
      previewHtml = previewHtml.replace(selfClosingRegex, (_, attributes) => {
        const attrs = parseAttributes(attributes);
        if (config.transform) {
          return config.transform(attrs);
        }
        const className = config.class || '';
        return `<${config.tag} class="${className}"></${config.tag}>`;
      });

      // Check if this is a self-contained transform (no slot content)
      const isSelfContained = config.selfContained ||
        (config.transform && !config.transform({}).includes('<!-- SLOT_CONTENT -->') && !config.transform({}).includes('<!-- TAB_CONTENT -->'));

      // Handle open tags
      const openRegex = new RegExp(`<${lwcTag}([^>]*)>`, 'gi');
      previewHtml = previewHtml.replace(openRegex, (_, attributes) => {
        const attrs = parseAttributes(attributes);
        if (config.transform) {
          // For components with content, we need to handle slots
          let transformed = config.transform(attrs);
          // Check if this is a container component (has SLOT_CONTENT marker)
          if (transformed.includes('<!-- SLOT_CONTENT -->')) {
            // Remove the closing part, it will be added by the close tag
            transformed = transformed.replace(/<!-- SLOT_CONTENT -->[\s\S]*$/, '');
          }
          return transformed;
        }
        const className = config.class || '';
        return `<${config.tag} class="${className}">`;
      });

      // Handle close tags - skip for self-contained transforms
      if (!isSelfContained) {
        const closeRegex = new RegExp(`</${lwcTag}>`, 'gi');
        previewHtml = previewHtml.replace(closeRegex, `</${config.tag}>`);
      } else {
        // Remove the close tag entirely for self-contained components
        const closeRegex = new RegExp(`</${lwcTag}>`, 'gi');
        previewHtml = previewHtml.replace(closeRegex, '');
      }
    }
  }

  // Transform data expressions {property} to visual placeholders
  previewHtml = previewHtml.replace(/{([a-zA-Z_][a-zA-Z0-9_.]+)}/g,
    '<span class="lwc-preview-data">{$1}</span>');

  // Transform event handlers - show as data attributes
  previewHtml = previewHtml.replace(/on(\w+)={(\w+)}/gi,
    'data-event-$1="$2"');

  return previewHtml;
}

/**
 * Generate a complete preview HTML document
 */
export function generatePreviewHtml(bundle: LwcBundle, componentCss?: string): string {
  const previewContent = transformLwcToPreviewHtml(bundle.html);
  const css = componentCss ?? bundle.css;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LWC Preview: ${bundle.name}</title>

  <!-- Salesforce Lightning Design System -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/design-system/2.24.2/styles/salesforce-lightning-design-system.min.css">

  <style>
    /* Preview-specific styles */
    body {
      font-family: 'Salesforce Sans', Arial, sans-serif;
      padding: 20px;
      background: #f4f6f9;
      margin: 0;
    }

    .preview-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 20px;
    }

    .preview-header {
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }

    .preview-header h1 {
      font-size: 1.5rem;
      color: #032d60;
      margin: 0 0 8px 0;
    }

    .preview-header .meta {
      color: #706e6b;
      font-size: 0.875rem;
    }

    .preview-notice {
      background: #fff8e1;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 20px;
      font-size: 0.875rem;
    }

    .preview-notice strong {
      color: #ff8f00;
    }

    /* Data placeholder styling */
    .lwc-preview-data {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      color: #2e7d32;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.85em;
      border: 1px dashed #81c784;
    }

    /* Conditional block styling */
    .lwc-preview-conditional {
      position: relative;
      border: 2px dashed #2196f3;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      background: rgba(33, 150, 243, 0.05);
    }

    .lwc-preview-conditional::before {
      content: attr(data-condition);
      position: absolute;
      top: -10px;
      left: 8px;
      background: #2196f3;
      color: white;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    /* Iteration block styling */
    .lwc-preview-iteration {
      position: relative;
      border: 2px dashed #9c27b0;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      background: rgba(156, 39, 176, 0.05);
    }

    .lwc-preview-iteration::before {
      content: attr(data-loop);
      position: absolute;
      top: -10px;
      left: 8px;
      background: #9c27b0;
      color: white;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    /* Custom component placeholder */
    .lwc-preview-custom-component {
      border: 2px dashed #ff9800;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      background: rgba(255, 152, 0, 0.05);
      position: relative;
    }

    .lwc-preview-custom-component > .lwc-preview-label {
      position: absolute;
      top: -10px;
      left: 8px;
      background: #ff9800;
      color: white;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 3px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    /* Placeholder for complex components */
    .lwc-preview-placeholder {
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 16px;
      text-align: center;
    }

    .lwc-preview-label {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.8rem;
      color: #757575;
    }

    /* Event handler indicators */
    [data-event-click],
    [data-event-change],
    [data-event-submit] {
      cursor: pointer;
    }

    [data-event-click]::after,
    [data-event-change]::after,
    [data-event-submit]::after {
      content: ' \u26a1';
      font-size: 0.7em;
    }

    /* Component-specific CSS from conversion */
    ${css || '/* No component CSS */'}

    /* Legend */
    .preview-legend {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
    }

    .preview-legend h3 {
      font-size: 0.875rem;
      color: #706e6b;
      margin: 0 0 12px 0;
    }

    .preview-legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 0.75rem;
    }

    .preview-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .preview-legend-item .sample {
      width: 20px;
      height: 20px;
      border-radius: 3px;
    }

    .preview-legend-item .data-sample {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 1px dashed #81c784;
    }

    .preview-legend-item .conditional-sample {
      border: 2px dashed #2196f3;
      background: rgba(33, 150, 243, 0.1);
    }

    .preview-legend-item .loop-sample {
      border: 2px dashed #9c27b0;
      background: rgba(156, 39, 176, 0.1);
    }

    .preview-legend-item .custom-sample {
      border: 2px dashed #ff9800;
      background: rgba(255, 152, 0, 0.1);
    }
  </style>
</head>
<body>
  <div class="preview-container">
    <div class="preview-header">
      <h1>${bundle.name}</h1>
      <div class="meta">LWC Preview &bull; Generated by lwc-convert</div>
    </div>

    <div class="preview-notice">
      <strong>Preview Mode:</strong> This is a visual approximation of your LWC component.
      Dynamic data is shown as placeholders, and Lightning components are rendered using SLDS styling.
      Some interactive features may not work as they would in Salesforce.
    </div>

    <div class="preview-content">
      ${previewContent}
    </div>

    <div class="preview-legend">
      <h3>Legend</h3>
      <div class="preview-legend-items">
        <div class="preview-legend-item">
          <div class="sample data-sample"></div>
          <span>Dynamic Data</span>
        </div>
        <div class="preview-legend-item">
          <div class="sample conditional-sample"></div>
          <span>Conditional Block</span>
        </div>
        <div class="preview-legend-item">
          <div class="sample loop-sample"></div>
          <span>Loop/Iteration</span>
        </div>
        <div class="preview-legend-item">
          <div class="sample custom-sample"></div>
          <span>Custom Component</span>
        </div>
        <div class="preview-legend-item">
          <span>\u26a1</span>
          <span>Event Handler</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Simple interactivity for tabs
    document.querySelectorAll('.slds-tabs_default__item').forEach(tab => {
      tab.addEventListener('click', function() {
        const parent = this.closest('.slds-tabs_default');
        parent.querySelectorAll('.slds-tabs_default__item').forEach(t => t.classList.remove('slds-is-active'));
        this.classList.add('slds-is-active');
      });
    });

    // Accordion toggle
    document.querySelectorAll('.slds-accordion__summary-action').forEach(btn => {
      btn.addEventListener('click', function() {
        const section = this.closest('.slds-accordion__section');
        section.classList.toggle('slds-is-open');
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Write the preview HTML file
 */
export async function writePreviewFile(
  outputDir: string,
  bundle: LwcBundle,
  dryRun: boolean = false
): Promise<string> {
  const previewPath = path.join(outputDir, bundle.name, `${bundle.name}-preview.html`);
  const previewHtml = generatePreviewHtml(bundle, bundle.css);

  if (dryRun) {
    logger.info(`[DRY RUN] Would write preview: ${previewPath}`);
    return previewPath;
  }

  await fs.ensureDir(path.dirname(previewPath));
  await fs.writeFile(previewPath, previewHtml, 'utf-8');
  logger.file('CREATE', previewPath);

  return previewPath;
}

/**
 * Open the preview file in the default browser
 */
export async function openPreview(previewPath: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  let command: string;

  if (platform === 'win32') {
    command = `start "" "${previewPath}"`;
  } else if (platform === 'darwin') {
    command = `open "${previewPath}"`;
  } else {
    command = `xdg-open "${previewPath}"`;
  }

  try {
    await execAsync(command);
    logger.success('Opened preview in default browser');
  } catch (error: any) {
    logger.warn(`Could not open preview automatically: ${error.message}`);
    logger.info(`Open manually: ${previewPath}`);
  }
}
