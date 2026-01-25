/**
 * Type definitions for the LWC Convert VS Code extension
 */

export type ComponentType = 'aura' | 'vf';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ConversionMode = 'scaffolding' | 'full';

export interface ComponentInfo {
  name: string;
  type: ComponentType;
  filePath: string;
  grade?: GradeInfo;
}

export interface GradeInfo {
  letterGrade: LetterGrade;
  score: number;
  categories: CategoryScore[];
  effort: EffortEstimate;
}

export interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  factors: string[];
}

export interface EffortEstimate {
  minHours: number;
  maxHours: number;
  description: string;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  bundle?: LwcBundle;
  notes: string[];
  warnings: string[];
  errors: string[];
}

export interface LwcBundle {
  name: string;
  html: string;
  js: string;
  css?: string;
  meta: string;
}

export interface DependencyInfo {
  id: string;
  name: string;
  type: ComponentType | 'apex';
  dependencies: string[];
  dependents: string[];
  isCircular: boolean;
}

export interface ConversionOptions {
  mode: ConversionMode;
  outputDirectory: string;
  includeTests: boolean;
  dryRun: boolean;
}

export interface ExtensionSettings {
  outputDirectory: string;
  conversionMode: ConversionMode;
  showGradeDecorations: boolean;
  autoGradeOnOpen: boolean;
  showCodeLens: boolean;
}
