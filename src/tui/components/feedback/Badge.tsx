import React from 'react';
import { Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme, getGradeColor } from '../../themes/index.js';
import type { GradeLevel } from '../../types.js';

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({
  label,
  variant = 'default',
}: BadgeProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  let color: string;
  switch (variant) {
    case 'success':
      color = theme.success;
      break;
    case 'warning':
      color = theme.warning;
      break;
    case 'error':
      color = theme.error;
      break;
    case 'info':
      color = theme.info;
      break;
    default:
      color = theme.textMuted;
  }

  return (
    <Text color={color} bold>
      [{label}]
    </Text>
  );
}

export interface GradeBadgeProps {
  grade: GradeLevel;
  showLabel?: boolean;
}

export function GradeBadge({
  grade,
  showLabel = true,
}: GradeBadgeProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const color = preferences.showGradeColors
    ? getGradeColor(grade, theme)
    : theme.text;

  return (
    <Text color={color} bold>
      {showLabel ? `[${grade}]` : grade}
    </Text>
  );
}

export interface ScoreBadgeProps {
  score: number;
  showGrade?: boolean;
}

export function ScoreBadge({
  score,
  showGrade = true,
}: ScoreBadgeProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const grade = scoreToGrade(score);
  const color = preferences.showGradeColors
    ? getGradeColor(grade, theme)
    : theme.text;

  return (
    <Text color={color}>
      {score}
      {showGrade && (
        <Text color={color} bold>
          {' '}
          ({grade})
        </Text>
      )}
    </Text>
  );
}

function scoreToGrade(score: number): GradeLevel {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
