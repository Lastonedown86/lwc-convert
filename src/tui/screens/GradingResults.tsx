import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { Table } from '../components/data/Table.js';
import { GradeDistribution, GradeBadge } from '../components/feedback/index.js';
import { useStore, useFilteredGradingResults, useGradeDistribution } from '../store/index.js';
import { getTheme, getGradeColor } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import { useVisibleRows } from '../hooks/useTerminalSize.js';
import type { KeyBinding, TableColumn, GradeLevel, GradingSortBy } from '../types.js';
import type { ComponentGrade } from '../../grading/types.js';

export function GradingResults(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const navigate = useStore((state) => state.navigate);
  const goBack = useStore((state) => state.goBack);
  const openModal = useStore((state) => state.openModal);
  const gradingSummary = useStore((state) => state.gradingSummary);
  const grading = useStore((state) => state.grading);
  const updateGradingState = useStore((state) => state.updateGradingState);

  const theme = getTheme(preferences.theme);
  const visibleRows = useVisibleRows(preferences.visibleRows);

  const filteredResults = useFilteredGradingResults();
  const distribution = useGradeDistribution();

  const columns: TableColumn<ComponentGrade>[] = [
    { key: 'componentName', header: 'Component', width: 25, align: 'left' },
    { key: 'componentType', header: 'Type', width: 8, align: 'left' },
    { key: 'overallScore', header: 'Score', width: 8, align: 'right' },
    {
      key: 'letterGrade',
      header: 'Grade',
      width: 8,
      align: 'center',
      render: (value) => value as string,
    },
    { key: 'complexity', header: 'Complexity', width: 15, align: 'left' },
  ];

  const sortOptions: GradingSortBy[] = ['score', 'name', 'complexity', 'type'];
  const gradeFilters: (GradeLevel | null)[] = [null, 'A', 'B', 'C', 'D', 'F'];

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: goBack, description: 'Back' },
    {
      key: 's',
      action: () => {
        const currentIndex = sortOptions.indexOf(grading.sortBy);
        updateGradingState({
          sortBy: sortOptions[(currentIndex + 1) % sortOptions.length],
        });
      },
      description: 'Sort',
    },
    {
      key: 'f',
      action: () => {
        const currentIndex = gradeFilters.indexOf(grading.filterGrade);
        updateGradingState({
          filterGrade: gradeFilters[(currentIndex + 1) % gradeFilters.length],
        });
      },
      description: 'Filter',
    },
    { key: 'e', action: () => openModal('export'), description: 'Export' },
    {
      key: 'return',
      action: () => {
        if (filteredResults[grading.selectedIndex]) {
          updateGradingState({ viewMode: 'detail' });
        }
      },
      description: 'Details',
    },
    {
      key: 'up',
      action: () => {
        const newIndex = Math.max(0, grading.selectedIndex - 1);
        updateGradingState({ selectedIndex: newIndex });
        // Adjust scroll if needed
        if (newIndex < grading.scrollOffset) {
          updateGradingState({ scrollOffset: newIndex });
        }
      },
      description: 'Up',
    },
    {
      key: 'down',
      action: () => {
        const newIndex = Math.min(filteredResults.length - 1, grading.selectedIndex + 1);
        updateGradingState({ selectedIndex: newIndex });
        // Adjust scroll if needed
        if (newIndex >= grading.scrollOffset + visibleRows) {
          updateGradingState({ scrollOffset: newIndex - visibleRows + 1 });
        }
      },
      description: 'Down',
    },
    {
      key: 'pageup',
      action: () => {
        const newIndex = Math.max(0, grading.selectedIndex - visibleRows);
        updateGradingState({
          selectedIndex: newIndex,
          scrollOffset: Math.max(0, grading.scrollOffset - visibleRows),
        });
      },
      description: 'Page Up',
    },
    {
      key: 'pagedown',
      action: () => {
        const newIndex = Math.min(
          filteredResults.length - 1,
          grading.selectedIndex + visibleRows
        );
        updateGradingState({
          selectedIndex: newIndex,
          scrollOffset: Math.min(
            Math.max(0, filteredResults.length - visibleRows),
            grading.scrollOffset + visibleRows
          ),
        });
      },
      description: 'Page Down',
    },
  ];

  useKeyBindings(footerBindings, { isActive: grading.viewMode === 'list' });

  if (grading.viewMode === 'detail') {
    return (
      <ComponentDetail
        component={filteredResults[grading.selectedIndex]}
        onBack={() => updateGradingState({ viewMode: 'list' })}
        onNext={() => {
          if (grading.selectedIndex < filteredResults.length - 1) {
            updateGradingState({ selectedIndex: grading.selectedIndex + 1 });
          }
        }}
        onPrev={() => {
          if (grading.selectedIndex > 0) {
            updateGradingState({ selectedIndex: grading.selectedIndex - 1 });
          }
        }}
      />
    );
  }

  return (
    <Screen title="Grading Results" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* Summary */}
        {gradingSummary && (
          <Box marginBottom={1}>
            <Text color={theme.text}>
              Summary: {gradingSummary.totalComponents} components │ Avg:{' '}
              {Math.round(gradingSummary.averageScore)} ({gradingSummary.averageGrade}) │
              Effort: ~{gradingSummary.totalEffort.manualHours.estimate}h
            </Text>
          </Box>
        )}

        {/* Grade Distribution */}
        <Box
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
          marginBottom={1}
        >
          <GradeDistribution distribution={distribution} width={50} />
        </Box>

        {/* Filter/Sort status */}
        <Box gap={2} marginBottom={1}>
          <Text color={theme.textMuted}>
            Sort: <Text color={theme.accent}>{grading.sortBy}</Text>
          </Text>
          <Text color={theme.textMuted}>
            Filter:{' '}
            <Text color={theme.accent}>
              {grading.filterGrade || 'All'}
            </Text>
          </Text>
        </Box>

        {/* Results table */}
        <Box
          borderStyle="single"
          borderColor={theme.border}
          flexDirection="column"
        >
          <Table
            data={filteredResults}
            columns={columns}
            selectedIndex={grading.selectedIndex}
            maxRows={visibleRows}
            scrollOffset={grading.scrollOffset}
            emptyMessage="No components match your filters"
            keyExtractor={(item) => item.filePath}
          />
        </Box>
      </Box>
    </Screen>
  );
}

