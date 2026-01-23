/**
 * Transform Visualforce page markup to LWC HTML template
 */

// Types available if needed: Element, Node, Text
// import { Element, Node, Text } from 'domhandler';
import { ParsedVfPage, VfComponent } from '../../parsers/vf/page-parser';
import { logger } from '../../utils/logger';
import * as vfMapping from '../../mappings/vf-to-lwc.json';

export interface TransformedVfMarkup {
  html: string;
  warnings: string[];
  usedComponents: string[];
  requiredImports: RequiredImport[];
  formFields: FormField[];
  dataTableColumns: DataTableColumn[];
  detectedFormulas: DetectedFormula[];
  controllerProperties: ControllerProperty[];
  hasInputFields: boolean;
}

export interface DetectedFormula {
  original: string;
  getterName: string;
  suggestedLogic: string;
}

export interface ControllerProperty {
  name: string;
  fields: string[];
}

export interface RequiredImport {
  module: string;
  items: string[];
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  vfComponent: string;
}

export interface DataTableColumn {
  label: string;
  fieldName: string;
  type?: string;
}

interface ComponentMapping {
  lwc: string | null;
  alternativeLwc?: string;
  attributes?: Record<string, string | null>;
  events?: Record<string, string>;
  typeOverride?: string;
  notes?: string;
}

// Create a normalized mapping with lowercase keys for case-insensitive lookup
const rawMappings = (vfMapping as any).components as Record<string, ComponentMapping>;
const componentMappings: Record<string, ComponentMapping> = {};
for (const [key, value] of Object.entries(rawMappings)) {
  componentMappings[key.toLowerCase()] = value;
}

/**
 * Convert VF formula to a JavaScript getter name
 * e.g., "NOT(ISBLANK(contactRecord.Id))" -> "hasContactRecord"
 */
