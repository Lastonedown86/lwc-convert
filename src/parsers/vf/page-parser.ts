/**
 * Parser for Visualforce page markup (.page files)
 */

import * as htmlparser2 from 'htmlparser2';
import { DomHandler, Element, Node, Text } from 'domhandler';
import { logger } from '../../utils/logger';

export interface VfPageAttributes {
  controller?: string;
  extensions?: string[];
  standardController?: string;
  recordSetVar?: string;
  action?: string;
  tabStyle?: string;
  sidebar?: boolean;
  showHeader?: boolean;
  lightningStylesheets?: boolean;
  docType?: string;
  renderAs?: string;
}

export interface VfComponent {
  name: string;
  attributes: Record<string, string>;
  children: VfComponent[];
  textContent?: string;
  location: {
    line?: number;
    column?: number;
  };
}

export interface VfExpression {
  original: string;
  type: 'controller' | 'field' | 'global' | 'label' | 'resource' | 'action' | 'other';
  reference: string;
  objectPath?: string[];
}

export interface VfActionFunction {
  name: string;
  action: string;
  rerender?: string;
  oncomplete?: string;
}

export interface VfRemoteAction {
  controller: string;
  method: string;
}

export interface ParsedVfPage {
  pageName: string;
  pageAttributes: VfPageAttributes;
  components: VfComponent[];
  expressions: VfExpression[];
  actionFunctions: VfActionFunction[];
  remoteActions: VfRemoteAction[];
  rerenderedSections: string[];
  includedScripts: string[];
  includedStyles: string[];
  customJavaScript: string[];
  body: Node[];
}

/**
 * Extract all Visualforce expressions from markup
 */
function extractExpressions(content: string): VfExpression[] {
  const expressions: VfExpression[] = [];
  const regex = /\{!([^}]+)\}/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const expr = match[1].trim();
    let type: VfExpression['type'] = 'other';
    let reference = expr;
    let objectPath: string[] | undefined;

    // Global variables
    if (expr.startsWith('$CurrentPage')) {
      type = 'global';
      reference = expr;
    } else if (expr.startsWith('$User')) {
      type = 'global';
      reference = expr;
    } else if (expr.startsWith('$Label')) {
      type = 'label';
      reference = expr.substring(7); // Remove '$Label.'
    } else if (expr.startsWith('$Resource')) {
      type = 'resource';
      reference = expr.substring(10); // Remove '$Resource.'
    } else if (expr.startsWith('$Action')) {
      type = 'action';
      reference = expr;
    } else if (expr.startsWith('$')) {
      type = 'global';
      reference = expr;
    } else if (expr.includes('.')) {
      // Could be object field access or controller method
      const parts = expr.split('.');
      if (
        parts.length === 2 &&
        /^[A-Z]/.test(parts[0]) === false &&
        parts[0] === parts[0].toLowerCase()
      ) {
        // Looks like controller property access
        type = 'controller';
        objectPath = parts;
      } else {
        // Object field access (e.g., record.Name, Account.Name)
        type = 'field';
        objectPath = parts;
      }
      reference = expr;
    } else {
      // Simple controller property
      type = 'controller';
      reference = expr;
    }

    expressions.push({
      original: match[0],
      type,
      reference,
      objectPath,
    });
  }

  return expressions;
}

/**
 * Convert DOM element to VfComponent
 */
function elementToVfComponent(element: Element): VfComponent {
  const component: VfComponent = {
    name: element.name,
    attributes: { ...element.attribs },
    children: [],
    location: {},
  };

  // Process children
  for (const child of element.children || []) {
    if (child.type === 'tag') {
      component.children.push(elementToVfComponent(child as Element));
    } else if (child.type === 'text') {
      const text = (child as Text).data.trim();
      if (text) {
        component.textContent = (component.textContent || '') + text;
      }
    }
  }

  return component;
}

/**
 * Check if a tag is a VF component tag
 */
function isVfComponentTag(tagName: string): boolean {
  return (
    tagName.startsWith('apex:') ||
    tagName.startsWith('c:') ||
    tagName.startsWith('chatter:') ||
    tagName.startsWith('flow:') ||
    tagName.startsWith('ideas:') ||
    tagName.startsWith('knowledge:') ||
    tagName.startsWith('messaging:') ||
    tagName.startsWith('site:') ||
    tagName.startsWith('social:') ||
    tagName.startsWith('support:') ||
    tagName.startsWith('topics:')
  );
}

