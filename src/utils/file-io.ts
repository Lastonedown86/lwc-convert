/**
 * File I/O utilities for reading and writing component files
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

export interface AuraBundle {
  name: string;
  path: string;
  markup?: string;         // .cmp file content
  controller?: string;     // Controller.js content
  helper?: string;         // Helper.js content
  style?: string;          // .css content
  design?: string;         // .design content
  documentation?: string;  // .auradoc content
  svg?: string;            // .svg content
}

export interface VfPage {
  name: string;
  path: string;
  markup: string;          // .page file content
  controller?: string;     // Associated Apex controller content
  controllerPath?: string; // Path to the controller file
}

export interface LwcBundle {
  name: string;
  html: string;
  js: string;
  css?: string;
  meta: string;
}

/**
 * Read an Aura component bundle from a directory
 */
export async function readAuraBundle(bundlePath: string): Promise<AuraBundle> {
  const resolvedPath = path.resolve(bundlePath);

  if (!await fs.pathExists(resolvedPath)) {
    throw new Error(`Aura bundle not found at: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Expected a directory for Aura bundle: ${resolvedPath}`);
  }

  const bundleName = path.basename(resolvedPath);
  const files = await fs.readdir(resolvedPath);

  const bundle: AuraBundle = {
    name: bundleName,
    path: resolvedPath,
  };

  for (const file of files) {
    const filePath = path.join(resolvedPath, file);
    const content = await fs.readFile(filePath, 'utf-8');

    if (file.endsWith('.cmp')) {
      bundle.markup = content;
      logger.debug(`Read markup: ${file}`);
    } else if (file.endsWith('Controller.js')) {
      bundle.controller = content;
      logger.debug(`Read controller: ${file}`);
    } else if (file.endsWith('Helper.js')) {
      bundle.helper = content;
      logger.debug(`Read helper: ${file}`);
    } else if (file.endsWith('.css')) {
      bundle.style = content;
      logger.debug(`Read style: ${file}`);
    } else if (file.endsWith('.design')) {
      bundle.design = content;
      logger.debug(`Read design: ${file}`);
    } else if (file.endsWith('.auradoc')) {
      bundle.documentation = content;
      logger.debug(`Read documentation: ${file}`);
    } else if (file.endsWith('.svg')) {
      bundle.svg = content;
      logger.debug(`Read SVG: ${file}`);
    }
  }

  if (!bundle.markup) {
    throw new Error(`No .cmp file found in Aura bundle: ${resolvedPath}`);
  }

  return bundle;
}

/**
 * Read a Visualforce page or component file
 */
export async function readVfPage(pagePath: string, controllerPath?: string): Promise<VfPage> {
  const resolvedPath = path.resolve(pagePath);

  if (!await fs.pathExists(resolvedPath)) {
    throw new Error(`Visualforce file not found at: ${resolvedPath}`);
  }

  const isPage = resolvedPath.endsWith('.page');
  const isComponent = resolvedPath.endsWith('.component');

  if (!isPage && !isComponent) {
    throw new Error(`Expected a .page or .component file: ${resolvedPath}`);
  }

  const extension = isPage ? '.page' : '.component';
  const pageName = path.basename(resolvedPath, extension);
  const markup = await fs.readFile(resolvedPath, 'utf-8');

  const vfPage: VfPage = {
    name: pageName,
    path: resolvedPath,
    markup,
  };

  // Read associated controller if provided
  if (controllerPath) {
    const resolvedControllerPath = path.resolve(controllerPath);
    if (await fs.pathExists(resolvedControllerPath)) {
      vfPage.controller = await fs.readFile(resolvedControllerPath, 'utf-8');
      vfPage.controllerPath = resolvedControllerPath;
      logger.debug(`Read controller: ${controllerPath}`);
    } else {
      logger.warn(`Controller not found: ${resolvedControllerPath}`);
    }
  }

  return vfPage;
}

/**
 * Write an LWC bundle to the output directory
 * Creates a subfolder with the component name containing all bundle files
 */
export async function writeLwcBundle(
  outputDir: string,
  bundle: LwcBundle,
  dryRun: boolean = false
): Promise<string[]> {
  // Component files go directly into outputDir/componentName/
  const componentDir = path.join(outputDir, bundle.name);
  const writtenFiles: string[] = [];

  if (dryRun) {
    logger.info(`[DRY RUN] Would create directory: ${componentDir}`);
    logger.info(`[DRY RUN] Would write: ${bundle.name}.html`);
    logger.info(`[DRY RUN] Would write: ${bundle.name}.js`);
    if (bundle.css) {
      logger.info(`[DRY RUN] Would write: ${bundle.name}.css`);
    }
    logger.info(`[DRY RUN] Would write: ${bundle.name}.js-meta.xml`);
    return writtenFiles;
  }

  await fs.ensureDir(componentDir);

  // Write HTML template
  const htmlPath = path.join(componentDir, `${bundle.name}.html`);
  await fs.writeFile(htmlPath, bundle.html, 'utf-8');
  writtenFiles.push(htmlPath);
  logger.file('CREATE', htmlPath);

  // Write JavaScript
  const jsPath = path.join(componentDir, `${bundle.name}.js`);
  await fs.writeFile(jsPath, bundle.js, 'utf-8');
  writtenFiles.push(jsPath);
  logger.file('CREATE', jsPath);

  // Write CSS if present
  if (bundle.css) {
    const cssPath = path.join(componentDir, `${bundle.name}.css`);
    await fs.writeFile(cssPath, bundle.css, 'utf-8');
    writtenFiles.push(cssPath);
    logger.file('CREATE', cssPath);
  }

  // Write meta XML
  const metaPath = path.join(componentDir, `${bundle.name}.js-meta.xml`);
  await fs.writeFile(metaPath, bundle.meta, 'utf-8');
  writtenFiles.push(metaPath);
  logger.file('CREATE', metaPath);

  return writtenFiles;
}

/**
 * Write a conversion notes file
 */
export async function writeConversionNotes(
  outputDir: string,
  componentName: string,
  notes: string[],
  dryRun: boolean = false
): Promise<void> {
  const notesPath = path.join(outputDir, componentName, `${componentName}-conversion-notes.md`);

  const content = `# Conversion Notes for ${componentName}

This file documents items that require manual attention after automated conversion.

## Action Items

${notes.map((note, i) => `${i + 1}. ${note}`).join('\n')}

## Verification Checklist

- [ ] Review all TODO comments in the generated code
- [ ] Verify Apex method imports and wire adapters
- [ ] Test event handling and data flow
- [ ] Validate styling matches original component
- [ ] Deploy to scratch org and test functionality
`;

  if (dryRun) {
    logger.info(`[DRY RUN] Would write conversion notes: ${notesPath}`);
    return;
  }

  await fs.writeFile(notesPath, content, 'utf-8');
  logger.file('CREATE', notesPath);
}

/**
 * Write a generic file with directory creation
 */
export async function writeFile(
  filePath: string,
  content: string,
  dryRun: boolean = false
): Promise<void> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would write: ${filePath}`);
    return;
  }

  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(filePath, content, 'utf-8');
  logger.file('CREATE', filePath);
}

/**
 * Convert a component name to LWC naming convention (camelCase to kebab-case)
 */
export function toLwcName(name: string): string {
  // Convert PascalCase or camelCase to kebab-case
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Convert kebab-case to PascalCase for class names
 */
export function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Convert to camelCase for property names
 */
export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