function convertFormulaToGetterName(formula: string): string {
  // Common patterns
  const normalized = formula.trim();

  // NOT(ISBLANK(x.y)) or NOT(ISNULL(x.y)) -> hasX
  const notIsBlankMatch = normalized.match(/NOT\s*\(\s*(?:ISBLANK|ISNULL)\s*\(\s*(\w+)(?:\.(\w+))?\s*\)\s*\)/i);
  if (notIsBlankMatch) {
    const objName = notIsBlankMatch[1];
    return `has${objName.charAt(0).toUpperCase() + objName.slice(1)}`;
  }

  // ISBLANK(x.y) or ISNULL(x.y) -> isXEmpty
  const isBlankMatch = normalized.match(/(?:ISBLANK|ISNULL)\s*\(\s*(\w+)(?:\.(\w+))?\s*\)/i);
  if (isBlankMatch) {
    const objName = isBlankMatch[1];
    return `is${objName.charAt(0).toUpperCase() + objName.slice(1)}Empty`;
  }

  // NOT(x) -> isNotX
  const notMatch = normalized.match(/NOT\s*\(\s*(\w+)\s*\)/i);
  if (notMatch) {
    const propName = notMatch[1];
    return `isNot${propName.charAt(0).toUpperCase() + propName.slice(1)}`;
  }

  // AND(...) -> combinedCondition
  if (/^AND\s*\(/i.test(normalized)) {
    return 'combinedCondition';
  }

  // OR(...) -> anyCondition
  if (/^OR\s*\(/i.test(normalized)) {
    return 'anyCondition';
  }

  // IF(...) -> conditionalValue
  if (/^IF\s*\(/i.test(normalized)) {
    return 'conditionalValue';
  }

  // LEN(x) > 0 or similar -> hasX
  const lenMatch = normalized.match(/LEN\s*\(\s*(\w+)\s*\)/i);
  if (lenMatch) {
    const propName = lenMatch[1];
    return `has${propName.charAt(0).toUpperCase() + propName.slice(1)}`;
  }

  // Default: sanitize the formula to create a getter name
  const sanitized = normalized
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return `computed_${sanitized.substring(0, 30)}`;
}

/**
 * Parse formula arguments, handling nested parentheses
 */
function parseFormulaArgs(formula: string, funcName: string): string[] {
  // Find the opening paren after function name
  const startIdx = formula.toUpperCase().indexOf(funcName.toUpperCase() + '(') + funcName.length + 1;
  if (startIdx < funcName.length + 1) return [];

  let depth = 1;
  let current = '';
  const args: string[] = [];
  
  for (let i = startIdx; i < formula.length && depth > 0; i++) {
    const char = formula[i];
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        // End of function - push final argument if any
        if (current.trim()) args.push(current.trim());
        break;
      }
      current += char;
    } else if (char === ',' && depth === 1) {
      // Separator at top level
      if (current.trim()) args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  return args;
}

/**
 * Convert VF formula to JavaScript expression
 */
function convertFormulaToJsExpression(formula: string, depth = 0): string {
  const normalized = formula.trim();
  
  // Prevent infinite recursion
  if (depth > 10) return `/* ${formula} */`;
  
  // NOT(x) -> !(x)
  if (/^NOT\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'NOT');
    if (args.length === 1) {
      const innerJs = convertFormulaToJsExpression(args[0], depth + 1);
      return `!(${innerJs})`;
    }
  }
  
  // ISBLANK(x) or ISNULL(x) -> x == null || x === ''
  if (/^(?:ISBLANK|ISNULL)\s*\(/i.test(normalized)) {
    const funcName = normalized.match(/^(ISBLANK|ISNULL)/i)?.[1] || 'ISBLANK';
    const args = parseFormulaArgs(normalized, funcName);
    if (args.length === 1) {
      const propRef = convertPropertyReference(args[0]);
      return `(${propRef} == null || ${propRef} === '')`;
    }
  }
  
  // AND(a, b, c) -> (a && b && c)
  if (/^AND\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'AND');
    if (args.length > 0) {
      const converted = args.map(arg => convertFormulaToJsExpression(arg, depth + 1));
      return `(${converted.join(' && ')})`;
    }
  }
  
  // OR(a, b, c) -> (a || b || c)
  if (/^OR\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'OR');
    if (args.length > 0) {
      const converted = args.map(arg => convertFormulaToJsExpression(arg, depth + 1));
      return `(${converted.join(' || ')})`;
    }
  }
  
  // IF(condition, trueVal, falseVal) -> condition ? trueVal : falseVal
  if (/^IF\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'IF');
    if (args.length === 3) {
      const cond = convertFormulaToJsExpression(args[0], depth + 1);
      const trueVal = convertFormulaToJsExpression(args[1], depth + 1);
      const falseVal = convertFormulaToJsExpression(args[2], depth + 1);
      return `(${cond} ? ${trueVal} : ${falseVal})`;
    }
  }
  
  // LEN(x) -> x?.length || 0
  if (/^LEN\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'LEN');
    if (args.length === 1) {
      const propRef = convertPropertyReference(args[0]);
      return `(${propRef}?.length || 0)`;
    }
  }
  
  // CONTAINS(text, substring) -> text?.includes(substring)
  if (/^CONTAINS\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'CONTAINS');
    if (args.length === 2) {
      const text = convertPropertyReference(args[0]);
      const substring = args[1].trim();
      return `${text}?.includes(${substring})`;
    }
  }
  
  // BEGINS(text, prefix) -> text?.startsWith(prefix)
  if (/^BEGINS\s*\(/i.test(normalized)) {
    const args = parseFormulaArgs(normalized, 'BEGINS');
    if (args.length === 2) {
      const text = convertPropertyReference(args[0]);
      const prefix = args[1].trim();
      return `${text}?.startsWith(${prefix})`;
    }
  }
  
  // Handle simple property references or literals
  return convertPropertyReference(normalized);
}

/**
 * Convert VF property reference to JS this.property reference
 */
function convertPropertyReference(ref: string): string {
  const trimmed = ref.trim();
  
  // String literal
  if (/^['"].*['"]$/.test(trimmed)) return trimmed;
  
  // Number literal
  if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  
  // Boolean literals
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase();
  
  // Property reference like objectName.fieldName or simple property
  if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmed)) {
    const parts = trimmed.split('.');
    if (parts.length === 1) {
      return `this.${parts[0]}`;
    }
    // Use optional chaining for nested properties
    return `this.${parts[0]}?.${parts.slice(1).join('?.')}`;
  }
  
  return trimmed;
}

/**
 * Convert Visualforce expression to LWC expression
 */
