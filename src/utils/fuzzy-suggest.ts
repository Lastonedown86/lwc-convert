/**
 * Fuzzy suggestion utility for contextual error messages
 * Uses Fuse.js for fuzzy matching to suggest similar component names
 */

import Fuse, { IFuseOptions } from 'fuse.js';
import * as path from 'path';
import fs from 'fs-extra';
import { findProjectRoot } from './project-detector.js';
import {
  AURA_SEARCH_PATHS,
  VF_PAGE_SEARCH_PATHS,
  VF_COMPONENT_SEARCH_PATHS,
  APEX_SEARCH_PATHS,
} from './constants.js';

export interface FuzzySuggestion {
  name: string;
  path: string;
  score: number;
}

// Fuse.js options for fuzzy matching
const FUSE_OPTIONS: IFuseOptions<{ name: string; path: string }> = {
  keys: ['name'],
  threshold: 0.4, // Allow fairly fuzzy matches
  includeScore: true,
  minMatchCharLength: 2,
};

/**
 * Find similar Aura component names
 */
export async function suggestAuraComponents(input: string, maxResults: number = 3): Promise<FuzzySuggestion[]> {
  const components = await scanDirectories(AURA_SEARCH_PATHS, '.cmp');
  return fuzzyMatch(input, components, maxResults);
}

/**
 * Find similar Visualforce page/component names
 */
export async function suggestVfPages(input: string, maxResults: number = 3): Promise<FuzzySuggestion[]> {
  const pages = await scanDirectories([...VF_PAGE_SEARCH_PATHS, ...VF_COMPONENT_SEARCH_PATHS], '.page', '.component');
  return fuzzyMatch(input, pages, maxResults);
}

/**
 * Find similar Apex controller names
 */
export async function suggestApexControllers(input: string, maxResults: number = 3): Promise<FuzzySuggestion[]> {
  const controllers = await scanDirectories(APEX_SEARCH_PATHS, '.cls');
  return fuzzyMatch(input, controllers, maxResults);
}

/**
 * Scan directories for files matching extensions
 */
async function scanDirectories(
  searchPaths: string[],
  ...extensions: string[]
): Promise<{ name: string; path: string }[]> {
  const projectRoot = await findProjectRoot();
  const cwd = projectRoot || process.cwd();
  const results: { name: string; path: string }[] = [];

  for (const searchPath of searchPaths) {
    const fullPath = path.join(cwd, searchPath);
    if (await fs.pathExists(fullPath)) {
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Aura bundles - directory name is component name
            const componentPath = path.join(fullPath, entry.name);
            for (const ext of extensions) {
              const mainFile = path.join(componentPath, `${entry.name}${ext}`);
              if (await fs.pathExists(mainFile)) {
                results.push({
                  name: entry.name,
                  path: path.join(searchPath, entry.name),
                });
                break;
              }
            }
          } else if (entry.isFile()) {
            // VF pages/components - file name (without extension)
            for (const ext of extensions) {
              if (entry.name.endsWith(ext)) {
                results.push({
                  name: entry.name.replace(ext, ''),
                  path: path.join(searchPath, entry.name),
                });
                break;
              }
            }
          }
        }
      } catch {
        // Errors here are expected (directory not found, etc.)
      }
    }
  }

  return results;
}

/**
 * Perform fuzzy matching using Fuse.js
 */
function fuzzyMatch(
  input: string,
  items: { name: string; path: string }[],
  maxResults: number
): FuzzySuggestion[] {
  if (items.length === 0) return [];

  const fuse = new Fuse(items, FUSE_OPTIONS);
  const results = fuse.search(input);

  return results.slice(0, maxResults).map((result) => ({
    name: result.item.name,
    path: result.item.path,
    score: result.score || 0,
  }));
}

/**
 * Format suggestions for display in error messages
 */
export function formatSuggestions(suggestions: FuzzySuggestion[]): string {
  if (suggestions.length === 0) return '';

  const lines = suggestions.map((s, i) => {
    const prefix = i === 0 ? '→' : ' ';
    return `  ${prefix} ${s.name}`;
  });

  return `\nDid you mean?\n${lines.join('\n')}`;
}

/**
 * Get contextual help message based on error type
 */
export function getContextualHelp(errorType: 'aura' | 'vf' | 'apex', input: string): string {
  const tips: Record<string, string[]> = {
    aura: [
      'Aura component names are case-sensitive',
      'You can use just the component name (e.g., "AccountCard")',
      'Or provide a full path (e.g., "./force-app/main/default/aura/AccountCard")',
    ],
    vf: [
      'VF page names are case-sensitive',
      'You can omit the .page extension',
      'Or provide a full path (e.g., "./force-app/main/default/pages/ContactList.page")',
    ],
    apex: [
      'Apex class names are case-sensitive',
      'You can omit the .cls extension',
      'Make sure the controller exists in your classes folder',
    ],
  };

  return tips[errorType]?.map((tip) => `  • ${tip}`).join('\n') || '';
}