/**
 * Find all apex:* and other VF components in the DOM
 * Only collects top-level VF components - children are captured via elementToVfComponent
 */
function findVfComponents(nodes: Node[]): VfComponent[] {
  const components: VfComponent[] = [];

  function traverse(node: Node): void {
    if (node.type === 'tag') {
      const element = node as Element;
      const tagName = element.name.toLowerCase();

      // Track apex: components and some other VF-specific tags
      if (isVfComponentTag(tagName)) {
        // Add this component (children are captured via elementToVfComponent)
        components.push(elementToVfComponent(element));
        // DON'T recurse into children - they're already captured as nested VfComponents
        // This prevents duplicate entries in the components array
      } else {
        // Only recurse into non-VF elements to find nested VF components
        for (const child of element.children || []) {
          traverse(child);
        }
      }
    }
  }

  nodes.forEach(traverse);
  return components;
}

/**
 * Extract action functions from parsed components
 */
function extractActionFunctions(components: VfComponent[]): VfActionFunction[] {
  const actionFunctions: VfActionFunction[] = [];

  function traverse(comp: VfComponent): void {
    if (comp.name === 'apex:actionfunction') {
      const af: VfActionFunction = {
        name: comp.attributes.name || '',
        action: comp.attributes.action || '',
      };
      if (comp.attributes.rerender) {
        af.rerender = comp.attributes.rerender;
      }
      if (comp.attributes.oncomplete) {
        af.oncomplete = comp.attributes.oncomplete;
      }
      actionFunctions.push(af);
    }

    comp.children.forEach(traverse);
  }

  components.forEach(traverse);
  return actionFunctions;
}

/**
 * Find rerendered section IDs
 */
function findRerenderedSections(content: string): string[] {
  const sections = new Set<string>();
  const rerenderRegex = /rerender\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = rerenderRegex.exec(content)) !== null) {
    const ids = match[1].split(',').map((s) => s.trim());
    ids.forEach((id) => sections.add(id));
  }

  return Array.from(sections);
}

/**
 * Extract RemoteAction patterns from JavaScript in the page
 */
function findRemoteActions(content: string): VfRemoteAction[] {
  const remoteActions: VfRemoteAction[] = [];

  // Pattern: Visualforce.remoting.Manager.invokeAction('ControllerName.methodName', ...)
  // Or: {!$RemoteAction.Controller.method}
  const remoteActionRegex =
    /(?:Visualforce\.remoting\.Manager\.invokeAction|invokeAction)\s*\(\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = remoteActionRegex.exec(content)) !== null) {
    const fullRef = match[1];
    const parts = fullRef.split('.');
    if (parts.length >= 2) {
      remoteActions.push({
        controller: parts.slice(0, -1).join('.'),
        method: parts[parts.length - 1],
      });
    }
  }

  // Also look for $RemoteAction patterns
  const remoteActionExprRegex = /\{\!\$RemoteAction\.([^.]+)\.(\w+)\}/g;
  while ((match = remoteActionExprRegex.exec(content)) !== null) {
    remoteActions.push({
      controller: match[1],
      method: match[2],
    });
  }

  return remoteActions;
}

/**
 * Extract inline JavaScript from script tags
 */
function extractCustomJavaScript(nodes: Node[]): string[] {
  const scripts: string[] = [];

  function traverse(node: Node): void {
    // htmlparser2 uses type 'script' for <script> tags, not 'tag'
    if (node.type === 'script') {
      const element = node as Element;
      if (!element.attribs?.src) {
        // Inline script - extract text content
        for (const child of element.children || []) {
          if (child.type === 'text') {
            const text = (child as Text).data.trim();
            if (text) {
              scripts.push(text);
            }
          }
        }
      }
    }
    
    if (node.type === 'tag' || node.type === 'script') {
      const element = node as Element;
      for (const child of element.children || []) {
        traverse(child);
      }
    }
  }

  nodes.forEach(traverse);
  return scripts;
}

