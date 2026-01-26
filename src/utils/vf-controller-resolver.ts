/**
 * Utility for detecting and resolving Apex controllers referenced in Visualforce pages
 * Parses VF markup to extract controller names and searches the project for matching files
 */

import fs from 'fs-extra';
import { resolveApexPath } from './path-resolver';
import { logger } from './logger';

export interface VfControllerReference {
  name: string;
  type: 'controller' | 'extension' | 'remoteAction';
  path?: string;
  found: boolean;
}

export interface VfControllersResult {
  controllers: VfControllerReference[];
  hasControllers: boolean;
  allFound: boolean;
}

/**
 * Extract controller class names from VF page markup
 * Looks for: controller attribute, extensions attribute, and $RemoteAction references
 */
export function extractControllerNames(markup: string): { name: string; type: VfControllerReference['type'] }[] {
  const controllers: { name: string; type: VfControllerReference['type'] }[] = [];
  const seen = new Set<string>();

  // Find apex:page tag and extract controller/extensions attributes
  const apexPageRegex = /<apex:page[^>]*>/i;
  const pageMatch = markup.match(apexPageRegex);

  if (pageMatch) {
    const pageTag = pageMatch[0];

    // Extract main controller
    const controllerMatch = pageTag.match(/\bcontroller\s*=\s*["']([^"']+)["']/i);
    if (controllerMatch) {
      const name = controllerMatch[1].trim();
      if (!seen.has(name.toLowerCase())) {
        controllers.push({ name, type: 'controller' });
        seen.add(name.toLowerCase());
      }
    }

    // Extract extensions (comma-separated list)
    const extensionsMatch = pageTag.match(/\bextensions\s*=\s*["']([^"']+)["']/i);
    if (extensionsMatch) {
      const extensionNames = extensionsMatch[1].split(',').map(s => s.trim()).filter(s => s);
      for (const name of extensionNames) {
        if (!seen.has(name.toLowerCase())) {
          controllers.push({ name, type: 'extension' });
          seen.add(name.toLowerCase());
        }
      }
    }
  }

  // Find $RemoteAction references: {!$RemoteAction.ControllerName.methodName}
  const remoteActionRegex = /\{\!\$RemoteAction\.([^.]+)\.\w+\}/g;
  let match;
  while ((match = remoteActionRegex.exec(markup)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name.toLowerCase())) {
      controllers.push({ name, type: 'remoteAction' });
      seen.add(name.toLowerCase());
    }
  }

  // Find Visualforce.remoting.Manager.invokeAction references
  const invokeActionRegex = /(?:Visualforce\.remoting\.Manager\.invokeAction|invokeAction)\s*\(\s*['"]([^'"]+)\.([\w]+)['"]/g;
  while ((match = invokeActionRegex.exec(markup)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name.toLowerCase())) {
      controllers.push({ name, type: 'remoteAction' });
      seen.add(name.toLowerCase());
    }
  }

  return controllers;
}

/**
 * Find VF controllers referenced in markup and resolve their file paths
 */
export async function findVfControllers(markup: string): Promise<VfControllersResult> {
  const controllerNames = extractControllerNames(markup);
  const controllers: VfControllerReference[] = [];

  for (const { name, type } of controllerNames) {
    const resolved = await resolveApexPath(name);
    
    controllers.push({
      name,
      type,
      path: resolved.found ? resolved.path : undefined,
      found: resolved.found,
    });

    if (resolved.found) {
      logger.debug(`Found ${type}: ${name} at ${resolved.path}`);
    } else {
      logger.debug(`${type} not found in project: ${name}`);
    }
  }

  return {
    controllers,
    hasControllers: controllers.length > 0,
    allFound: controllers.length > 0 && controllers.every(c => c.found),
  };
}

/**
 * Read content for all found controllers
 */
export async function readControllerContents(
  controllers: VfControllerReference[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();

  for (const controller of controllers) {
    if (controller.found && controller.path) {
      try {
        const content = await fs.readFile(controller.path, 'utf-8');
        contents.set(controller.name, content);
        logger.debug(`Read controller content: ${controller.name}`);
      } catch (error) {
        logger.warn(`Failed to read controller: ${controller.path}`);
      }
    }
  }

  return contents;
}

/**
 * Get a display-friendly type label
 */
export function getControllerTypeLabel(type: VfControllerReference['type']): string {
  switch (type) {
    case 'controller':
      return 'Controller';
    case 'extension':
      return 'Extension';
    case 'remoteAction':
      return 'Remote Action';
    default:
      return 'Controller';
  }
}
