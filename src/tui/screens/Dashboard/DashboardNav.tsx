import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../../themes/index.js';
import { useStore } from '../../store/index.js';

import type { QuickActionItem, ProjectStatItem, RecentConversionItem } from './types.js';
import { formatTimeAgo, padText } from './utils.js';
import { Spinner } from '../../components/feedback/Spinner.js';

export interface DashboardNavProps {
  quickActions: QuickActionItem[];
  projectStats: ProjectStatItem[];
  recentItems: RecentConversionItem[];
  selectedIndex: number;
  isRefreshing: boolean;
}

export function DashboardNav({
  quickActions,
  projectStats,
  recentItems,
  selectedIndex,
  isRefreshing,
}: DashboardNavProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Flatten all items for navigation
  const allItems = [...quickActions, ...projectStats, ...recentItems];
  const textWidth = 30;

  let globalIndex = 0;

  return (
    <Box width={37} height={30} flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        {/* Header */}
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={theme.primary} bold>
            {padText('DASHBOARD', textWidth)}
          </Text>
          {isRefreshing && <Spinner />}
        </Box>

        {/* Quick Start Section */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.textMuted} bold>
            QUICK START
          </Text>
          {quickActions.map((action) => {
            const currentIndex = globalIndex++;
            const isFocused = currentIndex === selectedIndex;
            const arrowColor = isFocused ? theme.accent : theme.background;

            return (
              <Box key={action.id} marginLeft={1}>
                <Text color={arrowColor}>▶ </Text>
                <Text
                  color={
                    action.enabled
                      ? isFocused
                        ? theme.text
                        : theme.textMuted
                      : theme.textMuted
                  }
                  dimColor={!action.enabled}
                >
                  {action.label}
                </Text>
                <Text color={theme.accent}> [{action.shortcut}]</Text>
              </Box>
            );
          })}
        </Box>

        {/* Project Health Section */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.textMuted} bold>
            PROJECT HEALTH
          </Text>
          {projectStats.map((stat) => {
            const currentIndex = globalIndex++;
            const isFocused = currentIndex === selectedIndex;
            const arrowColor = isFocused ? theme.accent : theme.background;

            // Get color for stat value
            let valueColor = theme.text;
            if (stat.color === 'success') {
              valueColor = theme.success;
            } else if (stat.color === 'textMuted') {
              valueColor = theme.textMuted;
            }

            return (
              <Box key={stat.id} marginLeft={1}>
                <Text color={arrowColor}>▶ </Text>
                <Text color={isFocused ? theme.text : theme.textMuted}>
                  {stat.icon} {stat.label}:{' '}
                </Text>
                <Text color={valueColor} bold>
                  {stat.value}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Recent Conversions Section */}
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.textMuted} bold>
            RECENT ({recentItems.length})
          </Text>
          {recentItems.length > 0 ? (
            recentItems.map((item) => {
              const currentIndex = globalIndex++;
              const isFocused = currentIndex === selectedIndex;
              const arrowColor = isFocused ? theme.accent : theme.background;

              return (
                <Box key={item.id} marginLeft={1}>
                  <Text color={arrowColor}>▶ </Text>
                  <Text color={item.success ? theme.success : theme.error}>
                    {item.icon}{' '}
                  </Text>
                  <Text color={isFocused ? theme.text : theme.textMuted}>
                    {item.componentName}
                  </Text>
                  <Text color={theme.textMuted}> {formatTimeAgo(item.timestamp)}</Text>
                </Box>
              );
            })
          ) : (
            <Box marginLeft={1}>
              <Text color={theme.textMuted}>No recent conversions</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
