/**
 * Aura component dependency analyzer
 * Extracts dependencies from Aura components including:
 * - Component references (c:*, lightning:*, ui:*, force:*)
 * - Event registrations and handlers
 * - Apex controller bindings
 * - Interface implementations and extensions
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as htmlparser2 from 'htmlparser2';
import { DomHandler, Element, Node } from 'domhandler';
import { logger } from '../utils/logger';
import {
  ComponentAnalysisResult,
  RawDependency,
  DependencyType,
} from './types';

interface AuraDependencyContext {
  markup: string;
  controllerJs?: string;
  helperJs?: string;
}

/**
 * Parse Aura markup and extract all dependencies
 */
function extractMarkupDependencies(
  markup: string,
  includeBaseComponents: boolean
): RawDependency[] {
  const dependencies: RawDependency[] = [];

  const handler = new DomHandler((error) => {
    if (error) {
      logger.debug(`Markup parsing error: ${error.message}`);
    }
  });

  const parser = new htmlparser2.Parser(handler, {
    xmlMode: true,
    recognizeSelfClosing: true,
  });

  parser.write(markup);
  parser.end();

  const dom = handler.dom;

  // Track seen dependencies to avoid duplicates
  const seen = new Set<string>();

  function addDependency(dep: RawDependency) {
    const key = `${dep.type}:${dep.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      dependencies.push(dep);
    }
  }

  // Find aura:component root to extract controller, implements, extends
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

  if (auraComponent) {
    const attrs = auraComponent.attribs || {};

    // Extract Apex controller
    if (attrs.controller) {
      addDependency({
        target: `apex:${attrs.controller}`,
        type: 'controller',
        expression: `controller="${attrs.controller}"`,
      });
    }

    // Extract implements (interfaces)
    if (attrs.implements) {
      const interfaces = attrs.implements.split(',').map((s: string) => s.trim());
      for (const iface of interfaces) {
        addDependency({
          target: iface,
          type: 'interface',
          expression: `implements="${iface}"`,
        });
      }
    }

    // Extract extends
    if (attrs.extends) {
      addDependency({
        target: attrs.extends,
        type: 'extends',
        expression: `extends="${attrs.extends}"`,
      });
    }
  }

  // Traverse all nodes to find component references and events
  function traverse(node: Node, lineEstimate: number): void {
    if (node.type === 'tag') {
      const element = node as Element;
      const tagName = element.name;

      // Custom component references (c:*)
      if (tagName.startsWith('c:')) {
        addDependency({
          target: tagName,
          type: 'component',
          lineNumber: lineEstimate,
          expression: `<${tagName}>`,
        });
      }

      // Base Lightning components
      if (
        tagName.startsWith('lightning:') ||
        tagName.startsWith('ui:') ||
        tagName.startsWith('force:')
      ) {
        if (includeBaseComponents) {
          addDependency({
            target: tagName,
            type: 'baseComponent',
            lineNumber: lineEstimate,
            expression: `<${tagName}>`,
          });
        }
      }

      // Event registrations
      if (tagName === 'aura:registerEvent') {
        const eventType = element.attribs?.type;
        if (eventType) {
          addDependency({
            target: eventType,
            type: 'event',
            lineNumber: lineEstimate,
            expression: `<aura:registerEvent type="${eventType}">`,
          });
        }
      }

      // Event handlers (for application events)
      if (tagName === 'aura:handler') {
        const eventAttr = element.attribs?.event;
        if (eventAttr) {
          addDependency({
            target: eventAttr,
            type: 'event',
            lineNumber: lineEstimate,
            expression: `<aura:handler event="${eventAttr}">`,
          });
        }
      }

      // Recurse into children
      if (element.children) {
        element.children.forEach((child, i) => traverse(child, lineEstimate + i));
      }
    }
  }

  dom.forEach((node, i) => traverse(node, i + 1));

  return dependencies;
}

/**
 * Extract dependencies from JavaScript files (controller, helper)
 * Looking for patterns like:
 * - $A.get("e.c:MyEvent") - application events
 * - $A.createComponent("c:MyComponent", ...) - dynamic components
 * - component.find("...") patterns that might reference other components
 */
function extractJsDependencies(jsContent: string): RawDependency[] {
  const dependencies: RawDependency[] = [];
  const seen = new Set<string>();

  function addDep(dep: RawDependency) {
    const key = `${dep.type}:${dep.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      dependencies.push(dep);
    }
  }

  const lines = jsContent.split('\n');

  lines.forEach((line, lineNum) => {
    // $A.get("e.c:EventName") - application event reference
    const eventGetMatch = line.match(/\$A\.get\s*\(\s*["']e\.(c:[^"']+)["']\s*\)/g);
    if (eventGetMatch) {
      for (const match of eventGetMatch) {
        const eventName = match.match(/e\.(c:[^"']+)/)?.[1];
        if (eventName) {
          addDep({
            target: eventName,
            type: 'event',
            lineNumber: lineNum + 1,
            expression: match,
          });
        }
      }
    }

    // $A.createComponent("c:ComponentName", ...) - dynamic component creation
    const createCompMatch = line.match(/\$A\.createComponent\s*\(\s*["'](c:[^"']+)["']/g);
    if (createCompMatch) {
      for (const match of createCompMatch) {
        const compName = match.match(/["'](c:[^"']+)["']/)?.[1];
        if (compName) {
          addDep({
            target: compName,
            type: 'component',
            lineNumber: lineNum + 1,
            expression: match,
          });
        }
      }
    }

    // Look for Lightning Message Service imports (in case used in Aura)
    // import { subscribe, publish, MessageContext } from 'lightning/messageService';
    if (line.includes('lightning/messageService') || line.includes('MessageContext')) {
      addDep({
        target: 'lightning:messageService',
        type: 'lms',
        lineNumber: lineNum + 1,
        expression: line.trim(),
      });
    }
  });

  return dependencies;
}

/**
 * Analyze a single Aura component bundle
 */
export async function analyzeAuraComponent(
  bundlePath: string,
  includeBaseComponents: boolean = false
): Promise<ComponentAnalysisResult | null> {
  try {
    const stat = await fs.stat(bundlePath);
    if (!stat.isDirectory()) {
      logger.debug(`Not a directory: ${bundlePath}`);
      return null;
    }

    const componentName = path.basename(bundlePath);
    const files = await fs.readdir(bundlePath);

    // Find the .cmp file
    const cmpFile = files.find((f) => f.endsWith('.cmp'));
    if (!cmpFile) {
      logger.debug(`No .cmp file found in ${bundlePath}`);
      return null;
    }

    const context: AuraDependencyContext = {
      markup: '',
    };

    // Read component files
    context.markup = await fs.readFile(path.join(bundlePath, cmpFile), 'utf-8');

    // Read controller if exists
    const controllerFile = files.find((f) => f.endsWith('Controller.js'));
    if (controllerFile) {
      context.controllerJs = await fs.readFile(
        path.join(bundlePath, controllerFile),
        'utf-8'
      );
    }

    // Read helper if exists
    const helperFile = files.find((f) => f.endsWith('Helper.js'));
    if (helperFile) {
      context.helperJs = await fs.readFile(
        path.join(bundlePath, helperFile),
        'utf-8'
      );
    }

    // Extract dependencies
    const allDependencies: RawDependency[] = [];

    // From markup
    allDependencies.push(...extractMarkupDependencies(context.markup, includeBaseComponents));

    // From controller JS
    if (context.controllerJs) {
      allDependencies.push(...extractJsDependencies(context.controllerJs));
    }

    // From helper JS
    if (context.helperJs) {
      allDependencies.push(...extractJsDependencies(context.helperJs));
    }

    return {
      id: `c:${componentName}`,
      name: componentName,
      type: 'aura',
      filePath: bundlePath,
      dependencies: allDependencies,
    };
  } catch (error: any) {
    logger.debug(`Error analyzing ${bundlePath}: ${error.message}`);
    return null;
  }
}

/**
 * Read sfdx-project.json and return package directories
 */
async function getPackageDirectories(rootPath: string): Promise<string[]> {
  const sfdxProjectPath = path.join(rootPath, 'sfdx-project.json');

  if (await fs.pathExists(sfdxProjectPath)) {
    try {
      const projectConfig = await fs.readJson(sfdxProjectPath);
      if (projectConfig.packageDirectories && Array.isArray(projectConfig.packageDirectories)) {
        return projectConfig.packageDirectories.map((pkg: { path: string }) =>
          path.join(rootPath, pkg.path)
        );
      }
    } catch (error) {
      logger.debug(`Error reading sfdx-project.json: ${error}`);
    }
  }

  return [];
}

/**
 * Recursively find all 'aura' directories within a path
 */
async function findAuraDirectories(basePath: string): Promise<string[]> {
  const auraDirectories: string[] = [];

  async function searchDir(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 5) return; // Limit recursion depth

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.name === 'aura') {
            auraDirectories.push(fullPath);
          } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await searchDir(fullPath, depth + 1);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  await searchDir(basePath);
  return auraDirectories;
}

/**
 * Scan a directory for Aura components and analyze all of them
 */
export async function scanAuraComponents(
  rootPath: string,
  includeBaseComponents: boolean = false
): Promise<ComponentAnalysisResult[]> {
  const results: ComponentAnalysisResult[] = [];
  const searchPaths: string[] = [];

  // First, try to read sfdx-project.json for package directories
  const packageDirs = await getPackageDirectories(rootPath);

  if (packageDirs.length > 0) {
    // Search within each package directory for 'aura' folders
    for (const pkgDir of packageDirs) {
      const foundAuraDirs = await findAuraDirectories(pkgDir);
      searchPaths.push(...foundAuraDirs);
    }
    logger.debug(`Found aura directories from sfdx-project.json: ${searchPaths.join(', ')}`);
  }

  // Also add fallback common locations
  const fallbackPaths = [
    path.join(rootPath, 'force-app/main/default/aura'),
    path.join(rootPath, 'src/aura'),
    path.join(rootPath, 'aura'),
  ];

  for (const fallback of fallbackPaths) {
    if (!searchPaths.includes(fallback)) {
      searchPaths.push(fallback);
    }
  }

  // Also check if rootPath itself is an aura directory or component bundle
  if (await fs.pathExists(rootPath)) {
    const stat = await fs.stat(rootPath);
    if (stat.isDirectory()) {
      const files = await fs.readdir(rootPath);
      if (files.some(f => f.endsWith('.cmp'))) {
        // rootPath is a component bundle
        searchPaths.unshift(rootPath);
      }
    }
  }

  logger.debug(`Searching for Aura components in: ${searchPaths.join(', ')}`);

  for (const searchPath of searchPaths) {
    if (await fs.pathExists(searchPath)) {
      const stat = await fs.stat(searchPath);

      if (stat.isDirectory()) {
        // Check if this is a component bundle (has .cmp file)
        const files = await fs.readdir(searchPath);
        if (files.some((f) => f.endsWith('.cmp'))) {
          // This is a single component
          const result = await analyzeAuraComponent(searchPath, includeBaseComponents);
          if (result) {
            results.push(result);
          }
        } else {
          // This is a directory of components
          for (const item of files) {
            const itemPath = path.join(searchPath, item);
            const itemStat = await fs.stat(itemPath);
            if (itemStat.isDirectory()) {
              const result = await analyzeAuraComponent(itemPath, includeBaseComponents);
              if (result) {
                results.push(result);
              }
            }
          }
        }
      }
    }
  }

  // Remove duplicates by id
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
