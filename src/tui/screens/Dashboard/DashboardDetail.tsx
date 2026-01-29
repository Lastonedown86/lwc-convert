import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../../themes/index.js';
import { useStore } from '../../store/index.js';
import { Badge, GradeBadge } from '../../components/feedback/Badge.js';
import { GradeDistribution } from '../../components/feedback/Progress.js';

import type { ProjectHealth } from '../../types.js';
import type { DashboardItem, QuickActionItem, ProjectStatItem, RecentConversionItem } from './types.js';
import { formatDetailedTime } from './utils.js';

export interface DashboardDetailProps {
  item: DashboardItem | null;
  projectHealth: ProjectHealth | null;
}

export function DashboardDetail({
  item,
  projectHealth,
}: DashboardDetailProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const gradingResults = useStore((state) => state.gradingResults);
  const theme = getTheme(preferences.theme);

  if (!item) {
    return (
      <Box width={72} height={30} flexDirection="column" paddingX={1}>
        <Box flexDirection="column">
          <Text color={theme.textMuted}>Select an item to view details</Text>
        </Box>
      </Box>
    );
  }

  // Render based on item type
  if (item.type === 'quick-action') {
    return <QuickActionDetail item={item as QuickActionItem} />;
  } else if (item.type === 'project-stat') {
    return (
      <ProjectStatDetail
        item={item as ProjectStatItem}
        projectHealth={projectHealth}
        gradingResults={gradingResults}
      />
    );
  } else if (item.type === 'recent-conversion') {
    return <RecentConversionDetail item={item as RecentConversionItem} />;
  }

  return null;
}

function QuickActionDetail({ item }: { item: QuickActionItem }): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box width={72} height={30} flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        {/* Header */}
        <Box flexDirection="row" gap={1}>
          <Text color={theme.primary} bold>
            {item.icon} {item.label}
          </Text>
          {!item.enabled && <Badge label="Disabled" variant="warning" />}
        </Box>

        {/* Description */}
        <Box marginTop={1}>
          <Text color={theme.text} wrap="wrap">{item.detailedDescription}</Text>
        </Box>

        {/* What this does */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.primary} bold>
            What this does:
          </Text>
          {item.steps.map((step, index) => (
            <Text key={index} color={theme.text}>
              {' '}
              • {step}
            </Text>
          ))}
        </Box>

        {/* Keyboard shortcuts */}
        <Box marginTop={2}>
          <Text color={theme.textMuted}>
            <Text color={theme.accent}>[Enter]</Text> Launch{' '}
            <Text color={theme.accent}>[{item.shortcut}]</Text> Quick shortcut
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function ProjectStatDetail({
  item,
  projectHealth,
  gradingResults,
}: {
  item: ProjectStatItem;
  projectHealth: ProjectHealth | null;
  gradingResults: any[];
}): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box width={72} height={30} flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        {/* Header */}
        <Text color={theme.primary} bold>
          {item.icon} {item.label}
        </Text>

        {/* Description */}
        <Box marginTop={1}>
          <Text color={theme.text} wrap="wrap">{item.description}</Text>
        </Box>

        {/* Current value */}
        <Box marginTop={1}>
          <Text color={theme.text}>
            Current: <Text bold>{item.value}</Text>
          </Text>
        </Box>

        {/* Detail breakdown */}
        {item.detailLabel && (
          <Box marginTop={1}>
            <Text color={theme.textMuted}>{item.detailLabel}</Text>
          </Box>
        )}

        {/* Project Health Overview - show when any project stat is selected */}
        {projectHealth && (
          <Box flexDirection="column" marginTop={2}>
            <Text color={theme.primary} bold>
              Project Overview:
            </Text>

            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text}>
                Total Components: <Text bold>{projectHealth.auraCount + projectHealth.vfCount}</Text>
              </Text>
              <Box marginLeft={2}>
                <Text color={theme.textMuted}>Aura: {projectHealth.auraCount}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color={theme.textMuted}>Visualforce: {projectHealth.vfCount}</Text>
              </Box>
            </Box>

            <Box marginTop={1}>
              <Text color={theme.text}>Average Complexity: </Text>
              <GradeBadge grade={projectHealth.avgGrade} />
              <Text color={theme.text}> ({projectHealth.avgScore}/100)</Text>
            </Box>

            {/* Grade Distribution Chart */}
            {gradingResults.length > 0 && (
              <Box marginTop={1}>
                <GradeDistribution results={gradingResults} />
              </Box>
            )}
          </Box>
        )}

        {/* Quick action */}
        <Box marginTop={2}>
          <Text color={theme.textMuted}>
            <Text color={theme.accent}>[G]</Text> View detailed grading report
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function RecentConversionDetail({
  item,
}: {
  item: RecentConversionItem;
}): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box width={72} height={30} flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        {/* Header */}
        <Box flexDirection="row" gap={1}>
          <Text color={theme.primary} bold>
            {item.componentName}
          </Text>
          <Badge variant={item.success ? 'success' : 'error'}>
            {item.success ? 'Success' : 'Failed'}
          </Badge>
        </Box>

        {/* Type */}
        <Box marginTop={1}>
          <Text color={theme.text}>
            Type: <Text color={theme.textMuted}>{item.componentType.toUpperCase()} → LWC</Text>
          </Text>
        </Box>

        {/* Timestamp */}
        <Box marginTop={1}>
          <Text color={theme.text}>
            Converted: <Text color={theme.textMuted}>{formatDetailedTime(item.timestamp)}</Text>
          </Text>
        </Box>

        {/* Grade */}
        {item.grade && item.score !== undefined && (
          <Box marginTop={1}>
            <Text color={theme.text}>Complexity: </Text>
            <GradeBadge grade={item.grade} />
            <Text color={theme.text}> ({item.score}/100)</Text>
          </Box>
        )}

        {/* Actions */}
        <Box flexDirection="column" marginTop={2}>
          <Text color={theme.primary} bold>
            Available Actions:
          </Text>
          <Text color={theme.text}> • View in file explorer</Text>
          <Text color={theme.text}> • Re-run conversion</Text>
          {!item.success && <Text color={theme.text}> • View error logs</Text>}
        </Box>

        {/* Keyboard shortcuts */}
        <Box marginTop={2}>
          <Text color={theme.textMuted}>
            <Text color={theme.accent}>[Enter]</Text> View details{' '}
            <Text color={theme.accent}>[O]</Text> Open folder
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
