/**
 * First-time user detection and welcome experience
 * Detects if this is the user's first time using lwc-convert
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.lwc-convert');
const FIRST_RUN_FILE = path.join(CONFIG_DIR, '.first-run-complete');

/**
 * Check if this is the user's first time running the tool
 */
export async function isFirstTime(): Promise<boolean> {
  try {
    // Check if the first-run marker file exists
    return !(await fs.pathExists(FIRST_RUN_FILE));
  } catch {
    return true;
  }
}

/**
 * Synchronous version of isFirstTime
 */
export function isFirstTimeSync(): boolean {
  try {
    return !fs.pathExistsSync(FIRST_RUN_FILE);
  } catch {
    return true;
  }
}

/**
 * Mark first-time experience as complete
 */
export async function markFirstTimeComplete(): Promise<void> {
  try {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeFile(FIRST_RUN_FILE, new Date().toISOString());
  } catch {
    // Silently fail - not critical
  }
}

/**
 * Synchronous version of markFirstTimeComplete
 */
export function markFirstTimeCompleteSync(): void {
  try {
    fs.ensureDirSync(CONFIG_DIR);
    fs.writeFileSync(FIRST_RUN_FILE, new Date().toISOString());
  } catch {
    // Silently fail - not critical
  }
}

/**
 * Get the welcome message content for first-time users
 */
export function getWelcomeContent(): {
  title: string;
  workflows: { icon: string; name: string; description: string }[];
  tips: string[];
} {
  return {
    title: 'Welcome to LWC Convert!',
    workflows: [
      {
        icon: '⚡',
        name: 'Convert Aura',
        description: 'Transform Aura components to Lightning Web Components',
      },
      {
        icon: '📄',
        name: 'Convert Visualforce',
        description: 'Migrate VF pages to modern LWC architecture',
      },
      {
        icon: '📊',
        name: 'Grade Complexity',
        description: 'Analyze components and get effort estimates before converting',
      },
    ],
    tips: [
      'Start with Grade to understand conversion complexity',
      'Use Scaffolding mode for complex components (recommended)',
      'Press ? anytime to see keyboard shortcuts',
      'Run with --help to see all CLI options',
    ],
  };
}
