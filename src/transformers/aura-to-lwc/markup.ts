/**
 * Transform Aura markup to LWC HTML template
 */

import { Element, Node, Text } from 'domhandler';
import { ParsedAuraMarkup } from '../../parsers/aura/markup-parser';
import { logger } from '../../utils/logger';
import * as auraMapping from '../../mappings/aura-to-lwc.json';

export interface TransformedMarkup {
  html: string;
  warnings: string[];
  usedDirectives: string[];
  usedComponents: string[];
  /** LMS channels detected from lightning:messageChannel */
  lmsChannels: LmsChannelConfig[];
  /** force:recordData instances to convert to @wire */
  recordDataServices: RecordDataConfig[];
  /** aura:set facets for slot conversion */
  facetContent: FacetContent[];
  /** Complex expressions converted to getters */
  detectedGetters: DetectedGetter[];
}

export interface DetectedGetter {
  name: string;
  expression: string;
}

/** LMS channel configuration from lightning:messageChannel */
export interface LmsChannelConfig {
  channelName: string;
  auraId: string;
  onMessageHandler?: string;
  scope?: string;
  /** True if this component only publishes (no onMessage handler) */
  isPublisherOnly?: boolean;
}

/** force:recordData configuration */
export interface RecordDataConfig {
  auraId: string;
  recordIdBinding: string;
  fields: string[];
  targetFields?: string;
  targetRecord?: string;
  targetError?: string;
  mode?: string;
}

/** Facet content from aura:set */
export interface FacetContent {
  attributeName: string;
  content: string;
}

interface ComponentMapping {
  lwc: string | null;
  attributes?: Record<string, string>;
  notes?: string;
  requiresKey?: boolean;
}

const componentMappings = (auraMapping as any).components as Record<string, ComponentMapping>;

/**
 * Convert Aura expression to LWC expression
 * {!v.name} -> {name}
 * {!c.handleClick} -> {handleClick}
 * {!v.contact.Picture__c} -> {picture} (converted to use getter)
 * {!v.isActive ? 'Active' : 'Inactive'} -> {displayStatus} (converted to getter)
 */
function convertExpression(
  expr: string,
  context?: { detectedGetters: DetectedGetter[] }
): string {
  // Remove {! and }
  let result = expr;

  // Extract inner expression for complexity check (remove {! and })
  const innerExpr = expr.startsWith('{!') && expr.endsWith('}')
    ? expr.substring(2, expr.length - 1).trim()
    : expr;

  // Check for complex expressions (ternary, logical operators, math)
  // Simple expressions like v.prop, c.method, v.obj.prop should NOT be treated as complex
  // Check for operators that indicate complex logic (but not the leading ! in {!...})
  const isSimplePropertyAccess = /^[vc]\.\w+(\.\w+)*$/.test(innerExpr) || 
    /^\$Label\.\w+\.\w+$/.test(innerExpr) ||
    innerExpr === 'globalId';
  
  const hasComplexOperators =
    innerExpr.includes('?') ||
    innerExpr.includes('&&') ||
    innerExpr.includes('||') ||
    // Check for negation operator (!) but not at start of simple property (e.g., !v.isTrue)
    /[^{]!/.test(innerExpr) ||
    // Check for math but exclude property paths like v.obj-name
    /\s[+\-*/]\s/.test(innerExpr) ||
    innerExpr.includes('==') ||
    innerExpr.includes('!=') ||
    innerExpr.includes('>=') ||
    innerExpr.includes('<=') ||
    /[^=!<>]>[^=]/.test(innerExpr) ||
    /[^=]<[^=]/.test(innerExpr);

  const isComplex = !isSimplePropertyAccess && hasComplexOperators;

  // If complex and we have context to store it, convert to getter
  if (isComplex && context && expr.startsWith('{!') && expr.endsWith('}')) {
    // Generate a getter name based on the expression content
    // e.g. v.isActive ? 'Active' : 'Inactive' -> getComputedValue1
    const getterName = `computedValue${context.detectedGetters.length + 1}`;

    context.detectedGetters.push({
      name: getterName,
      expression: innerExpr
    });

    return `{${getterName}}`;
  }

  // {!v.propertyName} -> {propertyName}
  result = result.replace(/\{!v\.(\w+)\}/g, '{$1}');

  // {!v.contact.FieldName} -> {fieldName} getter (for wire data from force:recordData)
  // This handles patterns like {!v.contact.Picture__c}
  result = result.replace(/\{!v\.(\w+)\.(\w+)__c\}/g, (_match, _targetObj, fieldName) => {
    // Convert Picture__c to picture (getter name)
    const getterName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
    return `{${getterName}}`;
  });

  // Also handle standard fields like {!v.contact.Name}
  result = result.replace(/\{!v\.(\w+)\.(\w+)\}/g, (_match, _targetObj, fieldName) => {
    // Convert Name to name (getter name) - standard fields
    const getterName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
    return `{${getterName}}`;
  });

  // {!c.methodName} -> {methodName}
  result = result.replace(/\{!c\.(\w+)\}/g, '{$1}');

  // {!globalId} -> special handling needed
  result = result.replace(/\{!globalId\}/g, '{/* TODO: Replace globalId with data-id or ref */}');

  // {!$Label.namespace.labelName} -> {label.labelName}
  result = result.replace(/\{!\$Label\.(\w+)\.(\w+)\}/g, '{label$1$2}');

  // Other expressions - try to preserve
  result = result.replace(/\{!([^}]+)\}/g, '{$1}');

  return result;
}

