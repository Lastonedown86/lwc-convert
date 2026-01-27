/**
 * Smart path resolver for Salesforce components
 * Searches common project locations when only a component name is provided
 */

import * as path from 'path';
import fs from 'fs-extra';
import { findProjectRoot } from './project-detector.js';

// Common Aura component locations in Salesforce projects
const AURA_SEARCH_PATHS = [
  'force-app/main/default/aura',
  'src/aura',
  'aura',
  'force-app/main/aura',
];

// Common Visualforce page locations in Salesforce projects
const VF_PAGE_SEARCH_PATHS = [
  'force-app/main/default/pages',
  'src/pages',
  'pages',
  'force-app/main/pages',
];

// Common Visualforce component locations in Salesforce projects
const VF_COMPONENT_SEARCH_PATHS = [
  'force-app/main/default/components',
  'src/components',
  'components',
  'force-app/main/components',
];

// Common Apex controller locations
const APEX_SEARCH_PATHS = [
  'force-app/main/default/classes',
  'src/classes',
  'classes',
  'force-app/main/classes',
];

export interface ResolvedPath {
  found: boolean;
  path: string;
  searchedLocations?: string[];
}

/**
 * Check if a path looks like a full path (has directory separators or starts with . or /)
 */
function isFullPath(inputPath: string): boolean {
  return (
    inputPath.includes('/') ||
    inputPath.includes('\\') ||
    inputPath.startsWith('.') ||
    path.isAbsolute(inputPath)
  );
}

/**
 * Resolve an Aura component path
 * If just a name is provided, searches common locations
 */
export async function resolveAuraPath(input: string): Promise<ResolvedPath> {
  // Try to find project root first
  const projectRoot = await findProjectRoot();
  const cwd = projectRoot || process.cwd();

  // If it's already a full path, just return it
  if (isFullPath(input)) {
    const resolved = path.resolve(input);
    return {
      found: await fs.pathExists(resolved),
      path: resolved,
    };
  }

  // It's just a component name - search for it
  const componentName = input;
  const searchedLocations: string[] = [];

  for (const searchPath of AURA_SEARCH_PATHS) {
    const fullPath = path.join(cwd, searchPath, componentName);
    searchedLocations.push(fullPath);

    if (await fs.pathExists(fullPath)) {
      // Verify it has a .cmp file
      const cmpFile = path.join(fullPath, `${componentName}.cmp`);
      if (await fs.pathExists(cmpFile)) {
        return {
          found: true,
          path: fullPath,
          searchedLocations,
        };
      }
    }
  }

  // Also search recursively in case of nested structure
  for (const searchPath of AURA_SEARCH_PATHS) {
    const basePath = path.join(cwd, searchPath);
    if (await fs.pathExists(basePath)) {
      const found = await searchForComponent(basePath, componentName, '.cmp');
      if (found) {
        return {
          found: true,
          path: found,
          searchedLocations,
        };
      }
    }
  }

  return {
    found: false,
    path: input,
    searchedLocations,
  };
}

/**
 * Resolve a Visualforce page or component path
 * If just a name is provided, searches common locations for both .page and .component files
 */
export async function resolveVfPath(input: string): Promise<ResolvedPath> {
  // Try to find project root first
  const projectRoot = await findProjectRoot();
  const cwd = projectRoot || process.cwd();

  // If it's already a full path, just return it
  if (isFullPath(input)) {
    const resolved = path.resolve(input);
    return {
      found: await fs.pathExists(resolved),
      path: resolved,
    };
  }

  const searchedLocations: string[] = [];

  // Check if extension is already provided
  const hasPageExtension = input.endsWith('.page');
  const hasComponentExtension = input.endsWith('.component');

  if (hasPageExtension) {
    // Search only in page directories
    for (const searchPath of VF_PAGE_SEARCH_PATHS) {
      const fullPath = path.join(cwd, searchPath, input);
      searchedLocations.push(fullPath);

      if (await fs.pathExists(fullPath)) {
        return { found: true, path: fullPath, searchedLocations };
      }
    }
  } else if (hasComponentExtension) {
    // Search only in component directories
    for (const searchPath of VF_COMPONENT_SEARCH_PATHS) {
      const fullPath = path.join(cwd, searchPath, input);
      searchedLocations.push(fullPath);

      if (await fs.pathExists(fullPath)) {
        return { found: true, path: fullPath, searchedLocations };
      }
    }
  } else {
    // No extension provided - search for both .page and .component files
    const baseName = input;

    // First search for .page files
    for (const searchPath of VF_PAGE_SEARCH_PATHS) {
      const fullPath = path.join(cwd, searchPath, `${baseName}.page`);
      searchedLocations.push(fullPath);

      if (await fs.pathExists(fullPath)) {
        return { found: true, path: fullPath, searchedLocations };
      }
    }

    // Then search for .component files
    for (const searchPath of VF_COMPONENT_SEARCH_PATHS) {
      const fullPath = path.join(cwd, searchPath, `${baseName}.component`);
      searchedLocations.push(fullPath);

      if (await fs.pathExists(fullPath)) {
        return { found: true, path: fullPath, searchedLocations };
      }
    }
  }

  return {
    found: false,
    path: input,
    searchedLocations,
  };
}

/**
 * Resolve an Apex controller path
 * If just a name is provided, searches common locations
 */
export async function resolveApexPath(input: string): Promise<ResolvedPath> {
  // Try to find project root first
  const projectRoot = await findProjectRoot();
  const cwd = projectRoot || process.cwd();

  // If it's already a full path, just return it
  if (isFullPath(input)) {
    const resolved = path.resolve(input);
    return {
      found: await fs.pathExists(resolved),
      path: resolved,
    };
  }

  // It's just a class name - search for it
  let className = input;
  // Add .cls extension if not present
  if (!className.endsWith('.cls')) {
    className = `${className}.cls`;
  }

  const searchedLocations: string[] = [];

  for (const searchPath of APEX_SEARCH_PATHS) {
    const fullPath = path.join(cwd, searchPath, className);
    searchedLocations.push(fullPath);

    if (await fs.pathExists(fullPath)) {
      return {
        found: true,
        path: fullPath,
        searchedLocations,
      };
    }
  }

  return {
    found: false,
    path: input,
    searchedLocations,
  };
}

/**
 * Recursively search for a component in a directory
 */
async function searchForComponent(
  baseDir: string,
  componentName: string,
  extension: string
): Promise<string | null> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === componentName) {
          const componentPath = path.join(baseDir, entry.name);
          const mainFile = path.join(componentPath, `${componentName}${extension}`);
          if (await fs.pathExists(mainFile)) {
            return componentPath;
          }
        }

        // Search subdirectories (but not too deep)
        const subResult = await searchForComponent(
          path.join(baseDir, entry.name),
          componentName,
          extension
        );
        if (subResult) {
          return subResult;
        }
      }
    }
  } catch {
    // Ignore errors (permission issues, etc.)
  }

  return null;
}

/**
 * Format search locations for user-friendly error message
 */
export function formatSearchLocations(locations: string[], cwd: string): string {
  return locations
    .map((loc) => `  - ${path.relative(cwd, loc) || loc}`)
    .join('\n');
}
