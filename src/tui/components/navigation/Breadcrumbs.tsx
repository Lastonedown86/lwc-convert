import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface BreadcrumbItem {
  label: string;
  active?: boolean;
  completed?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: string;
}

export function Breadcrumbs({
  items,
  separator = ' › ',
}: BreadcrumbsProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Text color={theme.textMuted}>{separator}</Text>}
          <Text
            color={
              item.active
                ? theme.primary
                : item.completed
                ? theme.success
                : theme.textMuted
            }
            bold={item.active}
          >
            {item.completed ? '✓ ' : ''}
            {item.label}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

export interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({
  steps,
  currentStep,
}: StepIndicatorProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <React.Fragment key={index}>
              {index > 0 && (
                <Text color={isCompleted ? theme.success : theme.textMuted}>
                  {' ─── '}
                </Text>
              )}
              <Box>
                <Text
                  color={
                    isActive
                      ? theme.primary
                      : isCompleted
                      ? theme.success
                      : theme.textMuted
                  }
                  bold={isActive}
                >
                  {isCompleted ? '[✓]' : isActive ? '[●]' : '[○]'}
                </Text>
                <Text
                  color={
                    isActive
                      ? theme.text
                      : isCompleted
                      ? theme.success
                      : theme.textMuted
                  }
                >
                  {' '}
                  {step}
                </Text>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>
      <Text color={theme.textMuted}>
        Step {currentStep + 1} of {steps.length}
      </Text>
    </Box>
  );
}
