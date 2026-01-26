/**
 * Parser for Aura component markup (.cmp files)
 */

import * as htmlparser2 from 'htmlparser2';
import { DomHandler, Element, Node, Text } from 'domhandler';
import { logger } from '../../utils/logger';

export interface AuraAttribute {
  name: string;
  type: string;
  default?: string;
  description?: string;
  required?: boolean;
  access?: string;
}

export interface AuraHandler {
  name: string;
  event: string;
  action: string;
  phase?: string;
}

export interface AuraEvent {
  name: string;
  type: string;
}

export interface AuraMethod {
  name: string;
  action: string;
  attributes: Array<{ name: string; type: string }>;
}

export interface AuraExpression {
  original: string;
  type: 'attribute' | 'controller' | 'helper' | 'label' | 'globalId' | 'other';
  reference: string;
}

export interface ParsedAuraMarkup {
  componentName: string;
  implements?: string[];
  extensible?: boolean;
  abstract?: boolean;
  controller?: string;
  attributes: AuraAttribute[];
  handlers: AuraHandler[];
  registeredEvents: AuraEvent[];
  methods: AuraMethod[];
  body: Node[];
  expressions: AuraExpression[];
  dependencies: string[];
  facets: Map<string, Node[]>;
}

/**
 * Extract expressions from Aura markup (e.g., {!v.name}, {!c.handleClick})
 */
function extractExpressions(content: string): AuraExpression[] {
  const expressions: AuraExpression[] = [];
  const regex = /\{!([^}]+)\}/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const expr = match[1].trim();
    let type: AuraExpression['type'] = 'other';
    let reference = expr;

    if (expr.startsWith('v.')) {
      type = 'attribute';
      reference = expr.substring(2);
    } else if (expr.startsWith('c.')) {
      type = 'controller';
      reference = expr.substring(2);
    } else if (expr.startsWith('helper.')) {
      type = 'helper';
      reference = expr.substring(7);
    } else if (expr.startsWith('$Label.')) {
      type = 'label';
      reference = expr.substring(7);
    } else if (expr === 'globalId') {
      type = 'globalId';
    }

    expressions.push({
      original: match[0],
      type,
      reference,
    });
  }

  return expressions;
}

/**
 * Find all component dependencies in markup
 */
function findDependencies(nodes: Node[]): string[] {
  const deps = new Set<string>();

  function traverse(node: Node): void {
    if (node.type === 'tag') {
      const element = node as Element;
      const tagName = element.name;

      // Track lightning:*, ui:*, force:*, and custom c:* components
      if (
        tagName.startsWith('lightning:') ||
        tagName.startsWith('ui:') ||
        tagName.startsWith('force:') ||
        tagName.startsWith('c:')
      ) {
        deps.add(tagName);
      }

      // Recurse into children
      if (element.children) {
        element.children.forEach(traverse);
      }
    }
  }

  nodes.forEach(traverse);
  return Array.from(deps);
}

/**
 * Parse Aura component markup
 */
