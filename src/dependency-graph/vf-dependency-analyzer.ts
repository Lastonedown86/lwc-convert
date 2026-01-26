/**
 * Visualforce page dependency analyzer
 * Extracts dependencies from VF pages including:
 * - Custom components (c:*)
 * - Apex controller and extensions
 * - Page includes (apex:include)
 * - Remote actions
 * - Static resources
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as htmlparser2 from 'htmlparser2';
import { DomHandler, Element, Node } from 'domhandler';
import { logger } from '../utils/logger';
import {
  ComponentAnalysisResult,
  RawDependency,
} from './types';

/**
 * Parse VF markup and extract all dependencies
 */
function extractVfDependencies(markup: string): RawDependency[] {
  const dependencies: RawDependency[] = [];
  const seen = new Set<string>();

  function addDependency(dep: RawDependency) {
    const key = `${dep.type}:${dep.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      dependencies.push(dep);
    }
  }

  const handler = new DomHandler((error) => {
    if (error) {
      logger.debug(`VF markup parsing error: ${error.message}`);
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

  // Find apex:page to extract controller info
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

  if (apexPage) {
    const attrs = apexPage.attribs || {};

    // Custom Apex controller
    if (attrs.controller) {
      addDependency({
        target: `apex:${attrs.controller}`,
        type: 'controller',
        expression: `controller="${attrs.controller}"`,
      });
    }

    // Standard controller (object dependency)
    if (attrs.standardcontroller) {
      addDependency({
        target: `sobject:${attrs.standardcontroller}`,
        type: 'controller',
        expression: `standardController="${attrs.standardcontroller}"`,
      });
    }

    // Controller extensions
    if (attrs.extensions) {
      const extensions = attrs.extensions.split(',').map((s: string) => s.trim());
      for (const ext of extensions) {
        addDependency({
          target: `apex:${ext}`,
          type: 'extension',
          expression: `extensions="${ext}"`,
        });
      }
    }
  }

  // Traverse all nodes
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

      // apex:include - page includes
      if (tagName === 'apex:include') {
        const pageName = element.attribs?.pagename;
        if (pageName) {
          addDependency({
            target: `vf:${pageName}`,
            type: 'include',
            lineNumber: lineEstimate,
            expression: `<apex:include pageName="${pageName}">`,
          });
        }
      }

      // apex:composition - template usage
      if (tagName === 'apex:composition') {
        const template = element.attribs?.template;
        if (template) {
          addDependency({
            target: `vf:${template}`,
            type: 'include',
            lineNumber: lineEstimate,
            expression: `<apex:composition template="${template}">`,
          });
        }
      }

      // apex:component - custom component usage
      if (tagName === 'apex:component') {
        // This is a component definition, not a reference
        // But check if it references a controller
        const controller = element.attribs?.controller;
        if (controller) {
          addDependency({
            target: `apex:${controller}`,
            type: 'controller',
            lineNumber: lineEstimate,
            expression: `controller="${controller}"`,
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

  // Extract dependencies from expressions in markup
  extractExpressionDependencies(markup, addDependency);

  // Extract remote action dependencies
  extractRemoteActionDependencies(markup, addDependency);

  return dependencies;
}

/**
 * Extract dependencies from VF expressions like {!$Resource.xxx} and {!$Label.xxx}
 */
function extractExpressionDependencies(
  markup: string,
  addDependency: (dep: RawDependency) => void
): void {
  const lines = markup.split('\n');

  lines.forEach((line, lineNum) => {
    // $Resource references
    const resourceMatches = line.matchAll(/\{\!\$Resource\.([^}]+)\}/g);
    for (const match of resourceMatches) {
      addDependency({
        target: `resource:${match[1]}`,
        type: 'staticResource',
        lineNumber: lineNum + 1,
        expression: match[0],
      });
    }

    // $Label references
    const labelMatches = line.matchAll(/\{\!\$Label\.([^}]+)\}/g);
    for (const match of labelMatches) {
      addDependency({
        target: `label:${match[1]}`,
        type: 'label',
        lineNumber: lineNum + 1,
        expression: match[0],
      });
    }
  });
}

/**
 * Extract RemoteAction patterns from JavaScript
 */
function extractRemoteActionDependencies(
  content: string,
  addDependency: (dep: RawDependency) => void
): void {
  const lines = content.split('\n');

  lines.forEach((line, lineNum) => {
    // Visualforce.remoting.Manager.invokeAction pattern
    const invokeMatch = line.match(
      /(?:Visualforce\.remoting\.Manager\.invokeAction|invokeAction)\s*\(\s*['"]([^'"]+)['"]/
    );
    if (invokeMatch) {
      const fullRef = invokeMatch[1];
      const parts = fullRef.split('.');
      if (parts.length >= 2) {
        const controller = parts.slice(0, -1).join('.');
        addDependency({
          target: `apex:${controller}`,
          type: 'controller',
          lineNumber: lineNum + 1,
          expression: invokeMatch[0],
        });
      }
    }

    // $RemoteAction.Controller.method pattern
    const remoteActionMatch = line.match(/\{\!\$RemoteAction\.([^.]+)\.(\w+)\}/);
    if (remoteActionMatch) {
      addDependency({
        target: `apex:${remoteActionMatch[1]}`,
        type: 'controller',
        lineNumber: lineNum + 1,
        expression: remoteActionMatch[0],
      });
    }
  });
}

/**
 * Analyze a single Visualforce page
 */
export async function analyzeVfPage(
  pagePath: string
): Promise<ComponentAnalysisResult | null> {
  try {
    // Handle both .page files and directories
    let actualPath = pagePath;
    if (!pagePath.endsWith('.page')) {
      // Check if it's a directory with a .page file
      if (await fs.pathExists(pagePath)) {
        const stat = await fs.stat(pagePath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(pagePath);
          const pageFile = files.find((f) => f.endsWith('.page'));
          if (pageFile) {
            actualPath = path.join(pagePath, pageFile);
          } else {
            return null;
          }
        }
      }
    }

    if (!(await fs.pathExists(actualPath))) {
      logger.debug(`VF page not found: ${actualPath}`);
      return null;
    }

    const markup = await fs.readFile(actualPath, 'utf-8');
    const pageName = path.basename(actualPath, '.page');

    const dependencies = extractVfDependencies(markup);

    return {
      id: `vf:${pageName}`,
      name: pageName,
      type: 'vf',
      filePath: actualPath,
      dependencies,
    };
  } catch (error: any) {
    logger.debug(`Error analyzing VF page ${pagePath}: ${error.message}`);
    return null;
  }
}

/**
 * Analyze a single Visualforce component (.component file)
 */
export async function analyzeVfComponent(
  componentPath: string
): Promise<ComponentAnalysisResult | null> {
  try {
    let actualPath = componentPath;
    if (!componentPath.endsWith('.component')) {
      // Check if it's a directory with a .component file
      if (await fs.pathExists(componentPath)) {
        const stat = await fs.stat(componentPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(componentPath);
          const componentFile = files.find((f) => f.endsWith('.component'));
          if (componentFile) {
            actualPath = path.join(componentPath, componentFile);
          } else {
            return null;
          }
        }
      }
    }

    if (!(await fs.pathExists(actualPath))) {
      logger.debug(`VF component not found: ${actualPath}`);
      return null;
    }

    const markup = await fs.readFile(actualPath, 'utf-8');
    const componentName = path.basename(actualPath, '.component');

    const dependencies = extractVfDependencies(markup);

    return {
      id: `vf:${componentName}`,
      name: componentName,
      type: 'vf',
      filePath: actualPath,
      dependencies,
    };
  } catch (error: any) {
    logger.debug(`Error analyzing VF component ${componentPath}: ${error.message}`);
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
 * Recursively find all 'pages' and 'components' directories within a path
 */
async function findVfDirectories(basePath: string): Promise<{ pages: string[]; components: string[] }> {
  const pagesDirectories: string[] = [];
  const componentsDirectories: string[] = [];

  async function searchDir(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 5) return; // Limit recursion depth

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.name === 'pages') {
            pagesDirectories.push(fullPath);
          } else if (entry.name === 'components') {
            componentsDirectories.push(fullPath);
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
  return { pages: pagesDirectories, components: componentsDirectories };
}

/**
 * Scan a directory for Visualforce pages and components and analyze all of them
 */
export async function scanVfPages(rootPath: string): Promise<ComponentAnalysisResult[]> {
  const results: ComponentAnalysisResult[] = [];
  const pageSearchPaths: string[] = [];
  const componentSearchPaths: string[] = [];

  // First, try to read sfdx-project.json for package directories
  const packageDirs = await getPackageDirectories(rootPath);

  if (packageDirs.length > 0) {
    // Search within each package directory for 'pages' and 'components' folders
    for (const pkgDir of packageDirs) {
      const foundDirs = await findVfDirectories(pkgDir);
      pageSearchPaths.push(...foundDirs.pages);
      componentSearchPaths.push(...foundDirs.components);
    }
    logger.debug(`Found pages directories from sfdx-project.json: ${pageSearchPaths.join(', ')}`);
    logger.debug(`Found components directories from sfdx-project.json: ${componentSearchPaths.join(', ')}`);
  }

  // Also add fallback common locations for pages
  const fallbackPagePaths = [
    path.join(rootPath, 'force-app/main/default/pages'),
    path.join(rootPath, 'src/pages'),
    path.join(rootPath, 'pages'),
  ];

  for (const fallback of fallbackPagePaths) {
    if (!pageSearchPaths.includes(fallback)) {
      pageSearchPaths.push(fallback);
    }
  }

  // Also add fallback common locations for components
  const fallbackComponentPaths = [
    path.join(rootPath, 'force-app/main/default/components'),
    path.join(rootPath, 'src/components'),
    path.join(rootPath, 'components'),
  ];

  for (const fallback of fallbackComponentPaths) {
    if (!componentSearchPaths.includes(fallback)) {
      componentSearchPaths.push(fallback);
    }
  }

  // Also check if rootPath itself is a pages/components directory or a .page/.component file
  if (rootPath.endsWith('.page')) {
    pageSearchPaths.unshift(rootPath);
  } else if (rootPath.endsWith('.component')) {
    componentSearchPaths.unshift(rootPath);
  } else if (await fs.pathExists(rootPath)) {
    const stat = await fs.stat(rootPath);
    if (stat.isDirectory()) {
      const files = await fs.readdir(rootPath);
      if (files.some(f => f.endsWith('.page'))) {
        pageSearchPaths.unshift(rootPath);
      }
      if (files.some(f => f.endsWith('.component'))) {
        componentSearchPaths.unshift(rootPath);
      }
    }
  }

  logger.debug(`Searching for VF pages in: ${pageSearchPaths.join(', ')}`);
  logger.debug(`Searching for VF components in: ${componentSearchPaths.join(', ')}`);

  // Scan for .page files
  for (const searchPath of pageSearchPaths) {
    if (await fs.pathExists(searchPath)) {
      const stat = await fs.stat(searchPath);

      if (stat.isFile() && searchPath.endsWith('.page')) {
        // Single page file
        const result = await analyzeVfPage(searchPath);
        if (result) {
          results.push(result);
        }
      } else if (stat.isDirectory()) {
        // Scan directory for .page files
        const files = await fs.readdir(searchPath);
        for (const file of files) {
          if (file.endsWith('.page')) {
            const result = await analyzeVfPage(path.join(searchPath, file));
            if (result) {
              results.push(result);
            }
          }
        }
      }
    }
  }

  // Scan for .component files
  for (const searchPath of componentSearchPaths) {
    if (await fs.pathExists(searchPath)) {
      const stat = await fs.stat(searchPath);

      if (stat.isFile() && searchPath.endsWith('.component')) {
        // Single component file
        const result = await analyzeVfComponent(searchPath);
        if (result) {
          results.push(result);
        }
      } else if (stat.isDirectory()) {
        // Scan directory for .component files
        const files = await fs.readdir(searchPath);
        for (const file of files) {
          if (file.endsWith('.component')) {
            const result = await analyzeVfComponent(path.join(searchPath, file));
            if (result) {
              results.push(result);
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
