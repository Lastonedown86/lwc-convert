// TUI Type Definitions

export type ScreenType =
  | 'dashboard'
  | 'browser'
  | 'wizard'
  | 'grading'
  | 'settings'
  | 'detail';

export type ModalType = 'export' | 'help' | 'confirm' | 'command-palette';

export type ThemeMode = 'auto' | 'dark' | 'light';

export type ConversionMode = 'scaffolding' | 'full';

export type ComponentType = 'aura' | 'vf';

export type GradeLevel = 'A' | 'B' | 'C' | 'D' | 'F';

export type SortDirection = 'asc' | 'desc';

export type GradingSortBy = 'score' | 'name' | 'complexity' | 'type';

export type BrowserSortBy = 'name' | 'grade' | 'type';

export type BrowserFilterType = 'all' | 'aura' | 'vf';

export interface ComponentInfo {
  id: string;
  name: string;
  type: ComponentType;
  path: string;
  files: string[];
  score?: number;
  grade?: GradeLevel;
}

export interface UserPreferences {
  // Defaults
  defaultOutputDir: string;
  defaultConversionMode: ConversionMode;
  autoOpenFolder: boolean;
  generatePreview: boolean;
  generateTests: boolean;

  // Display
  theme: ThemeMode;
  showGradeColors: boolean;
  visibleRows: number | 'auto';
  confirmBeforeActions: boolean;

  // Session
  rememberLastProject: boolean;
  sessionExpiryHours: number;

  // Grading defaults
  defaultExportFormat: 'json' | 'csv' | 'html' | 'md';
}

export interface BrowserState {
  expandedNodes: Set<string>;
  selectedItems: string[];
  searchQuery: string;
  sortBy: BrowserSortBy;
  filterType: BrowserFilterType;
  scrollOffset: number;
}

export interface GradingDisplayState {
  selectedIndex: number;
  scrollOffset: number;
  viewMode: 'list' | 'detail';
  sortBy: GradingSortBy;
  sortDirection: SortDirection;
  filterGrade: GradeLevel | null;
  searchQuery: string;
}

export interface WizardState {
  currentStep: number;
  sourceType: ComponentType | null;
  sourcePath: string;
  sourceComponent: ComponentInfo | null;
  conversionMode: ConversionMode;
  outputDir: string;
  generatePreview: boolean;
  generateTests: boolean;
  controllerPaths: string[];
}

export interface RecentConversion {
  name: string;
  type: ComponentType;
  timestamp: Date;
  score: number;
  grade: GradeLevel;
  success: boolean;
}

export interface ProjectHealth {
  auraCount: number;
  vfCount: number;
  avgScore: number;
  avgGrade: GradeLevel;
  readyToConvert: number;
}

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  metadata?: Record<string, unknown>;
  isExpanded?: boolean;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: number | 'auto';
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, item: T) => string;
}

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  global?: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultOutputDir: './lwc-output',
  defaultConversionMode: 'scaffolding',
  autoOpenFolder: true,
  generatePreview: false,
  generateTests: true,
  theme: 'auto',
  showGradeColors: true,
  visibleRows: 'auto',
  confirmBeforeActions: true,
  rememberLastProject: true,
  sessionExpiryHours: 4,
  defaultExportFormat: 'json',
};