function convertExpression(expr: string): {
  converted: string;
  warnings: string[];
  detectedFormula?: DetectedFormula;
  controllerProperty?: ControllerProperty;
} {
  const warnings: string[] = [];
  let converted = expr;
  let detectedFormula: DetectedFormula | undefined;
  let controllerProperty: ControllerProperty | undefined;

  // Handle URLFOR function - common in VF for static resources
  // {!URLFOR($Resource.name, 'path')} -> needs static resource import
  if (converted.includes('URLFOR')) {
    warnings.push('URLFOR found - use @salesforce/resourceUrl import with string concatenation');
    // Extract resource name from URLFOR($Resource.name, 'path')
    converted = converted.replace(
      /\{!URLFOR\(\$Resource\.(\w+),\s*['"]([^'"]+)['"]\)\}/gi,
      '{$1Resource_$2}'
    );
    // Simple URLFOR($Resource.name)
    converted = converted.replace(
      /\{!URLFOR\(\$Resource\.(\w+)\)\}/gi,
      '{$1Resource}'
    );
  }

  // Handle $MessageChannel - Lightning Message Service
  if (converted.includes('$MessageChannel')) {
    warnings.push('$MessageChannel found - import from @salesforce/messageChannel and use lightning/messageService');
    converted = converted.replace(
      /\{!\$MessageChannel\.([^}]+)\}/g,
      '{messageChannel_$1}'
    );
  }

  // {!$CurrentPage.parameters.x} -> needs currentPageReference wire
  if (converted.includes('$CurrentPage')) {
    warnings.push('$CurrentPage found - use @wire(CurrentPageReference) to access URL parameters');
    converted = converted.replace(/\{!\$CurrentPage\.parameters\.(\w+)\}/g, '{pageRef.state.$1}');
    converted = converted.replace(/\{!\$CurrentPage\.Name\}/gi, '{pageName}');
    converted = converted.replace(/\{!\$CurrentPage\.([^}]+)\}/g, '{pageRef.$1}');
  }

  // {!$User.x} -> needs user info import
  if (converted.includes('$User')) {
    warnings.push('$User found - import from @salesforce/user');
    converted = converted.replace(/\{!\$User\.(\w+)\}/g, '{user$1}');
  }

  // {!$Label.namespace.label} -> needs label import
  if (converted.includes('$Label')) {
    warnings.push('$Label found - import labels from @salesforce/label');
    converted = converted.replace(/\{!\$Label\.(\w+)\.(\w+)\}/g, '{label_$1_$2}');
    converted = converted.replace(/\{!\$Label\.(\w+)\}/g, '{label_$1}');
  }

  // {!$Resource.name} -> needs static resource import
  if (converted.includes('$Resource')) {
    warnings.push('$Resource found - import from @salesforce/resourceUrl');
    converted = converted.replace(/\{!\$Resource\.(\w+)\}/g, '{$1Resource}');
  }

  // {!$ObjectType.Account.fields.Name.label} -> needs schema import
  if (converted.includes('$ObjectType')) {
    warnings.push('$ObjectType found - import from @salesforce/schema');
    converted = converted.replace(
      /\{!\$ObjectType\.(\w+)\.fields\.(\w+)\.(\w+)\}/g,
      '{schema_$1_$2_$3}'
    );
  }

  // {!$Api.Session_ID} and other $Api globals
  if (converted.includes('$Api')) {
    warnings.push('$Api found - these globals may not be available in LWC, check alternatives');
    converted = converted.replace(/\{!\$Api\.(\w+)\}/g, '{api$1}');
  }

  // Handle VF formula functions (NOT, ISBLANK, AND, OR, IF, etc.)
  // These need to be converted to JavaScript getter references
  const formulaFunctionPattern = /\{!(NOT|ISBLANK|ISNULL|AND|OR|IF|LEN|CONTAINS|BEGINS|INCLUDES)\s*\(/i;
  if (formulaFunctionPattern.test(converted)) {
    // Extract the formula and convert to a getter name
    const formulaMatch = converted.match(/\{!([^}]+)\}/);
    if (formulaMatch) {
      const formula = formulaMatch[1];
      // Generate a getter name based on the formula content
      const getterName = convertFormulaToGetterName(formula);
      // Convert formula to JavaScript expression for the getter body
      const jsExpression = convertFormulaToJsExpression(formula);
      const suggestedLogic = `return ${jsExpression};`;
      detectedFormula = {
        original: formula,
        getterName,
        suggestedLogic,
      };
      warnings.push(`VF formula detected - implement getter: get ${getterName}()`);
      converted = converted.replace(/\{![^}]+\}/g, `{${getterName}}`);
    }
  }

  // Detect controller property bindings like {!controllerProp.field}
  // This pattern matches property.field (not starting with $)
  const controllerPropMatch = converted.match(/\{!(\w+)\.(\w+)\}/);
  if (controllerPropMatch && !controllerPropMatch[1].startsWith('$')) {
    const propName = controllerPropMatch[1];
    const fieldName = controllerPropMatch[2];
    // Check if this looks like a controller property (not a formula function)
    if (!/^(NOT|ISBLANK|ISNULL|AND|OR|IF|LEN|CONTAINS|BEGINS|INCLUDES)$/i.test(propName)) {
      controllerProperty = {
        name: propName,
        fields: [fieldName],
      };
    }
  }

  // Handle remaining simple VF expressions: {!property} -> {property}
  // This must come AFTER the $-prefixed handlers to avoid double-processing
  converted = converted.replace(/\{!([^}]+)\}/g, (match, inner) => {
    // Skip if already processed (contains our replacement markers)
    if (inner.startsWith('$') || inner.includes('URLFOR')) {
      // These should have been handled above, log a warning if not
      warnings.push(`Unhandled VF expression: ${match}`);
      return match;
    }
    return `{${inner}}`;
  });

  return { converted, warnings, detectedFormula, controllerProperty };
}

