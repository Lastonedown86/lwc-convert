import type { UserPreferences, ConversionMode, ThemeMode } from '../../types.js';
import { DEFAULT_PREFERENCES } from '../../types.js';

export interface SettingDefinition {
  id: keyof UserPreferences;
  label: string;
  description: string;
  type: 'boolean' | 'radio';
  category: string;
  options?: Array<{
    label: string;
    value: string;
    hint?: string;
  }>;
  defaultValue: unknown;
}

export const settingDefinitions: SettingDefinition[] = [
  // DEFAULTS (4)
  {
    id: 'defaultConversionMode',
    label: 'Conversion Mode',
    description: 'Choose the default mode for new conversions. You can override this in the wizard.',
    type: 'radio',
    category: 'Defaults',
    options: [
      {
        label: 'Scaffolding',
        value: 'scaffolding',
        hint: 'Creates a skeleton structure with TODOs for manual completion',
      },
      {
        label: 'Full',
        value: 'full',
        hint: 'Performs complete transformation with all logic migrated',
      },
    ],
    defaultValue: DEFAULT_PREFERENCES.defaultConversionMode,
  },
  {
    id: 'autoOpenFolder',
    label: 'Auto-open Output',
    description: 'Automatically open the output folder in your file explorer after a successful conversion.',
    type: 'boolean',
    category: 'Defaults',
    defaultValue: DEFAULT_PREFERENCES.autoOpenFolder,
  },
  {
    id: 'generatePreview',
    label: 'Generate Preview',
    description: 'Create an HTML preview of the converted component for visual inspection.',
    type: 'boolean',
    category: 'Defaults',
    defaultValue: DEFAULT_PREFERENCES.generatePreview,
  },
  {
    id: 'generateTests',
    label: 'Generate Tests',
    description: 'Automatically generate Jest test files for converted LWC components.',
    type: 'boolean',
    category: 'Defaults',
    defaultValue: DEFAULT_PREFERENCES.generateTests,
  },

  // DISPLAY (3)
  {
    id: 'theme',
    label: 'Theme',
    description: 'Choose the color theme for the CLI. Auto mode detects your terminal\'s theme automatically.',
    type: 'radio',
    category: 'Display',
    options: [
      {
        label: 'Auto',
        value: 'auto',
        hint: 'Automatically detect terminal theme',
      },
      {
        label: 'Dark',
        value: 'dark',
        hint: 'Use dark color scheme',
      },
      {
        label: 'Light',
        value: 'light',
        hint: 'Use light color scheme',
      },
    ],
    defaultValue: DEFAULT_PREFERENCES.theme,
  },
  {
    id: 'showGradeColors',
    label: 'Grade Colors',
    description: 'Show color-coded grades (A=green, B=blue, C=yellow, D=orange, F=red) in grading results.',
    type: 'boolean',
    category: 'Display',
    defaultValue: DEFAULT_PREFERENCES.showGradeColors,
  },
  {
    id: 'confirmBeforeActions',
    label: 'Confirmations',
    description: 'Show confirmation dialogs before performing destructive or important actions.',
    type: 'boolean',
    category: 'Display',
    defaultValue: DEFAULT_PREFERENCES.confirmBeforeActions,
  },

  // SESSION (1)
  {
    id: 'rememberLastProject',
    label: 'Remember Project',
    description: 'Remember the last opened project and restore it when you restart the CLI.',
    type: 'boolean',
    category: 'Session',
    defaultValue: DEFAULT_PREFERENCES.rememberLastProject,
  },
];

/**
 * Get the default value for a setting
 */
export function getDefaultValue(id: keyof UserPreferences): unknown {
  const setting = settingDefinitions.find((s) => s.id === id);
  return setting?.defaultValue ?? DEFAULT_PREFERENCES[id];
}

/**
 * Check if a setting has been modified from its default value
 */
export function isModified(preferences: UserPreferences, id: keyof UserPreferences): boolean {
  const defaultValue = getDefaultValue(id);
  return preferences[id] !== defaultValue;
}

/**
 * Get all categories with their setting count
 */
export function getCategories(): Array<{ name: string; count: number }> {
  const categoryMap = new Map<string, number>();

  for (const setting of settingDefinitions) {
    categoryMap.set(setting.category, (categoryMap.get(setting.category) ?? 0) + 1);
  }

  return Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
}
