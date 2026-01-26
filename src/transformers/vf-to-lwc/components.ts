/**
 * VF Component to LWC Component transformation utilities
 */

import { VfComponent } from '../../parsers/vf/page-parser';
// import { logger } from '../../utils/logger';
import {
  getComponentConfidence,
  getConfidenceLevel,
} from '../../utils/confidence-scorer';

export interface LwcComponentSuggestion {
  vfComponent: string;
  lwcComponent: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100 numeric score
  confidenceFactors: string[]; // Reasons for the score
  notes: string;
  codeExample?: string;
}

export interface FormFieldConversion {
  vfField: VfComponent;
  lwcCode: string;
  jsProperty: string;
  handlerCode?: string;
  warnings: string[];
}

/**
 * Map of VF form components to LWC equivalents with code examples
 */
const formComponentMappings: Record<
  string,
  {
    lwc: string;
    type?: string;
    codeGen: (attrs: Record<string, string>) => FormFieldConversion;
  }
> = {
  'apex:inputtext': {
    lwc: 'lightning-input',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:inputText', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-input
    type="text"
    label="${attrs.label || 'Input'}"
    value={${getPropertyName(attrs.value)}}
    onchange={${getHandlerName(attrs.value)}}
></lightning-input>`,
      jsProperty: `${getPropertyName(attrs.value)} = '';`,
      handlerCode: `${getHandlerName(attrs.value)}(event) {
    this.${getPropertyName(attrs.value)} = event.target.value;
}`,
      warnings: [],
    }),
  },
  'apex:inputtextarea': {
    lwc: 'lightning-textarea',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:inputTextarea', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-textarea
    label="${attrs.label || 'Text Area'}"
    value={${getPropertyName(attrs.value)}}
    onchange={${getHandlerName(attrs.value)}}
></lightning-textarea>`,
      jsProperty: `${getPropertyName(attrs.value)} = '';`,
      handlerCode: `${getHandlerName(attrs.value)}(event) {
    this.${getPropertyName(attrs.value)} = event.target.value;
}`,
      warnings: [],
    }),
  },
  'apex:inputcheckbox': {
    lwc: 'lightning-input',
    type: 'checkbox',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:inputCheckbox', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-input
    type="checkbox"
    label="${attrs.label || 'Checkbox'}"
    checked={${getPropertyName(attrs.value || attrs.selected)}}
    onchange={${getHandlerName(attrs.value || attrs.selected)}}
></lightning-input>`,
      jsProperty: `${getPropertyName(attrs.value || attrs.selected)} = false;`,
      handlerCode: `${getHandlerName(attrs.value || attrs.selected)}(event) {
    this.${getPropertyName(attrs.value || attrs.selected)} = event.target.checked;
}`,
      warnings: [],
    }),
  },
  'apex:selectlist': {
    lwc: 'lightning-combobox',
    codeGen: (attrs) => {
      const isMultiple = attrs.multiselect === 'true';
      return {
        vfField: { name: 'apex:selectList', attributes: attrs, children: [], location: {} },
        lwcCode: isMultiple
          ? `<lightning-dual-listbox
    label="${attrs.label || 'Select'}"
    source-label="Available"
    selected-label="Selected"
    options={${getPropertyName(attrs.value)}Options}
    value={${getPropertyName(attrs.value)}}
    onchange={${getHandlerName(attrs.value)}}
></lightning-dual-listbox>`
          : `<lightning-combobox
    label="${attrs.label || 'Select'}"
    options={${getPropertyName(attrs.value)}Options}
    value={${getPropertyName(attrs.value)}}
    onchange={${getHandlerName(attrs.value)}}
></lightning-combobox>`,
        jsProperty: `${getPropertyName(attrs.value)} = '';
${getPropertyName(attrs.value)}Options = []; // TODO: Populate with { label, value } objects`,
        handlerCode: `${getHandlerName(attrs.value)}(event) {
    this.${getPropertyName(attrs.value)} = event.detail.value;
}`,
        warnings: isMultiple
          ? ['Multi-select converted to lightning-dual-listbox']
          : [],
      };
    },
  },
  'apex:commandbutton': {
    lwc: 'lightning-button',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:commandButton', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-button
    label="${attrs.value || 'Submit'}"
    variant="${attrs.styleclass?.includes('btn-primary') ? 'brand' : 'neutral'}"
    onclick={${getHandlerName(attrs.action)}}
></lightning-button>`,
      jsProperty: '',
      handlerCode: `async ${getHandlerName(attrs.action)}() {
    // TODO: Implement button action
    // Original Apex action: ${attrs.action}
}`,
      warnings: ['Button action needs conversion to imperative Apex call'],
    }),
  },
  'apex:outputtext': {
    lwc: 'text-interpolation',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:outputText', attributes: attrs, children: [], location: {} },
      lwcCode: attrs.escape === 'false'
        ? `<lightning-formatted-rich-text value={${getPropertyName(attrs.value)}}></lightning-formatted-rich-text>`
        : `{${getPropertyName(attrs.value)}}`,
      jsProperty: `${getPropertyName(attrs.value)} = '';`,
      warnings: attrs.escape === 'false'
        ? ['Unescaped HTML output - verify XSS safety']
        : [],
    }),
  },
  'apex:outputfield': {
    lwc: 'lightning-output-field',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:outputField', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-output-field field-name="${getFieldName(attrs.value)}"></lightning-output-field>`,
      jsProperty: '',
      warnings: ['Must be inside lightning-record-view-form or lightning-record-form'],
    }),
  },
  'apex:inputfield': {
    lwc: 'lightning-input-field',
    codeGen: (attrs) => ({
      vfField: { name: 'apex:inputField', attributes: attrs, children: [], location: {} },
      lwcCode: `<lightning-input-field field-name="${getFieldName(attrs.value)}"></lightning-input-field>`,
      jsProperty: '',
      warnings: ['Must be inside lightning-record-edit-form'],
    }),
  },
};