/**
 * Parse Visualforce page markup
 */
export function parseVfPage(markup: string, pageName: string): ParsedVfPage {
  const result: ParsedVfPage = {
    pageName,
    pageAttributes: {},
    components: [],
    expressions: [],
    actionFunctions: [],
    remoteActions: [],
    rerenderedSections: [],
    includedScripts: [],
    includedStyles: [],
    customJavaScript: [],
    body: [],
  };

  // Parse HTML/XML
  const handler = new DomHandler((error, _dom) => {
    if (error) {
      throw new Error(`Failed to parse VF markup: ${error.message}`);
    }
  });

  const parser = new htmlparser2.Parser(handler, {
    xmlMode: true,
    recognizeSelfClosing: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });

  parser.write(markup);
  parser.end();

  const dom = handler.dom;
  result.body = dom;

  // Find apex:page root
  function findApexPage(nodes: Node[]): Element | null {
    for (const node of nodes) {
      if (node.type === 'tag') {
        const element = node as Element;
        if (element.name === 'apex:page') {
          return element;
        }
        if (element.children) {
          const found = findApexPage(element.children);
          if (found) return found;
        }
      }
    }
    return null;
  }

  const apexPage = findApexPage(dom);

  if (!apexPage) {
    logger.warn('No <apex:page> found in markup - treating as partial');
  } else {
    // Extract page-level attributes
    const attrs = apexPage.attribs || {};

    if (attrs.controller) {
      result.pageAttributes.controller = attrs.controller;
    }
    if (attrs.extensions) {
      result.pageAttributes.extensions = attrs.extensions.split(',').map((s: string) => s.trim());
    }
    if (attrs.standardcontroller) {
      result.pageAttributes.standardController = attrs.standardcontroller;
    }
    if (attrs.recordsetvar) {
      result.pageAttributes.recordSetVar = attrs.recordsetvar;
    }
    if (attrs.action) {
      result.pageAttributes.action = attrs.action;
    }
    if (attrs.tabstyle) {
      result.pageAttributes.tabStyle = attrs.tabstyle;
    }
    if (attrs.sidebar !== undefined) {
      result.pageAttributes.sidebar = attrs.sidebar === 'true';
    }
    if (attrs.showheader !== undefined) {
      result.pageAttributes.showHeader = attrs.showheader === 'true';
    }
    if (attrs.lightningstylesheets !== undefined) {
      result.pageAttributes.lightningStylesheets = attrs.lightningstylesheets === 'true';
    }
    if (attrs.doctype) {
      result.pageAttributes.docType = attrs.doctype;
    }
    if (attrs.renderas) {
      result.pageAttributes.renderAs = attrs.renderas;
    }
  }

  // Find all VF components
  result.components = findVfComponents(dom);

  // Extract expressions
  result.expressions = extractExpressions(markup);

  // Extract action functions
  result.actionFunctions = extractActionFunctions(result.components);

  // Find remote actions
  result.remoteActions = findRemoteActions(markup);

  // Find rerendered sections
  result.rerenderedSections = findRerenderedSections(markup);

  // Find included scripts and styles (recursively search all components)
  function findResourceIncludes(comp: VfComponent): void {
    const lowerName = comp.name.toLowerCase();
    if (lowerName === 'apex:includescript' && comp.attributes.value) {
      result.includedScripts.push(comp.attributes.value);
    }
    if (lowerName === 'apex:stylesheet' && comp.attributes.value) {
      result.includedStyles.push(comp.attributes.value);
    }
    // Recurse into children
    for (const child of comp.children) {
      findResourceIncludes(child);
    }
  }

  for (const comp of result.components) {
    findResourceIncludes(comp);
  }

  // Extract custom JavaScript
  result.customJavaScript = extractCustomJavaScript(dom);

  logger.debug(`Page attributes: controller=${result.pageAttributes.controller || 'none'}`);
  logger.debug(`Found ${result.components.length} VF components`);
  logger.debug(`Found ${result.expressions.length} expressions`);
  logger.debug(`Found ${result.actionFunctions.length} action functions`);
  logger.debug(`Found ${result.remoteActions.length} remote actions`);

  return result;
}
