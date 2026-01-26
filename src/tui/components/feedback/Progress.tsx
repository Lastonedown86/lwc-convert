import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface ProgressProps {
  value: number;
  max?: number;
  width?: number;
  showPercentage?: boolean;
  label?: string;
  color?: string;
}

export function Progress({
  value,
  max = 100,
  width = 30,
  showPercentage = true,
  label,
  color,
}: ProgressProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  const barColor = color ?? theme.primary;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return (
    <Box>
      {label && <Text color={theme.text}>{label} </Text>}
      <Text color={barColor}>{filled}</Text>
      <Text color={theme.textMuted}>{empty}</Text>
      {showPercentage && (
        <Text color={theme.textMuted}> {Math.round(percentage)}%</Text>
      )}
    </Box>
  );
}

export interface GradeDistributionProps {
  distribution: Record<string, number>;
  width?: number;
}

export function GradeDistribution({
  distribution,
  width = 50,
}: GradeDistributionProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <Text color={theme.textMuted}>No data</Text>;
  }

  const grades = ['A', 'B', 'C', 'D', 'F'] as const;
  const colors = [theme.gradeA, theme.gradeB, theme.gradeC, theme.gradeD, theme.gradeF];

  return (
    <Box flexDirection="column">
      <Box>
        {grades.map((grade, index) => {
          const count = distribution[grade] || 0;
          const barWidth = Math.max(Math.round((count / total) * width), count > 0 ? 1 : 0);
          return (
            <Text key={grade} color={preferences.showGradeColors ? colors[index] : theme.text}>
              {'█'.repeat(barWidth)}
            </Text>
          );
        })}
      </Box>
      <Box gap={2}>
        {grades.map((grade, index) => {
          const count = distribution[grade] || 0;
          return (
            <Text key={grade} color={preferences.showGradeColors ? colors[index] : theme.textMuted}>
              {grade}:{count}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