/**
 * Convert Aura attribute name to LWC attribute name
 * e.g., iconName -> icon-name
 */
function convertAttributeName(auraAttr: string, componentMapping?: ComponentMapping): string {
  // Check if there's a specific mapping for this component's attribute
  if (componentMapping?.attributes && componentMapping.attributes[auraAttr]) {
    return componentMapping.attributes[auraAttr];
  }

  // Convert camelCase to kebab-case for standard attributes
  return auraAttr.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert Aura component tag to LWC tag
 */
function convertTagName(auraTag: string): { lwcTag: string; mapping?: ComponentMapping } {
  const mapping = componentMappings[auraTag];

  if (mapping && mapping.lwc) {
    return { lwcTag: mapping.lwc, mapping };
  }

  // Handle lightning: namespace - direct conversion
  if (auraTag.startsWith('lightning:')) {
    const baseName = auraTag.substring(10);
    const kebabName = baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return { lwcTag: `lightning-${kebabName}` };
  }

  // Handle ui: namespace - most map to lightning-input or similar
  if (auraTag.startsWith('ui:')) {
    const baseName = auraTag.substring(3);
    if (baseName.startsWith('input')) {
      return { lwcTag: 'lightning-input' };
    }
    if (baseName.startsWith('output')) {
      return { lwcTag: 'lightning-formatted-text' };
    }
    if (baseName === 'button') {
      return { lwcTag: 'lightning-button' };
    }
  }

  // Handle c: namespace - custom components
  if (auraTag.startsWith('c:')) {
    const baseName = auraTag.substring(2);
    const kebabName = baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return { lwcTag: `c-${kebabName}` };
  }

  // Default: return as-is with a comment
  return { lwcTag: auraTag };
}

/**
 * Transform a single DOM node to LWC HTML
 */
function transformNode(
  node: Node,
  indent: string,
  context: {
    warnings: string[];
    usedDirectives: string[];
    usedComponents: string[];
    lmsChannels: LmsChannelConfig[];
    recordDataServices: RecordDataConfig[];
    facetContent: FacetContent[];
    detectedGetters: DetectedGetter[];
    parentTag?: string;
  }
): string {
  if (node.type === 'text') {
    const text = (node as Text).data;
    const converted = convertExpression(text, context);
    if (converted.trim()) {
      return converted;
    }
    return '';
  }

  if (node.type !== 'tag') {
    return '';
  }

  const element = node as Element;
  const tagName = element.name;

  // Handle lightning:messageChannel - extract config, don't output markup
  if (tagName === 'lightning:messagechannel' || tagName === 'lightning:messageChannel') {
    const channelType = element.attribs.type || '';
    const auraId = element.attribs['aura:id'] || '';
    const onMessage = element.attribs.onmessage || element.attribs.onMessage || '';
    const scope = element.attribs.scope || '';

    // Extract handler name from {!c.handleMessage}
    let handlerName = '';
    const handlerMatch = onMessage.match(/\{!c\.(\w+)\}/);
    if (handlerMatch) {
      handlerName = handlerMatch[1];
    }

    context.lmsChannels.push({
      channelName: channelType,
      auraId: auraId,
      onMessageHandler: handlerName,
      scope: scope,
      isPublisherOnly: !handlerName, // No onMessage handler means publisher-only
    });

    const lmsPattern = handlerName ? 'subscriber' : 'publisher-only';
    context.warnings.push(`lightning:messageChannel detected (${lmsPattern}) - LMS code will be generated in JavaScript`);

    // Don't output any markup - LMS is handled in JS
    return '';
  }

  // Handle force:recordData - extract config, don't output markup
  if (tagName === 'force:recorddata' || tagName === 'force:recordData') {
    const auraId = element.attribs['aura:id'] || '';
    const recordId = element.attribs.recordid || element.attribs.recordId || '';
    const fieldsAttr = element.attribs.fields || '';
    const targetFields = element.attribs.targetfields || element.attribs.targetFields || '';
    const targetRecord = element.attribs.targetrecord || element.attribs.targetRecord || '';
    const targetError = element.attribs.targeterror || element.attribs.targetError || '';
    const mode = element.attribs.mode || 'VIEW';

    // Parse fields from string like "['Name', 'Title', 'Phone']"
    let fields: string[] = [];
    const fieldsMatch = fieldsAttr.match(/\[([^\]]+)\]/);
    if (fieldsMatch) {
      fields = fieldsMatch[1]
        .split(',')
        .map(f => f.trim().replace(/['"]/g, ''))
        .filter(f => f);
    }

    // Convert recordId binding from {!v.contactId} to contactId
    let recordIdBinding = recordId;
    const bindingMatch = recordId.match(/\{!v\.(\w+)\}/);
    if (bindingMatch) {
      recordIdBinding = bindingMatch[1];
    }

    // Convert targetFields from {!v.contact} to contact
    let targetFieldsBinding = targetFields;
    const targetMatch = targetFields.match(/\{!v\.(\w+)\}/);
    if (targetMatch) {
      targetFieldsBinding = targetMatch[1];
    }

    context.recordDataServices.push({
      auraId: auraId,
      recordIdBinding: recordIdBinding,
      fields: fields,
      targetFields: targetFieldsBinding,
      targetRecord: targetRecord ? convertExpression(targetRecord, context).replace(/[{}]/g, '') : undefined,
      targetError: targetError ? convertExpression(targetError, context).replace(/[{}]/g, '') : undefined,
      mode: mode,
    });

    context.warnings.push(`force:recordData detected - @wire(getRecord) will be generated in JavaScript`);

    // Don't output any markup - wire adapter is in JS
    return '';
  }

  // Handle special Aura tags
  if (tagName === 'aura:if') {
    const isTrue = element.attribs.istrue || element.attribs.isTrue;
    const isFalse = element.attribs.isfalse || element.attribs.isFalse;

    let directive = '';
    if (isTrue) {
      directive = `lwc:if={${convertExpression(isTrue, context).replace(/^{|}$/g, '')}}`;
      context.usedDirectives.push('lwc:if');
    } else if (isFalse) {
      // isFalse is tricky because lwc:else doesn't take an expression
      // We'll treat it as lwc:if with negated expression
      const expr = convertExpression(isFalse, context).replace(/^{|}$/g, '');
      directive = `lwc:if={!${expr}}`;
      context.usedDirectives.push('lwc:if');
    }

    // Separate children into main if-block content and else block content
    const children = element.children || [];
    const mainBlockChildren: Node[] = [];
    let elseBlockContent = '';

    for (const child of children) {
      if (child.type === 'tag') {
        const childElement = child as Element;
        if (childElement.name === 'aura:set') {
          const attrName = childElement.attribs.attribute || '';
          if (attrName === 'else') {
            // This is the else block content - transform it separately
            const elseChildren = childElement.children || [];
            elseBlockContent = transformChildren(elseChildren, indent + '    ', context);
            context.usedDirectives.push('lwc:else');
            continue;
          }
        }
      }
      mainBlockChildren.push(child);
    }

    const mainContent = transformChildren(mainBlockChildren, indent + '    ', context);

    let result = `${indent}<template ${directive}>\n${mainContent}${indent}</template>`;

    // Add else block if present
    if (elseBlockContent) {
      result += `\n${indent}<template lwc:else>\n${elseBlockContent}${indent}</template>`;
    }

    return result;
  }

  if (tagName === 'aura:iteration') {
    const items = element.attribs.items;
    const varName = element.attribs.var;
    const indexVar = element.attribs.indexvar || element.attribs.indexVar;

    context.usedDirectives.push('for:each');

    let directives = `for:each=${convertExpression(items, context)} for:item="${varName}"`;
    if (indexVar) {
      directives += ` for:index="${indexVar}"`;
    }

    // Transform children with iteration context to inject key on first element
    const iterContext = { ...context, iterationVar: varName, needsKey: true };
    const childContent = transformChildrenWithIteration(element.children || [], indent + '    ', iterContext);
    
    return `${indent}<template ${directives}>\n${childContent}${indent}</template>`;
  }

  // Handle aura:set - convert to slot content
  if (tagName === 'aura:set') {
    const attrName = element.attribs.attribute || '';
    const childContent = transformChildren(element.children || [], indent + '    ', context);

    // Store facet content for later use
    context.facetContent.push({
      attributeName: attrName,
      content: childContent.trim(),
    });

    // lightning-card has named slots for 'actions' and 'footer'
    if (attrName === 'actions' && context.parentTag?.includes('card')) {
      return `${indent}<div slot="actions">\n${childContent}${indent}</div>`;
    }
    if (attrName === 'footer' && context.parentTag?.includes('card')) {
      return `${indent}<div slot="footer">\n${childContent}${indent}</div>`;
    }

    // For other facets, wrap in a named slot
    if (attrName) {
      context.warnings.push(`aura:set attribute="${attrName}" - verify slot name exists on parent component`);
      return `${indent}<div slot="${attrName}">\n${childContent}${indent}</div>`;
    }

    context.warnings.push('aura:set found without attribute name - needs manual migration');
    return `${indent}<!-- TODO: Convert aura:set to slot content -->\n${childContent}`;
  }

  if (tagName === 'aura:html') {
    const tag = element.attribs.tag || 'div';
    const body = element.attribs.body || '';
    context.warnings.push('aura:html found - verify dynamic HTML handling');
    return `${indent}<${tag}>${convertExpression(body, context)}</${tag}>`;
  }

  // Skip aura meta tags that don't produce output
  if (
    tagName === 'aura:attribute' ||
    tagName === 'aura:handler' ||
    tagName === 'aura:registerEvent' ||
    tagName === 'aura:method'
  ) {
    return '';
  }

  // Convert regular components
  const { lwcTag, mapping } = convertTagName(tagName);

  if (lwcTag !== tagName) {
    context.usedComponents.push(lwcTag);
  }

  // Build attributes
  const attrs: string[] = [];
  for (const [key, value] of Object.entries(element.attribs)) {
    // Skip aura:id - convert to data-id
    if (key === 'aura:id') {
      attrs.push(`data-id="${value}"`);
      continue;
    }

    const lwcAttrName = convertAttributeName(key, mapping);
    const lwcValue = convertExpression(value, context);

    // Handle event handlers
    if (key.startsWith('on') || lwcAttrName.startsWith('on')) {
      attrs.push(`${lwcAttrName}=${lwcValue}`);
    } else if (lwcValue.startsWith('{') && lwcValue.endsWith('}')) {
      // Dynamic value
      attrs.push(`${lwcAttrName}=${lwcValue}`);
    } else {
      // Static value
      attrs.push(`${lwcAttrName}="${lwcValue}"`);
    }
  }

  const attrString = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Check if self-closing
  const children = element.children || [];
  const hasChildren = children.some((child) => {
    if (child.type === 'text') {
      return (child as Text).data.trim().length > 0;
    }
    return child.type === 'tag';
  });

  if (!hasChildren) {
    return `${indent}<${lwcTag}${attrString}></${lwcTag}>`;
  }

  // Pass parent tag to context for slot handling
  const childContext = { ...context, parentTag: lwcTag };
  const childContent = transformChildren(children, indent + '    ', childContext);
  return `${indent}<${lwcTag}${attrString}>\n${childContent}${indent}</${lwcTag}>`;
}

/**
 * Transform array of child nodes
 */
/**
 * Transform children within an iteration context to inject key attribute on first element
 */
function transformChildrenWithIteration(
  children: Node[],
  indent: string,
  context: {
    warnings: string[];
    usedDirectives: string[];
    usedComponents: string[];
    lmsChannels: LmsChannelConfig[];
    recordDataServices: RecordDataConfig[];
    facetContent: FacetContent[];
    detectedGetters: DetectedGetter[];
    parentTag?: string;
    iterationVar?: string;
    needsKey?: boolean;
  }
): string {
  const parts: string[] = [];
  let keyInjected = false;

  for (const child of children) {
    if (!keyInjected && context.needsKey && child.type === 'tag') {
      const element = child as Element;
      // Skip text and non-element nodes, find first actual element to inject key
      // Inject key attribute on first element child
      const varName = context.iterationVar || 'item';
      
      // Check if element already has a key attribute
      const hasKey = element.attribs && ('key' in element.attribs);
      
      if (!hasKey) {
        // Add key to the element's attributes
        if (!element.attribs) {
          element.attribs = {};
        }
        element.attribs['key'] = `{${varName}.Id}`;
        context.warnings.push(
          `Added key={${varName}.Id} to iteration - verify .Id is the correct unique identifier`
        );
      }
      keyInjected = true;
    }
    
    const result = transformNode(child, indent, context);
    if (result) {
      parts.push(result);
    }
  }

  return parts.join('\n') + (parts.length > 0 ? '\n' : '');
}

/**
 * Transform array of child nodes
 */
function transformChildren(
  children: Node[],
  indent: string,
  context: {
    warnings: string[];
    usedDirectives: string[];
    usedComponents: string[];
    lmsChannels: LmsChannelConfig[];
    recordDataServices: RecordDataConfig[];
    facetContent: FacetContent[];
    detectedGetters: DetectedGetter[];
    parentTag?: string;
  }
): string {
  const parts: string[] = [];

  for (const child of children) {
    const result = transformNode(child, indent, context);
    if (result) {
      parts.push(result);
    }
  }

  return parts.join('\n') + (parts.length > 0 ? '\n' : '');
}

/**
 * Transform parsed Aura markup to LWC HTML
 */
export function transformAuraMarkup(parsed: ParsedAuraMarkup): TransformedMarkup {
  const context = {
    warnings: [] as string[],
    usedDirectives: [] as string[],
    usedComponents: [] as string[],
    lmsChannels: [] as LmsChannelConfig[],
    recordDataServices: [] as RecordDataConfig[],
    facetContent: [] as FacetContent[],
    detectedGetters: [] as DetectedGetter[],
  };

  const bodyContent = transformChildren(parsed.body, '    ', context);

  const html = `<template>\n${bodyContent}</template>`;

  // Deduplicate
  context.usedDirectives = [...new Set(context.usedDirectives)];
  context.usedComponents = [...new Set(context.usedComponents)];

  logger.debug(`Transformed markup with ${context.warnings.length} warnings`);
  logger.debug(`Used directives: ${context.usedDirectives.join(', ')}`);
  logger.debug(`Used components: ${context.usedComponents.join(', ')}`);
  logger.debug(`Detected ${context.detectedGetters.length} complex expressions for getters`);

  return {
    html,
    warnings: context.warnings,
    usedDirectives: context.usedDirectives,
    usedComponents: context.usedComponents,
    lmsChannels: context.lmsChannels,
    recordDataServices: context.recordDataServices,
    facetContent: context.facetContent,
    detectedGetters: context.detectedGetters,
  };
}
