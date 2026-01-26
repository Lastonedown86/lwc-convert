/**
 * Tests for TUI Themes
 */

import { getTheme, getGradeColor, darkTheme, lightTheme, Theme } from '../../../src/tui/themes/index';
import type { ThemeMode, GradeLevel } from '../../../src/tui/types';

describe('Theme Selection', () => {
  it('should return dark theme for "dark" mode', () => {
    const theme = getTheme('dark');
    expect(theme).toEqual(darkTheme);
  });

  it('should return light theme for "light" mode', () => {
    const theme = getTheme('light');
    expect(theme).toEqual(lightTheme);
  });

  it('should return a theme for "auto" mode', () => {
    const theme = getTheme('auto');
    // Auto returns dark or light based on system preference
    // In tests, it should still return a valid theme
    expect(theme).toBeDefined();
    expect(theme.primary).toBeDefined();
    expect(theme.text).toBeDefined();
  });

  it('should return a theme for unknown mode', () => {
    const theme = getTheme('unknown' as ThemeMode);
    // Unknown mode falls through to light theme in the current implementation
    expect(theme).toBeDefined();
    expect(theme.primary).toBeDefined();
  });
});

describe('Dark Theme', () => {
  it('should have all required color properties', () => {
    expect(darkTheme.primary).toBeDefined();
    expect(darkTheme.secondary).toBeDefined();
    expect(darkTheme.accent).toBeDefined();
    expect(darkTheme.text).toBeDefined();
    expect(darkTheme.textMuted).toBeDefined();
    expect(darkTheme.border).toBeDefined();
    expect(darkTheme.borderFocus).toBeDefined();
    expect(darkTheme.success).toBeDefined();
    expect(darkTheme.warning).toBeDefined();
    expect(darkTheme.error).toBeDefined();
    expect(darkTheme.info).toBeDefined();
  });

  it('should have grade colors', () => {
    expect(darkTheme.gradeA).toBeDefined();
    expect(darkTheme.gradeB).toBeDefined();
    expect(darkTheme.gradeC).toBeDefined();
    expect(darkTheme.gradeD).toBeDefined();
    expect(darkTheme.gradeF).toBeDefined();
  });
});

describe('Light Theme', () => {
  it('should have all required color properties', () => {
    expect(lightTheme.primary).toBeDefined();
    expect(lightTheme.secondary).toBeDefined();
    expect(lightTheme.accent).toBeDefined();
    expect(lightTheme.text).toBeDefined();
    expect(lightTheme.textMuted).toBeDefined();
    expect(lightTheme.border).toBeDefined();
    expect(lightTheme.borderFocus).toBeDefined();
    expect(lightTheme.success).toBeDefined();
    expect(lightTheme.warning).toBeDefined();
    expect(lightTheme.error).toBeDefined();
    expect(lightTheme.info).toBeDefined();
  });

  it('should have grade colors', () => {
    expect(lightTheme.gradeA).toBeDefined();
    expect(lightTheme.gradeB).toBeDefined();
    expect(lightTheme.gradeC).toBeDefined();
    expect(lightTheme.gradeD).toBeDefined();
    expect(lightTheme.gradeF).toBeDefined();
  });
});

describe('Grade Colors', () => {
  it('should return correct color for grade A', () => {
    const color = getGradeColor('A', darkTheme);
    expect(color).toBe(darkTheme.gradeA);
  });

  it('should return correct color for grade B', () => {
    const color = getGradeColor('B', darkTheme);
    expect(color).toBe(darkTheme.gradeB);
  });

  it('should return correct color for grade C', () => {
    const color = getGradeColor('C', darkTheme);
    expect(color).toBe(darkTheme.gradeC);
  });

  it('should return correct color for grade D', () => {
    const color = getGradeColor('D', darkTheme);
    expect(color).toBe(darkTheme.gradeD);
  });

  it('should return correct color for grade F', () => {
    const color = getGradeColor('F', darkTheme);
    expect(color).toBe(darkTheme.gradeF);
  });

  it('should return textMuted color for unknown grade', () => {
    const color = getGradeColor('X' as GradeLevel, darkTheme);
    expect(color).toBe(darkTheme.textMuted);
  });

  it('should work with light theme', () => {
    const colorA = getGradeColor('A', lightTheme);
    const colorF = getGradeColor('F', lightTheme);

    expect(colorA).toBe(lightTheme.gradeA);
    expect(colorF).toBe(lightTheme.gradeF);
  });
});

describe('Theme Consistency', () => {
  it('should have different text colors between themes', () => {
    // Dark and light themes should have contrasting text colors
    expect(darkTheme.text).not.toBe(lightTheme.text);
  });

  it('should have consistent grade semantics', () => {
    // Grade A should always be "good" (typically green-ish)
    // Grade F should always be "bad" (typically red-ish)
    // We just verify they exist and are different
    expect(darkTheme.gradeA).not.toBe(darkTheme.gradeF);
    expect(lightTheme.gradeA).not.toBe(lightTheme.gradeF);
  });
});