export function parseAuraMarkup(markup: string, componentName: string): ParsedAuraMarkup {
  const result: ParsedAuraMarkup = {
    componentName,
    attributes: [],
    handlers: [],
    registeredEvents: [],
    methods: [],
    body: [],
    expressions: [],
    dependencies: [],
    facets: new Map(),
  };

  // Parse HTML/XML
  const handler = new DomHandler((error, _dom) => {
    if (error) {
      throw new Error(`Failed to parse Aura markup: ${error.message}`);
    }
  });

  const parser = new htmlparser2.Parser(handler, {
    xmlMode: true,
    recognizeSelfClosing: true,
  });

  parser.write(markup);
  parser.end();

  const dom = handler.dom;

  // Find aura:component root
  function findAuraComponent(nodes: Node[]): Element | null {
    for (const node of nodes) {
      if (node.type === 'tag') {
        const element = node as Element;
        if (element.name === 'aura:component') {
          return element;
        }
        if (element.children) {
          const found = findAuraComponent(element.children);
          if (found) return found;
        }
      }
    }
    return null;
  }

  const auraComponent = findAuraComponent(dom);

  if (!auraComponent) {
    throw new Error('No <aura:component> found in markup');
  }

  // Extract component-level attributes
  const attrs = auraComponent.attribs || {};

  if (attrs.implements) {
    result.implements = attrs.implements.split(',').map((s: string) => s.trim());
  }

  if (attrs.extensible === 'true') {
    result.extensible = true;
  }

  if (attrs.abstract === 'true') {
    result.abstract = true;
  }

  if (attrs.controller) {
    result.controller = attrs.controller;
  }

  // Process children of aura:component
  const bodyNodes: Node[] = [];

  for (const child of auraComponent.children || []) {
    if (child.type === 'tag') {
      const element = child as Element;

      switch (element.name) {
        case 'aura:attribute': {
          const attrDef: AuraAttribute = {
            name: element.attribs.name || '',
            type: element.attribs.type || 'String',
          };
          if (element.attribs.default !== undefined) {
            attrDef.default = element.attribs.default;
          }
          if (element.attribs.description) {
            attrDef.description = element.attribs.description;
          }
          if (element.attribs.required === 'true') {
            attrDef.required = true;
          }
          if (element.attribs.access) {
            attrDef.access = element.attribs.access;
          }
          result.attributes.push(attrDef);
          logger.debug(`Found attribute: ${attrDef.name} (${attrDef.type})`);
          break;
        }

        case 'aura:handler': {
          const handlerDef: AuraHandler = {
            name: element.attribs.name || '',
            event: element.attribs.event || '',
            action: element.attribs.action || '',
          };
          if (element.attribs.phase) {
            handlerDef.phase = element.attribs.phase;
          }
          result.handlers.push(handlerDef);
          logger.debug(`Found handler: ${handlerDef.name} -> ${handlerDef.action}`);
          break;
        }

        case 'aura:registerEvent': {
          const eventDef: AuraEvent = {
            name: element.attribs.name || '',
            type: element.attribs.type || '',
          };
          result.registeredEvents.push(eventDef);
          logger.debug(`Found registered event: ${eventDef.name}`);
          break;
        }

        case 'aura:method': {
          const methodDef: AuraMethod = {
            name: element.attribs.name || '',
            action: element.attribs.action || '',
            attributes: [],
          };
          // Parse method attributes
          for (const methodChild of element.children || []) {
            if (
              methodChild.type === 'tag' &&
              (methodChild as Element).name === 'aura:attribute'
            ) {
              const methodAttr = methodChild as Element;
              methodDef.attributes.push({
                name: methodAttr.attribs.name || '',
                type: methodAttr.attribs.type || 'Object',
              });
            }
          }
          result.methods.push(methodDef);
          logger.debug(`Found method: ${methodDef.name}`);
          break;
        }

        case 'aura:set': {
          // Handle facet/slot content
          const facetAttr = element.attribs.attribute;
          if (facetAttr) {
            result.facets.set(facetAttr, element.children || []);
          }
          break;
        }

        default:
          // Add to body
          bodyNodes.push(child);
      }
    } else if (child.type === 'text') {
      const text = child as Text;
      if (text.data.trim()) {
        bodyNodes.push(child);
      }
    }
  }

  result.body = bodyNodes;

  // Extract all expressions from markup
  result.expressions = extractExpressions(markup);

  // Find component dependencies
  result.dependencies = findDependencies(bodyNodes);

  logger.debug(`Parsed ${result.attributes.length} attributes`);
  logger.debug(`Parsed ${result.handlers.length} handlers`);
  logger.debug(`Parsed ${result.registeredEvents.length} events`);
  logger.debug(`Found ${result.expressions.length} expressions`);
  logger.debug(`Found ${result.dependencies.length} dependencies`);

  return result;
}

/**
 * Serialize DOM nodes back to string (for debugging)
 */
export function serializeNodes(nodes: Node[]): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { render } = require('dom-serializer');
  return render(nodes, { xmlMode: true });
}
