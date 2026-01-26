// Theme definitions for the TUI

export interface Theme {
  name: string;

  // Primary colors
  primary: string;
  secondary: string;
  accent: string;

  // Text colors
  text: string;
  textMuted: string;
  textInverse: string;

  // Background colors
  background: string;
  backgroundAlt: string;
  backgroundHighlight: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Grade colors
  gradeA: string;
  gradeB: string;
  gradeC: string;
  gradeD: string;
  gradeF: string;

  // Border colors
  border: string;
  borderFocus: string;
}

export const darkTheme: Theme = {
  name: 'dark',

  primary: '#60a5fa', // blue-400
  secondary: '#a78bfa', // violet-400
  accent: '#34d399', // emerald-400

  text: '#f3f4f6', // gray-100
  textMuted: '#9ca3af', // gray-400
  textInverse: '#111827', // gray-900

  background: '#111827', // gray-900
  backgroundAlt: '#1f2937', // gray-800
  backgroundHighlight: '#374151', // gray-700

  success: '#34d399', // emerald-400
  warning: '#fbbf24', // amber-400
  error: '#f87171', // red-400
  info: '#60a5fa', // blue-400

  gradeA: '#34d399', // emerald-400
  gradeB: '#60a5fa', // blue-400
  gradeC: '#fbbf24', // amber-400
  gradeD: '#fb923c', // orange-400
  gradeF: '#f87171', // red-400

  border: '#374151', // gray-700
  borderFocus: '#60a5fa', // blue-400
};

export const lightTheme: Theme = {
  name: 'light',

  primary: '#2563eb', // blue-600
  secondary: '#7c3aed', // violet-600
  accent: '#059669', // emerald-600

  text: '#111827', // gray-900
  textMuted: '#6b7280', // gray-500
  textInverse: '#f9fafb', // gray-50

  background: '#ffffff',
  backgroundAlt: '#f3f4f6', // gray-100
  backgroundHighlight: '#e5e7eb', // gray-200

  success: '#059669', // emerald-600
  warning: '#d97706', // amber-600
  error: '#dc2626', // red-600
  info: '#2563eb', // blue-600

  gradeA: '#059669', // emerald-600
  gradeB: '#2563eb', // blue-600
  gradeC: '#d97706', // amber-600
  gradeD: '#ea580c', // orange-600
  gradeF: '#dc2626', // red-600

  border: '#d1d5db', // gray-300
  borderFocus: '#2563eb', // blue-600
};

export function getTheme(mode: 'dark' | 'light' | 'auto'): Theme {
  if (mode === 'auto') {
    // Check if terminal supports dark mode detection
    // For now, default to dark theme for CLI
    return darkTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
}

export function getGradeColor(
  grade: string,
  theme: Theme
): string {
  switch (grade) {
    case 'A':
      return theme.gradeA;
    case 'B':
      return theme.gradeB;
    case 'C':
      return theme.gradeC;
    case 'D':
      return theme.gradeD;
    case 'F':
      return theme.gradeF;
    default:
      return theme.textMuted;
  }
}