/**
 * Get the LWC tag name for a VF component
 */
function getVfToLwcTag(vfTag: string): { lwcTag: string; mapping?: ComponentMapping; warnings: string[] } {
  const warnings: string[] = [];
  const lowerTag = vfTag.toLowerCase();

  const mapping = componentMappings[lowerTag];

  if (mapping) {
    if (mapping.lwc === null) {
      warnings.push(`${vfTag} has no direct LWC equivalent - ${mapping.notes || 'manual conversion required'}`);
      return { lwcTag: 'div', mapping, warnings };
    }
    if (mapping.notes) {
      warnings.push(`${vfTag}: ${mapping.notes}`);
    }
    return { lwcTag: mapping.lwc, mapping, warnings };
  }

  // Handle apex: prefix generically
  if (lowerTag.startsWith('apex:')) {
    warnings.push(`No specific mapping for ${vfTag} - using generic conversion`);
    return { lwcTag: `div`, warnings };
  }

  // Pass through HTML tags
  return { lwcTag: vfTag, warnings };
}

/**
 * Transform VF component attributes to LWC attributes
 */
function transformAttributes(
  vfAttrs: Record<string, string>,
  mapping?: ComponentMapping
): { attrs: Record<string, string>; warnings: string[] } {
  const attrs: Record<string, string> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(vfAttrs)) {
    // Skip VF-specific attributes that don't translate
    if (['id', 'rendered'].includes(key.toLowerCase())) {
      if (key.toLowerCase() === 'id') {
        attrs['data-id'] = value;
      }
      continue;
    }

    // Check for attribute mapping
    let lwcAttr = key;
    if (mapping?.attributes && key in mapping.attributes) {
      const mappedAttr = mapping.attributes[key];
      if (mappedAttr === null) {
        warnings.push(`Attribute "${key}" has no LWC equivalent`);
        continue;
      }
      lwcAttr = mappedAttr;
    }

    // Convert attribute name from camelCase to kebab-case
    lwcAttr = lwcAttr.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

    // Convert expression in value
    const { converted, warnings: exprWarnings } = convertExpression(value);
    warnings.push(...exprWarnings);

    attrs[lwcAttr] = converted;
  }

  return { attrs, warnings };
}

/**
 * Transform a VF component to LWC HTML
 */
