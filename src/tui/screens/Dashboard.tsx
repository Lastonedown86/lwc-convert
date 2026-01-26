import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { GradeDistribution, Spinner } from '../components/feedback/index.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import { discoverComponents } from '../utils/discovery.js';
import type { KeyBinding, GradeLevel } from '../types.js';

export function Dashboard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const navigate = useStore((state) => state.navigate);
  const projectPath = useStore((state) => state.projectPath);
  const projectHealth = useStore((state) => state.projectHealth);
  const recentConversions = useStore((state) => state.recentConversions);
  const setComponents = useStore((state) => state.setComponents);
  const setProjectHealth = useStore((state) => state.setProjectHealth);

  const theme = getTheme(preferences.theme);
  const [isLoading, setIsLoading] = useState(true);

  // Discover components on mount
  useEffect(() => {
    const loadComponents = async (): Promise<void> => {
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
  }, [projectPath, setComponents, setProjectHealth]);

  const footerBindings: KeyBinding[] = [
    { key: 'c', action: () => navigate('wizard'), description: 'Convert' },
    { key: 'g', action: () => navigate('grading'), description: 'Grade' },
    { key: 'b', action: () => navigate('browser'), description: 'Browse' },
    { key: 's', action: () => navigate('settings'), description: 'Settings' },
  ];

  useKeyBindings(footerBindings);

  const projectName = projectPath.split('/').pop() || 'Unknown Project';

  return (
    <Screen title="Dashboard" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* Welcome message */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.text} bold>
            Welcome to LWC Convert
          </Text>
          <Text color={theme.textMuted}>Project: {projectName}</Text>
        </Box>

        {isLoading ? (
          <Spinner label="Scanning project for components..." />
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
                Quick Actions
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[C]</Text> Convert Component
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[G]</Text> Grade Complexity
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[B]</Text> Browse Components
                </Text>
                <Text color={theme.text}>
                  <Text color={theme.accent}>[S]</Text> Settings
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
                Project Health
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {projectHealth ? (
                  <>
                    <Text color={theme.text}>
                      Aura: {projectHealth.auraCount} components
                    </Text>
                    <Text color={theme.text}>
                      VF: {projectHealth.vfCount} pages
                    </Text>
                    <Text color={theme.text}>
                      Avg Grade: {projectHealth.avgGrade} ({projectHealth.avgScore})
                    </Text>
                    <Text color={theme.text}>
                      Ready: {projectHealth.readyToConvert}
                    </Text>
                  </>
                ) : (
                  <Text color={theme.textMuted}>No components found</Text>
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
            Tip: Press <Text color={theme.accent}>Ctrl+K</Text> to open the command palette
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