/**
 * Extract property name from VF expression
 */
function getPropertyName(vfExpr: string = ''): string {
  // {!record.Name} -> recordName
  // {!accountName} -> accountName
  const cleaned = vfExpr.replace(/\{!|\}/g, '');

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    return parts.map((p, i) => (i === 0 ? p.toLowerCase() : capitalize(p))).join('');
  }

  return cleaned || 'value';
}

/**
 * Extract field API name from VF expression
 */
function getFieldName(vfExpr: string = ''): string {
  const cleaned = vfExpr.replace(/\{!|\}/g, '');

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    return parts[parts.length - 1];
  }

  return cleaned;
}

/**
 * Generate handler method name
 */
function getHandlerName(vfExpr: string = ''): string {
  const propName = getPropertyName(vfExpr);
  return `handle${capitalize(propName)}Change`;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a VF form field component to LWC
 */
export function convertFormField(component: VfComponent): FormFieldConversion {
  const compType = component.name.toLowerCase();

  if (formComponentMappings[compType]) {
    return formComponentMappings[compType].codeGen(component.attributes);
  }

  // Generic fallback
  return {
    vfField: component,
    lwcCode: `<!-- TODO: Convert ${component.name} manually -->`,
    jsProperty: '',
    warnings: [`No automatic conversion available for ${component.name}`],
  };
}

/**
 * Suggest LWC components for VF components
 */
export function suggestLwcComponents(vfComponents: VfComponent[]): LwcComponentSuggestion[] {
  const suggestions: LwcComponentSuggestion[] = [];

  for (const comp of vfComponents) {
    const compType = comp.name.toLowerCase();

    if (formComponentMappings[compType]) {
      const mapping = formComponentMappings[compType];
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: mapping.lwc,
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: `Direct mapping available`,
        codeExample: mapping.codeGen(comp.attributes).lwcCode,
      });
    } else if (compType.startsWith('apex:pageblock')) {
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: 'lightning-card',
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: 'Page blocks can be replaced with lightning-card for similar visual grouping',
      });
    } else if (compType === 'apex:detail') {
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: 'lightning-record-form',
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: 'Use lightning-record-form with mode="view" or "edit"',
        codeExample: `<lightning-record-form
    record-id={recordId}
    object-api-name="Account"
    layout-type="Full"
    mode="view">
</lightning-record-form>`,
      });
    } else if (compType === 'apex:relatedlist') {
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: 'lightning-related-list-view',
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: 'Direct LWC equivalent available',
        codeExample: `<lightning-related-list-view
    related-list-id="Contacts"
    record-id={recordId}>
</lightning-related-list-view>`,
      });
    } else if (compType === 'apex:iframe') {
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: 'iframe',
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: 'Standard iframe works in LWC, but check CSP restrictions',
      });
    } else if (compType.startsWith('apex:')) {
      const { score, reason } = getComponentConfidence(compType);
      suggestions.push({
        vfComponent: comp.name,
        lwcComponent: 'custom-implementation',
        confidence: getConfidenceLevel(score),
        confidenceScore: score,
        confidenceFactors: [reason],
        notes: 'No direct mapping - requires custom implementation',
      });
    }
  }

  return suggestions;
}

/**
 * Generate lightning-datatable column definitions from VF pageBlockTable
 */
export function generateDataTableColumns(
  tableComponent: VfComponent
): { columns: string; warnings: string[] } {
  const warnings: string[] = [];
  const columns: Array<{
    label: string;
    fieldName: string;
    type?: string;
  }> = [];

  for (const child of tableComponent.children) {
    if (child.name.toLowerCase() === 'apex:column') {
      const label = child.attributes.headerlabel ||
        child.attributes.headervalue ||
        child.attributes.value?.replace(/\{!|\}/g, '').split('.').pop() ||
        'Column';

      const value = child.attributes.value || '';
      const varName = tableComponent.attributes.var || 'item';
      const fieldName = value.replace(/\{!|\}/g, '').replace(`${varName}.`, '');

      // Handle action columns
      if (child.children.some((c) => c.name.toLowerCase().includes('command'))) {
        columns.push({
          label,
          fieldName,
          type: 'action',
        });
        warnings.push(`Column with actions detected - implement row actions`);
      } else if (child.children.some((c) => c.name.toLowerCase().includes('link'))) {
        columns.push({
          label,
          fieldName,
          type: 'url',
        });
      } else {
        columns.push({
          label,
          fieldName,
        });
      }
    }
  }

  const columnsCode = `columns = [
${columns.map((col) => `    { label: '${col.label}', fieldName: '${col.fieldName}'${col.type ? `, type: '${col.type}'` : ''} }`).join(',\n')}
];`;

  return { columns: columnsCode, warnings };
}

/**
 * Generate form submit handler for VF form conversion
 */
export function generateFormHandler(
  formComponent: VfComponent,
  _apexAction?: string
): string {
  const fields = formComponent.children.filter(
    (c) =>
      c.name.toLowerCase().includes('input') ||
      c.name.toLowerCase().includes('select')
  );

  const fieldAssignments = fields
    .map((f) => {
      const propName = getPropertyName(f.attributes.value);
      return `            ${propName}: this.${propName}`;
    })
    .join(',\n');

  return `async handleSubmit(event) {
    event.preventDefault();

    try {
        const formData = {
${fieldAssignments}
        };

        // TODO: Call Apex method
        // const result = await saveRecord({ data: formData });

        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Record saved successfully',
                variant: 'success'
            })
        );
    } catch (error) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'An error occurred',
                variant: 'error'
            })
        );
    }
}`;
}