function transformVfComponent(
  comp: VfComponent,
  indent: string,
  context: {
    warnings: string[];
    usedComponents: string[];
    formFields: FormField[];
    dataTableColumns: DataTableColumn[];
    requiredImports: Map<string, Set<string>>;
    detectedFormulas?: DetectedFormula[];
    controllerProperties?: ControllerProperty[];
    hasInputFields?: boolean;
  }
): string {
  const lowerName = comp.name.toLowerCase();
  const { lwcTag, mapping, warnings: tagWarnings } = getVfToLwcTag(comp.name);

  context.warnings.push(...tagWarnings);

  // Special handling for specific VF components
  if (lowerName === 'apex:form') {
    return transformForm(comp, indent, context);
  }

  if (lowerName === 'apex:pageblocktable' || lowerName === 'apex:datatable') {
    return transformDataTable(comp, indent, context);
  }

  if (lowerName === 'apex:repeat') {
    return transformRepeat(comp, indent, context);
  }

  if (lowerName === 'apex:outputpanel' || lowerName === 'apex:panelgroup') {
    return transformPanel(comp, indent, context);
  }

  if (lowerName === 'apex:pagemessages' || lowerName === 'apex:messages') {
    context.warnings.push('Page messages should use ShowToastEvent for notifications');
    return `${indent}<!-- TODO: Replace with ShowToastEvent or custom error display -->`;
  }

  if (lowerName === 'apex:actionfunction') {
    context.warnings.push(`apex:actionFunction "${comp.attributes.name}" - convert to imperative Apex`);
    return `${indent}<!-- actionFunction "${comp.attributes.name}" converted to imperative Apex call -->`;
  }

  if (lowerName === 'apex:actionstatus') {
    context.usedComponents.push('lightning-spinner');
    return `${indent}<template if:true={isLoading}>\n${indent}    <lightning-spinner alternative-text="Loading"></lightning-spinner>\n${indent}</template>`;
  }

  // apex:stylesheet - handled via loadStyle in JS, not in HTML
  if (lowerName === 'apex:stylesheet') {
    const resourceValue = comp.attributes.value || '';
    context.warnings.push(`apex:stylesheet detected - use loadStyle() in renderedCallback. Resource: ${resourceValue}`);
    // Add required import tracking
    if (!context.requiredImports.has('lightning/platformResourceLoader')) {
      context.requiredImports.set('lightning/platformResourceLoader', new Set());
    }
    context.requiredImports.get('lightning/platformResourceLoader')!.add('loadStyle');
    // Return empty - stylesheet loading happens in JS
    return '';
  }

  // apex:includeScript - handled via loadScript in JS
  if (lowerName === 'apex:includescript') {
    const resourceValue = comp.attributes.value || '';
    context.warnings.push(`apex:includeScript detected - use loadScript() in connectedCallback. Resource: ${resourceValue}`);
    if (!context.requiredImports.has('lightning/platformResourceLoader')) {
      context.requiredImports.set('lightning/platformResourceLoader', new Set());
    }
    context.requiredImports.get('lightning/platformResourceLoader')!.add('loadScript');
    return '';
  }

  // apex:outputText - convert to direct text interpolation
  if (lowerName === 'apex:outputtext') {
    const valueAttr = comp.attributes.value || '';
    if (valueAttr) {
      const { converted, warnings: exprWarnings } = convertExpression(valueAttr);
      context.warnings.push(...exprWarnings);
      // If the converted expression has curly braces, it's a data binding
      // Otherwise it's static text
      if (converted.startsWith('{') && converted.endsWith('}')) {
        return `${indent}${converted}`;
      }
      // Handle escape attribute (HTML escaping) - LWC does this by default
      if (comp.attributes.escape === 'false') {
        context.warnings.push('apex:outputText with escape="false" detected - use lwc:dom="manual" with innerHTML for raw HTML');
        return `${indent}<span lwc:dom="manual" data-output-text>${converted}</span>`;
      }
      return `${indent}${converted}`;
    }
    // No value attribute, process children as content
    if (comp.textContent) {
      const { converted } = convertExpression(comp.textContent);
      return `${indent}${converted}`;
    }
    return '';
  }

  // apex:slds - SLDS is automatically available in LWC
  if (lowerName === 'apex:slds') {
    context.warnings.push('apex:slds removed - SLDS is automatically available in LWC');
    return '';
  }

  // apex:remoteObjects / apex:remoteObjectModel - convert to wire adapter pattern
  if (lowerName === 'apex:remoteobjects') {
    context.warnings.push('apex:remoteObjects detected - convert to @wire adapter or imperative Apex calls');
    let comment = `${indent}<!-- TODO: Replace Remote Objects with @wire adapter or imperative Apex -->\n`;
    comment += `${indent}<!-- Remote Objects detected: -->`;
    // Process children to extract object models
    for (const child of comp.children) {
      if (child.name.toLowerCase() === 'apex:remoteobjectmodel') {
        const objName = child.attributes.name || 'Unknown';
        const fields = child.attributes.fields || '';
        comment += `\n${indent}<!--   Object: ${objName}, Fields: ${fields} -->`;
      }
    }
    return comment;
  }

  if (lowerName === 'apex:remoteobjectmodel') {
    // Handled by parent apex:remoteObjects, but in case it appears standalone
    const objName = comp.attributes.name || 'Unknown';
    const fields = comp.attributes.fields || '';
    context.warnings.push(`apex:remoteObjectModel "${objName}" - convert to @wire adapter`);
    return `${indent}<!-- TODO: Remote Object "${objName}" (fields: ${fields}) - use @wire adapter -->`;
  }

  // Handle c:componentName - custom VF components to LWC format
  if (lowerName.startsWith('c:')) {
    const componentName = lowerName.substring(2);
    // Convert camelCase to kebab-case for LWC
    const lwcName = 'c-' + componentName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    context.warnings.push(`Custom VF component ${comp.name} - verify LWC equivalent exists as <${lwcName}>`);

    // Transform attributes for the custom component
    const { attrs, warnings: attrWarnings } = transformAttributes(comp.attributes, undefined);
    context.warnings.push(...attrWarnings);

    // Build attribute string
    const attrParts: string[] = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (value.startsWith('{') && value.endsWith('}')) {
        attrParts.push(`${key}=${value}`);
      } else {
        attrParts.push(`${key}="${value}"`);
      }
    }
    const attrString = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';

    // Process children
    if (comp.children.length === 0 && !comp.textContent) {
      return `${indent}<${lwcName}${attrString}></${lwcName}>`;
    }

    let childContent = '';
    for (const child of comp.children) {
      childContent += transformVfComponent(child, indent + '    ', context) + '\n';
    }
    if (comp.textContent) {
      const { converted } = convertExpression(comp.textContent);
      childContent += indent + '    ' + converted + '\n';
    }

    return `${indent}<${lwcName}${attrString}>\n${childContent}${indent}</${lwcName}>`;
  }

  // Transform attributes
  const { attrs, warnings: attrWarnings } = transformAttributes(comp.attributes, mapping);
  context.warnings.push(...attrWarnings);

  // Track used components
  if (lwcTag.startsWith('lightning-')) {
    context.usedComponents.push(lwcTag);
  }

  // Track form fields
  if (lowerName.includes('input') || lowerName.includes('select')) {
    context.formFields.push({
      name: comp.attributes.value || comp.attributes.id || 'unknown',
      type: lowerName,
      label: comp.attributes.label,
      vfComponent: comp.name,
    });
  }

  // Build attribute string
  const attrParts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value.startsWith('{') && value.endsWith('}')) {
      attrParts.push(`${key}=${value}`);
    } else {
      attrParts.push(`${key}="${value}"`);
    }
  }

  // Add type override if needed (e.g., checkbox input)
  if (mapping?.typeOverride) {
    attrParts.push(`type="${mapping.typeOverride}"`);
  }

  const attrString = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';

  // Detect list elements with data-* attributes that suggest dynamic rendering
  const isListElement = ['ul', 'ol', 'tbody'].includes(lwcTag.toLowerCase());
  const hasDataAttribute = Object.keys(attrs).some(k => k.startsWith('data-'));
  let listComment = '';
  if (isListElement && hasDataAttribute && comp.children.length === 0) {
    context.warnings.push(`Empty ${lwcTag} with data attribute detected - likely needs template iteration (for:each)`);
    listComment = `${indent}<!-- TODO: Add template iteration for dynamic content -->\n`;
    listComment += `${indent}<!-- Example:\n`;
    listComment += `${indent}<template for:each={items} for:item="item">\n`;
    listComment += `${indent}    <li key={item.Id} onclick={handleItemClick}>{item.Name}</li>\n`;
    listComment += `${indent}</template>\n`;
    listComment += `${indent}-->\n`;
  }

  // Process children
  if (comp.children.length === 0 && !comp.textContent) {
    if (listComment) {
      return `${listComment}${indent}<${lwcTag}${attrString}>\n${indent}</${lwcTag}>`;
    }
    return `${indent}<${lwcTag}${attrString}></${lwcTag}>`;
  }

  let childContent = '';
  for (const child of comp.children) {
    childContent += transformVfComponent(child, indent + '    ', context) + '\n';
  }

  if (comp.textContent) {
    const { converted } = convertExpression(comp.textContent);
    childContent += indent + '    ' + converted + '\n';
  }

  return `${indent}<${lwcTag}${attrString}>\n${childContent}${indent}</${lwcTag}>`;
}