interface ComponentDetailProps {
  component: ComponentGrade | undefined;
  onBack: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function ComponentDetail({
  component,
  onBack,
  onNext,
  onPrev,
}: ComponentDetailProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: onBack, description: 'Back to List' },
    { key: 'left', action: onPrev, description: 'Previous' },
    { key: 'right', action: onNext, description: 'Next' },
  ];

  useKeyBindings(footerBindings);

  if (!component) {
    return (
      <Screen title="Component Details" footerBindings={footerBindings}>
        <Text color={theme.textMuted}>No component selected</Text>
      </Screen>
    );
  }

  const gradeColor = getGradeColor(component.letterGrade, theme);

  return (
    <Screen title={`Details: ${component.componentName}`} footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        <Box gap={4}>
          {/* Score card */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.border}
            paddingX={2}
            paddingY={1}
            width={20}
          >
            <Text color={theme.text}>
              Score: <Text color={gradeColor} bold>{component.overallScore}</Text>
            </Text>
            <Text color={theme.text}>
              Grade: <Text color={gradeColor} bold>{component.letterGrade}</Text>
            </Text>
            <Text color={theme.text}>
              Complexity: {component.complexity}
            </Text>
            <Text color={theme.text}>
              Effort: {component.conversionEffort.manualHours.estimate}h
            </Text>
          </Box>

          {/* Complexity factors */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.border}
            paddingX={2}
            paddingY={1}
            flexGrow={1}
          >
            <Text color={theme.primary} bold>
              COMPLEXITY FACTORS
            </Text>
            <Box flexDirection="column" marginTop={1}>
              {component.complexityFactors.length > 0 ? (
                component.complexityFactors.slice(0, 8).map((factor, index) => (
                  <Text key={index} color={theme.text}>
                    <Text
                      color={
                        factor.impact === 'high'
                          ? theme.error
                          : factor.impact === 'medium'
                          ? theme.warning
                          : theme.info
                      }
                    >
                      [{factor.impact.toUpperCase()}]
                    </Text>{' '}
                    {factor.description}
                  </Text>
                ))
              ) : (
                <Text color={theme.textMuted}>No complexity factors identified</Text>
              )}
            </Box>
          </Box>
        </Box>

        {/* Category breakdown */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
          marginTop={1}
        >
          <Text color={theme.primary} bold>
            CATEGORY BREAKDOWN
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {component.categoryScores && Object.entries(component.categoryScores).map(
              ([category, categoryScore]) => {
                const width = 30;
                const filled = Math.round((categoryScore.score / 100) * width);
                return (
                  <Box key={category}>
                    <Text color={theme.text}>
                      {category.padEnd(12)}
                    </Text>
                    <Text color={theme.primary}>
                      {'█'.repeat(filled)}
                    </Text>
                    <Text color={theme.textMuted}>
                      {'░'.repeat(width - filled)}
                    </Text>
                    <Text color={theme.textMuted}> {categoryScore.score}%</Text>
                  </Box>
                );
              }
            )}
          </Box>
        </Box>

        {/* Recommendations */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
          marginTop={1}
        >
          <Text color={theme.primary} bold>
            RECOMMENDATIONS
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {component.recommendations && component.recommendations.length > 0 ? (
              component.recommendations.map((rec, index) => (
                <Text key={index} color={theme.text}>
                  {index + 1}. {rec}
                </Text>
              ))
            ) : (
              <Text color={theme.textMuted}>No specific recommendations</Text>
            )}
          </Box>
        </Box>
      </Box>
    </Screen>
  );
}
