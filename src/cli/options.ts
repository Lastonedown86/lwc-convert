/**
 * CLI option definitions and types
 */

export interface ConversionOptions {
  output: string;
  full: boolean;
  dryRun: boolean;
  verbose: boolean;
  open: boolean;
  controller?: string;
}

export interface AuraConversionOptions extends ConversionOptions {
  // Aura-specific options can be added here
}

export interface VfConversionOptions extends ConversionOptions {
  controller?: string;
}

export const DEFAULT_OUTPUT_DIR = './lwc-output';

export const CLI_VERSION = '1.0.0';

export const CLI_NAME = 'lwc-convert';

export const CLI_DESCRIPTION = `
Convert Salesforce Aura components and Visualforce pages to Lightning Web Components.

Features:
  • Smart path resolution - just use the component name
  • Generates LWC bundle with HTML, JS, CSS, and meta.xml
  • Auto-generates Jest tests for converted components
  • Creates behavior spec documentation
  • Handles LMS, wire adapters, and Apex integration

Conversion Modes:
  scaffolding (default)  LWC skeleton with guided TODO comments
  full (--full)          Complete automated code transformation
`;
