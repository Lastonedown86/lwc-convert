/**
 * Auto-detect Salesforce project root by finding sfdx-project.json
 */

import * as path from 'path';
import fs from 'fs-extra';

const PROJECT_MARKERS = [
  'sfdx-project.json',
  'force-app',
  'package.json', // fallback
];

export async function findProjectRoot(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for project markers
    for (const marker of PROJECT_MARKERS) {
      const markerPath = path.join(currentDir, marker);
      if (await fs.pathExists(markerPath)) {
        // If it's sfdx-project.json, we found it!
        if (marker === 'sfdx-project.json') {
          return currentDir;
        }
        // For force-app or package.json, verify it looks like SFDX
        if (marker === 'force-app') {
          const sfdxPath = path.join(currentDir, 'sfdx-project.json');
          if (await fs.pathExists(sfdxPath)) {
            return currentDir;
          }
        }
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }

  return null;
}

export async function ensureProjectRoot(): Promise<{ root: string; changed: boolean }> {
  const cwd = process.cwd();
  const projectRoot = await findProjectRoot(cwd);

  if (projectRoot && projectRoot !== cwd) {
    process.chdir(projectRoot);
    return { root: projectRoot, changed: true };
  }

  return { root: cwd, changed: false };
}
