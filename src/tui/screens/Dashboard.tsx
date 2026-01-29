import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { GradeDistribution, Spinner } from '../components/feedback/index.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import { discoverComponents } from '../utils/discovery.js';
import { isFirstTimeSync, markFirstTimeCompleteSync, getWelcomeContent } from '../../utils/first-time.js';
import type { KeyBinding, GradeLevel } from '../types.js';

// Helper to pad text to fixed width to prevent Ink rendering artifacts
const padText = (text: string, width: number): string => {
  return text.padEnd(width, ' ');
};

export function Dashboard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const navigate = useStore((state) => state.navigate);
  const projectPath = useStore((state) => state.projectPath);
  const projectHealth = useStore((state) => state.projectHealth);
  const recentConversions = useStore((state) => state.recentConversions);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);
  const setComponents = useStore((state) => state.setComponents);
  const setProjectHealth = useStore((state) => state.setProjectHealth);

  const theme = getTheme(preferences.theme);
  // Start not loading if we already have data
  const hasData = auraComponents.length > 0 || vfComponents.length > 0 || projectHealth !== null;
  const [isLoading, setIsLoading] = useState(!hasData);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFirstTime, setShowFirstTime] = useState(isFirstTimeSync());

  // Discover components on mount or when refreshKey changes
  useEffect(() => {
    const loadComponents = async (): Promise<void> => {
      // Skip if we already have data and this is not a manual refresh
      if (hasData && refreshKey === 0) {
        return;
      }

      setIsLoading(true);
      try {
        const discovered = await discoverComponents(projectPath);
        setComponents(discovered.aura, discovered.vf);
        setProjectHealth({
          auraCount: discovered.aura.length,
          vfCount: discovered.vf.length,
          avgScore: discovered.avgScore,
          avgGrade: discovered.avgGrade as GradeLevel,
          readyToConvert: discovered.aura.length + discovered.vf.length,
        });
      } catch (error) {
        // Handle error silently, show empty state
      } finally {
        setIsLoading(false);
      }
    };

    loadComponents();
  }, [projectPath, refreshKey]);

  const refresh = (): void => {
    setRefreshKey((prev) => prev + 1);
  };

  const dismissFirstTime = (): void => {
    markFirstTimeCompleteSync();
    setShowFirstTime(false);
  };

  const footerBindings: KeyBinding[] = showFirstTime
    ? [{ key: 'return', action: dismissFirstTime, description: 'Continue' }]
    : [
        { key: 'c', action: () => navigate('wizard'), description: 'Convert' },
        { key: 'g', action: () => navigate('grading'), description: 'Grade' },
        { key: 'b', action: () => navigate('browser'), description: 'Browse' },
        { key: 's', action: () => navigate('settings'), description: 'Settings' },
        { key: 'r', action: refresh, description: 'Refresh' },
      ];

  useKeyBindings(footerBindings);

  const projectName = projectPath.split('/').pop() || 'Unknown Project';

  // Fixed width for text content inside 30-char wide boxes (minus padding/borders)
  const textWidth = 24;

  // Get welcome content for first-time users
  const welcomeContent = showFirstTime ? getWelcomeContent() : null;

  return (
    <Screen title="Dashboard" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* First-time welcome banner */}
        {showFirstTime && welcomeContent && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={theme.accent}
            paddingX={2}
            paddingY={1}
            marginBottom={1}
          >
            <Text color={theme.accent} bold>
              🎉 {welcomeContent.title}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {welcomeContent.workflows.map((workflow, idx) => (
                <Box key={idx} marginBottom={idx < welcomeContent.workflows.length - 1 ? 1 : 0}>
                  <Text>
                    <Text color={theme.primary}>{workflow.icon}</Text>
                    {' '}
                    <Text bold>{workflow.name}</Text>
                    <Text color={theme.textMuted}> - {workflow.description}</Text>
                  </Text>
                </Box>
              ))}
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text color={theme.textMuted} dimColor>Quick tips:</Text>
              {welcomeContent.tips.slice(0, 2).map((tip, idx) => (
                <Text key={idx} color={theme.textMuted}> • {tip}</Text>
              ))}
            </Box>
            <Box marginTop={1}>
              <Text color={theme.textMuted}>
                Press any key to continue...
              </Text>
            </Box>
          </Box>
        )}

        {/* Welcome message */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.text} bold>
            {padText('Welcome to LWC Convert', 40)}
          </Text>
          <Text color={theme.textMuted}>{padText(`Project: ${projectName}`, 40)}</Text>
        </Box>

        {isLoading ? (
          <Box height={10}>
            <Spinner label="Scanning project for components..." />
          </Box>
        ) : (
          <Box flexDirection="row" gap={4}>
            {/* Quick Actions */}
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor={theme.border}
              paddingX={2}
              paddingY={1}
              width={30}
            >
              <Text color={theme.primary} bold>
                {padText('Quick Actions', textWidth)}
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[C]</Text>{padText(' Convert Component', textWidth - 3)}
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[G]</Text>{padText(' Grade Complexity', textWidth - 3)}
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[B]</Text>{padText(' Browse Components', textWidth - 3)}
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[S]</Text>{padText(' Settings', textWidth - 3)}
                </Text>
              </Box>
            </Box>

            {/* Project Health */}
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor={theme.border}
              paddingX={2}
              paddingY={1}
              width={30}
            >
              <Text color={theme.primary} bold>
                {padText('Project Health', textWidth)}
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {projectHealth ? (
                  <Box flexDirection="column">
                    <Text color={theme.text}>
                      {padText(`Aura: ${projectHealth.auraCount}`, textWidth)}
                    </Text>
                    <Text color={theme.text}>
                      {padText(`VF: ${projectHealth.vfCount}`, textWidth)}
                    </Text>
                    <Text color={theme.text}>
                      {padText(`Grade: ${projectHealth.avgGrade} (${projectHealth.avgScore})`, textWidth)}
                    </Text>
                    <Text color={theme.text}>
                      {padText(`Ready: ${projectHealth.readyToConvert}`, textWidth)}
                    </Text>
                  </Box>
                ) : (
                  <Text color={theme.textMuted}>{padText('No components found', textWidth)}</Text>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Recent Conversions */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
          marginTop={1}
        >
          <Text color={theme.primary} bold>
            Recent Conversions
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {recentConversions.length > 0 ? (
              recentConversions.slice(0, 5).map((conversion, index) => (
                <Box key={index} gap={2}>
                  <Text color={theme.text} bold>
                    {conversion.name}
                  </Text>
                  <Text color={theme.textMuted}>
                    {conversion.type.toUpperCase()} → LWC
                  </Text>
                  <Text color={theme.textMuted}>
                    {formatTimeAgo(conversion.timestamp)}
                  </Text>
                  <Text color={conversion.success ? theme.success : theme.error}>
                    {conversion.success ? '✓' : '✗'}
                  </Text>
                </Box>
              ))
            ) : (
              <Text color={theme.textMuted}>No recent conversions</Text>
            )}
          </Box>
        </Box>

        {/* Tip */}
        <Box marginTop={1}>
          <Text color={theme.textMuted}>
            Tip: Press <Text color={theme.accent}>/</Text> to open the command palette
          </Text>
        </Box>
      </Box>
    </Screen>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
