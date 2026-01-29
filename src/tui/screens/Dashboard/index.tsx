import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../../components/layout/Screen.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { useKeyBindings } from '../../hooks/useKeyBindings.js';
import { isFirstTimeSync, markFirstTimeCompleteSync } from '../../../utils/first-time.js';
import type { KeyBinding, GradeLevel } from '../../types.js';
import { DashboardNav } from './DashboardNav.js';
import { DashboardDetail } from './DashboardDetail.js';
import { FirstTimeWelcome } from './FirstTimeWelcome.js';
import { createQuickActions, createProjectStats, createRecentItems } from './dashboardItems.js';
import { formatTimeAgo } from './utils.js';

export function Dashboard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const dashboard = useStore((state) => state.dashboard);
  const navigate = useStore((state) => state.navigate);
  const projectPath = useStore((state) => state.projectPath);
  const projectHealth = useStore((state) => state.projectHealth);
  const recentConversions = useStore((state) => state.recentConversions);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);
  const setComponents = useStore((state) => state.setComponents);
  const setProjectHealth = useStore((state) => state.setProjectHealth);
  const updateDashboardState = useStore((state) => state.updateDashboardState);
  const refreshProject = useStore((state) => state.refreshProject);

  const theme = getTheme(preferences.theme);

  // Start not loading if we already have data
  const hasData =
    auraComponents.length > 0 || vfComponents.length > 0 || projectHealth !== null;
  const [isInitialLoad, setIsInitialLoad] = useState(!hasData);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFirstTime, setShowFirstTime] = useState(isFirstTimeSync());

  // Discover components on mount or when refreshKey changes
  useEffect(() => {
    const loadComponents = async (): Promise<void> => {
      // Skip if we already have data and this is not a manual refresh
      if (hasData && refreshKey === 0) {
        setIsInitialLoad(false);
        return;
      }

      setIsInitialLoad(true);
      try {
        const { discoverComponents } = await import('../../utils/discovery.js');
        const discovered = await discoverComponents(projectPath);
        setComponents(discovered.aura, discovered.vf);
        setProjectHealth({
          auraCount: discovered.aura.length,
          vfCount: discovered.vf.length,
          avgScore: discovered.avgScore,
          avgGrade: discovered.avgGrade as GradeLevel,
          readyToConvert: discovered.aura.length + discovered.vf.length,
        });

        updateDashboardState({ lastRefresh: new Date() });
      } catch (error) {
        // Handle error silently, show empty state
      } finally {
        setIsInitialLoad(false);
      }
    };

    loadComponents();
  }, [projectPath, refreshKey]);

  // Build dashboard items from app state
  const quickActions = createQuickActions(
    navigate,
    auraComponents.length,
    vfComponents.length
  );
  const projectStats = createProjectStats(projectHealth);
  const recentItems = createRecentItems(recentConversions);

  // Flatten all items for navigation
  const allItems = [...quickActions, ...projectStats, ...recentItems];
  const currentItem = allItems[dashboard.selectedIndex] || null;

  const handleNavigate = (direction: 'up' | 'down'): void => {
    const newIndex =
      direction === 'up'
        ? Math.max(0, dashboard.selectedIndex - 1)
        : Math.min(allItems.length - 1, dashboard.selectedIndex + 1);
    updateDashboardState({ selectedIndex: newIndex });
  };

  const handleSelect = (): void => {
    if (!currentItem) return;

    if (currentItem.type === 'quick-action') {
      const action = currentItem as any;
      if (action.enabled && action.action) {
        action.action();
      }
    } else if (currentItem.type === 'recent-conversion') {
      // Future: Open folder or view details
    }
  };

  const handleRefresh = async (): Promise<void> => {
    await refreshProject();
  };

  const dismissFirstTime = (): void => {
    markFirstTimeCompleteSync();
    setShowFirstTime(false);
  };

  const footerBindings: KeyBinding[] = showFirstTime
    ? [{ key: 'return', action: dismissFirstTime, description: 'Continue' }]
    : [
        { key: 'up', action: () => handleNavigate('up'), description: 'Up' },
        { key: 'down', action: () => handleNavigate('down'), description: 'Down' },
        { key: 'return', action: handleSelect, description: 'Select' },
        { key: 'r', action: handleRefresh, description: 'Refresh' },
        // Quick shortcuts
        { key: 'c', action: () => navigate('wizard'), description: 'Convert' },
        { key: 'g', action: () => navigate('grading'), description: 'Grade' },
        { key: 'b', action: () => navigate('browser'), description: 'Browse' },
        { key: 's', action: () => navigate('settings'), description: 'Settings' },
      ];

  useKeyBindings(footerBindings);

  const projectName = projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Unknown Project';

  return (
    <Screen title="Dashboard" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* First-time welcome banner */}
        {showFirstTime && <FirstTimeWelcome onDismiss={dismissFirstTime} />}

        {/* Welcome message */}
        {!showFirstTime && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.text} bold>
              Welcome to LWC Convert
            </Text>
            <Text color={theme.textMuted}>Project: {projectName}</Text>
          </Box>
        )}

        {/* Two-panel layout */}
        {isInitialLoad ? (
          <Box height={10} justifyContent="center" alignItems="center">
            <Text color={theme.textMuted}>Scanning project for components...</Text>
          </Box>
        ) : (
          <Box flexDirection="row" gap={2} width="100%" alignItems="stretch">
            <DashboardNav
              quickActions={quickActions}
              projectStats={projectStats}
              recentItems={recentItems}
              selectedIndex={dashboard.selectedIndex}
              isRefreshing={dashboard.isRefreshing}
            />
            <DashboardDetail item={currentItem} projectHealth={projectHealth} />
          </Box>
        )}

        {/* Status bar */}
        {!isInitialLoad && !showFirstTime && (
          <Box marginTop={1} flexDirection="row" justifyContent="space-between">
            <Text color={theme.textMuted}>Navigate with arrow keys, press Enter to select</Text>
            {dashboard.lastRefresh && (
              <Text color={theme.textMuted}>
                Last refresh: {formatTimeAgo(dashboard.lastRefresh)}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Screen>
  );
}
