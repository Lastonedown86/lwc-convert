/**
 * CLI option definitions and types
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json to keep in sync
function getPackageVersion(): string {
  // Use build-time injected version if available
  if (process.env.CLI_VERSION) {
    return process.env.CLI_VERSION;
  }

  try {
    // Try multiple paths to find package.json
    const possiblePaths = [
      // When running from dist/
      join(process.cwd(), 'package.json'),
      // When running tests or from src/
      join(process.cwd(), '..', 'package.json'),
    ];

    for (const packagePath of possiblePaths) {
      try {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        if (packageJson.name === 'lwc-convert') {
          return packageJson.version;
        }
      } catch {
        continue;
      }
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export interface ConversionOptions {
  output: string;
  full: boolean;
  dryRun: boolean;
  verbose: boolean;
  open: boolean;
  preview: boolean;
  controller?: string;
}

// Type alias for Aura-specific options (can be extended later)
export type AuraConversionOptions = ConversionOptions;

export interface VfConversionOptions extends ConversionOptions {
  controller?: string;
}

export const DEFAULT_OUTPUT_DIR = './lwc-output';

export const CLI_VERSION = getPackageVersion();

export const CLI_NAME = 'lwc-convert';

export const CLI_DESCRIPTION = `
Convert Salesforce Aura components and Visualforce pages to Lightning Web Components.

Features:
  • Smart path resolution - just use the component name
  • Generates LWC bundle with HTML, JS, CSS, and meta.xml
  • Auto-generates Jest tests for converted components
  • Creates behavior spec documentation
  • Handles LMS, wire adapters, and Apex integration
  • UI preview - see your converted component in a browser

Conversion Modes:
  scaffolding (default)  LWC skeleton with guided TODO comments
  full (--full)          Complete automated code transformation
`;
