/**
 * Transform Aura markup to LWC HTML template
 */

import { Element, Node, Text } from 'domhandler';
import { ParsedAuraMarkup, AuraAttribute } from '../../parsers/aura/markup-parser';
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
 */
function convertExpression(expr: string, recordDataFields?: Map<string, string[]>): string {
  // Remove {! and }
  let result = expr;

  // {!v.propertyName} -> {propertyName}
  result = result.replace(/\{!v\.(\w+)\}/g, '{$1}');

  // {!v.contact.FieldName} -> {fieldName} getter (for wire data from force:recordData)
  // This handles patterns like {!v.contact.Picture__c}
  result = result.replace(/\{!v\.(\w+)\.(\w+)__c\}/g, (match, targetObj, fieldName) => {
    // Convert Picture__c to picture (getter name)
    const getterName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
    return `{${getterName}}`;
  });
  
  // Also handle standard fields like {!v.contact.Name}
  result = result.replace(/\{!v\.(\w+)\.(\w+)\}/g, (match, targetObj, fieldName) => {
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
    parentTag?: string;
  }
): string {
  if (node.type === 'text') {
    const text = (node as Text).data;
    const converted = convertExpression(text);
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
      targetRecord: targetRecord ? convertExpression(targetRecord).replace(/[{}]/g, '') : undefined,
      targetError: targetError ? convertExpression(targetError).replace(/[{}]/g, '') : undefined,
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
      directive = `if:true=${convertExpression(isTrue)}`;
      context.usedDirectives.push('if:true');
    } else if (isFalse) {
      directive = `if:false=${convertExpression(isFalse)}`;
      context.usedDirectives.push('if:false');
    }

    const childContent = transformChildren(element.children || [], indent + '    ', context);
    return `${indent}<template ${directive}>\n${childContent}${indent}</template>`;
  }

  if (tagName === 'aura:iteration') {
    const items = element.attribs.items;
    const varName = element.attribs.var;
    const indexVar = element.attribs.indexvar || element.attribs.indexVar;

    context.usedDirectives.push('for:each');

    let directives = `for:each=${convertExpression(items)} for:item="${varName}"`;
    if (indexVar) {
      directives += ` for:index="${indexVar}"`;
    }

    // LWC requires key attribute on first child
    context.warnings.push(
      `Iteration converted - ensure first child element has key={${varName}.Id} or similar unique key`
    );

    const childContent = transformChildren(element.children || [], indent + '    ', context);
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
    return `${indent}<${tag}>${convertExpression(body)}</${tag}>`;
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
    const lwcValue = convertExpression(value);

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
  };

  const bodyContent = transformChildren(parsed.body, '    ', context);

  const html = `<template>\n${bodyContent}</template>`;

  // Deduplicate
  context.usedDirectives = [...new Set(context.usedDirectives)];
  context.usedComponents = [...new Set(context.usedComponents)];

  logger.debug(`Transformed markup with ${context.warnings.length} warnings`);
  logger.debug(`Used directives: ${context.usedDirectives.join(', ')}`);
  logger.debug(`Used components: ${context.usedComponents.join(', ')}`);

  return {
    html,
    warnings: context.warnings,
    usedDirectives: context.usedDirectives,
    usedComponents: context.usedComponents,
    lmsChannels: context.lmsChannels,
    recordDataServices: context.recordDataServices,
    facetContent: context.facetContent,
  };
}