/**
 * Check if a component tree contains input fields (apex:inputField, apex:inputText, etc.)
 */
function hasInputComponents(comp: VfComponent): boolean {
  const inputTypes = [
    'apex:inputfield',
    'apex:inputtext',
    'apex:inputtextarea',
    'apex:inputcheckbox',
    'apex:inputsecret',
    'apex:inputhidden',
    'apex:selectlist',
    'apex:selectcheckboxes',
    'apex:selectradio',
  ];
  
  const lowerName = comp.name.toLowerCase();
  if (inputTypes.includes(lowerName)) {
    return true;
  }
  
  // Check children recursively
  for (const child of comp.children) {
    if (hasInputComponents(child)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Transform apex:form to lightning-record-edit-form (if inputs exist) or div wrapper
 */
function transformForm(
  comp: VfComponent,
  indent: string,
  context: {
    warnings: string[];
    usedComponents: string[];
    formFields: FormField[];
    dataTableColumns: DataTableColumn[];
    requiredImports: Map<string, Set<string>>;
    hasInputFields?: boolean;
  }
): string {
  // Check if this form contains any input fields
  const containsInputs = hasInputComponents(comp);
  
  // Update context to track if form has inputs
  if (context.hasInputFields === undefined) {
    context.hasInputFields = containsInputs;
  } else {
    context.hasInputFields = context.hasInputFields || containsInputs;
  }
  
  if (containsInputs) {
    // Use lightning-record-edit-form for forms with input fields
    context.warnings.push(
      'apex:form with inputs converted to lightning-record-edit-form - add record-id and object-api-name attributes'
    );
    context.usedComponents.push('lightning-record-edit-form');

    let html = `${indent}<!-- Form contains input fields - using lightning-record-edit-form -->\n`;
    html += `${indent}<lightning-record-edit-form record-id={recordId} object-api-name={objectApiName}>\n`;

    // Process children
    for (const child of comp.children) {
      html += transformVfComponent(child, indent + '    ', context) + '\n';
    }

    html += `${indent}</lightning-record-edit-form>`;
    return html;
  } else {
    // Use simple div wrapper for forms without input fields (display-only forms)
    context.warnings.push(
      'apex:form without input fields converted to div wrapper - no lightning-record-edit-form needed'
    );

    let html = `${indent}<!-- Form without inputs - using div wrapper -->\n`;
    html += `${indent}<div class="slds-form">\n`;

    // Process children
    for (const child of comp.children) {
      html += transformVfComponent(child, indent + '    ', context) + '\n';
    }

    html += `${indent}</div>`;
    return html;
  }
}

/**
 * Transform apex:pageBlockTable to lightning-datatable
 */
function transformDataTable(
  comp: VfComponent,
  indent: string,
  context: {
    warnings: string[];
    usedComponents: string[];
    formFields: FormField[];
    dataTableColumns: DataTableColumn[];
    requiredImports: Map<string, Set<string>>;
  }
): string {
  context.usedComponents.push('lightning-datatable');

  const { converted: dataExpr } = convertExpression(comp.attributes.value || '');
  const varName = comp.attributes.var || 'item';

  // Extract columns from apex:column children
  const columns: DataTableColumn[] = [];
  for (const child of comp.children) {
    if (child.name.toLowerCase() === 'apex:column') {
      const col: DataTableColumn = {
        label: child.attributes.headerlabel || child.attributes.value || '',
        fieldName: child.attributes.value?.replace(/\{!|\}/g, '').replace(`${varName}.`, '') || '',
      };
      columns.push(col);
      context.dataTableColumns.push(col);
    }
  }

  context.warnings.push(
    'apex:pageBlockTable converted to lightning-datatable - define columns in JavaScript'
  );

  let html = `${indent}<!-- Columns definition needed in JS:\n`;
  html += `${indent}     columns = [\n`;
  for (const col of columns) {
    html += `${indent}         { label: '${col.label}', fieldName: '${col.fieldName}' },\n`;
  }
  html += `${indent}     ];\n`;
  html += `${indent}-->\n`;
  html += `${indent}<lightning-datatable\n`;
  html += `${indent}    data=${dataExpr}\n`;
  html += `${indent}    columns={columns}\n`;
  html += `${indent}    key-field="Id">\n`;
  html += `${indent}</lightning-datatable>`;

  return html;
}

/**
 * Transform apex:repeat to template for:each
 */
function transformRepeat(
  comp: VfComponent,
  indent: string,
  context: {
    warnings: string[];
    usedComponents: string[];
    formFields: FormField[];
    dataTableColumns: DataTableColumn[];
    requiredImports: Map<string, Set<string>>;
  }
): string {
  const { converted: itemsExpr } = convertExpression(comp.attributes.value || '');
  const varName = comp.attributes.var || 'item';

  context.warnings.push('apex:repeat converted - add key attribute to first child element');

  let html = `${indent}<template for:each=${itemsExpr} for:item="${varName}">\n`;

  // Process children
  for (const child of comp.children) {
    html += transformVfComponent(child, indent + '    ', context) + '\n';
  }

  html += `${indent}</template>`;
  return html;
}

/**
 * Transform apex:outputPanel to template with conditional
 */
function transformPanel(
  comp: VfComponent,
  indent: string,
  context: {
    warnings: string[];
    usedComponents: string[];
    formFields: FormField[];
    dataTableColumns: DataTableColumn[];
    requiredImports: Map<string, Set<string>>;
  }
): string {
  // Check if it has rendered attribute
  if (comp.attributes.rendered) {
    const { converted: renderExpr } = convertExpression(comp.attributes.rendered);
    let html = `${indent}<template if:true=${renderExpr}>\n`;

    for (const child of comp.children) {
      html += transformVfComponent(child, indent + '    ', context) + '\n';
    }

    html += `${indent}</template>`;
    return html;
  }

  // Simple div wrapper
  let html = `${indent}<div>\n`;

  for (const child of comp.children) {
    html += transformVfComponent(child, indent + '    ', context) + '\n';
  }

  html += `${indent}</div>`;
  return html;
}

/**
 * Transform parsed VF page markup to LWC HTML
 */
export function transformVfMarkup(parsed: ParsedVfPage): TransformedVfMarkup {
  const context = {
    warnings: [] as string[],
    usedComponents: [] as string[],
    formFields: [] as FormField[],
    dataTableColumns: [] as DataTableColumn[],
    requiredImports: new Map<string, Set<string>>(),
    detectedFormulas: [] as DetectedFormula[],
    controllerProperties: [] as ControllerProperty[],
    hasInputFields: false,
  };

  // Pre-scan for formulas and controller properties in expressions
  for (const expr of parsed.expressions) {
    const result = convertExpression(expr.original);
    if (result.detectedFormula) {
      // Avoid duplicates by checking getter name
      const exists = context.detectedFormulas.some(
        f => f.getterName === result.detectedFormula!.getterName
      );
      if (!exists) {
        context.detectedFormulas.push(result.detectedFormula);
      }
    }
    if (result.controllerProperty) {
      // Merge fields for same property
      const existing = context.controllerProperties.find(
        p => p.name === result.controllerProperty!.name
      );
      if (existing) {
        for (const field of result.controllerProperty.fields) {
          if (!existing.fields.includes(field)) {
            existing.fields.push(field);
          }
        }
      } else {
        context.controllerProperties.push(result.controllerProperty);
      }
    }
  }

  let bodyContent = '';

  for (const comp of parsed.components) {
    // Skip the apex:page wrapper - process its contents
    if (comp.name.toLowerCase() === 'apex:page') {
      for (const child of comp.children) {
        bodyContent += transformVfComponent(child, '    ', context) + '\n';
      }
    } else {
      bodyContent += transformVfComponent(comp, '    ', context) + '\n';
    }
  }

  const html = `<template>\n${bodyContent}</template>`;

  // Build required imports
  const requiredImports: RequiredImport[] = [];
  context.requiredImports.forEach((items, module) => {
    requiredImports.push({ module, items: Array.from(items) });
  });

  // Deduplicate
  context.usedComponents = [...new Set(context.usedComponents)];

  logger.debug(`Transformed VF markup with ${context.warnings.length} warnings`);
  logger.debug(`Used components: ${context.usedComponents.join(', ')}`);

  return {
    html,
    warnings: context.warnings,
    usedComponents: context.usedComponents,
    requiredImports,
    formFields: context.formFields,
    dataTableColumns: context.dataTableColumns,
    detectedFormulas: context.detectedFormulas,
    controllerProperties: context.controllerProperties,
    hasInputFields: context.hasInputFields,
  };
}
