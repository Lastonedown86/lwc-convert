/**
 * Smart path resolver for Salesforce components
 * Searches common project locations when only a component name is provided
 */

import * as path from 'path';
import * as fs from 'fs-extra';

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
  const cwd = process.cwd();
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
    } catch {
      // Ignore errors reading sfdx-project.json
    }
  }

  return [];
}

/**
 * Recursively find all directories with a given name within a path
 */
async function findDirectoriesByName(basePath: string, targetName: string, maxDepth: number = 5): Promise<string[]> {
  const foundDirectories: string[] = [];

  async function searchDir(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.name === targetName) {
            foundDirectories.push(fullPath);
          } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await searchDir(fullPath, depth + 1);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  await searchDir(basePath, 0);
  return foundDirectories;
}

/**
 * Recursively search for a VF file (.page or .component) in a directory
 */
async function searchForVfFile(
  baseDir: string,
  fileName: string,
  maxDepth: number = 5
): Promise<string | null> {
  async function searchDir(dirPath: string, depth: number): Promise<string | null> {
    if (depth > maxDepth) return null;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile() && entry.name === fileName) {
          return fullPath;
        }

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const found = await searchDir(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch {
      // Ignore permission errors
    }

    return null;
  }

  return searchDir(baseDir, 0);
}

/**
 * Resolve a Visualforce page or component path
 * If just a name is provided, searches common locations
 */
export async function resolveVfPath(input: string): Promise<ResolvedPath> {
  // If it's already a full path, just return it
  if (isFullPath(input)) {
    const resolved = path.resolve(input);
    return {
      found: await fs.pathExists(resolved),
      path: resolved,
    };
  }

  // Determine if we're looking for a page or component
  let fileName = input;
  let isComponent = false;

  if (fileName.endsWith('.component')) {
    isComponent = true;
  } else if (fileName.endsWith('.page')) {
    isComponent = false;
  } else {
    // No extension - default to .page
    fileName = `${fileName}.page`;
  }

  const cwd = process.cwd();
  const searchedLocations: string[] = [];

  // Build list of search paths from sfdx-project.json and fallbacks
  const searchPaths: string[] = [];

  // Determine which directory name and fallback paths to use
  const targetDirName = isComponent ? 'components' : 'pages';
  const fallbackPaths = isComponent ? VF_COMPONENT_SEARCH_PATHS : VF_PAGE_SEARCH_PATHS;

  // First, try to read sfdx-project.json for package directories
  const packageDirs = await getPackageDirectories(cwd);
  if (packageDirs.length > 0) {
    // Search within each package directory for target folders
    for (const pkgDir of packageDirs) {
      const foundDirs = await findDirectoriesByName(pkgDir, targetDirName);
      searchPaths.push(...foundDirs);
    }
  }

  // Add fallback common locations
  for (const searchPath of fallbackPaths) {
    const fullPath = path.join(cwd, searchPath);
    if (!searchPaths.includes(fullPath)) {
      searchPaths.push(fullPath);
    }
  }

  // Search in each path
  for (const searchPath of searchPaths) {
    const fullPath = path.join(searchPath, fileName);
    searchedLocations.push(fullPath);

    if (await fs.pathExists(fullPath)) {
      return {
        found: true,
        path: fullPath,
        searchedLocations,
      };
    }
  }

  // Also search recursively in package directories
  for (const pkgDir of packageDirs) {
    const found = await searchForVfFile(pkgDir, fileName);
    if (found) {
      return {
        found: true,
        path: found,
        searchedLocations,
      };
    }
  }

  // Search recursively in standard locations as fallback
  for (const searchPath of fallbackPaths) {
    const basePath = path.join(cwd, searchPath);
    if (await fs.pathExists(basePath)) {
      const found = await searchForVfFile(basePath, fileName);
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
 * Resolve an Apex controller path
 * If just a name is provided, searches common locations
 */
export async function resolveApexPath(input: string): Promise<ResolvedPath> {
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

  const cwd = process.cwd();
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
