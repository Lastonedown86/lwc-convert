import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../../themes/index.js';
import { useStore } from '../../store/index.js';

interface WelcomeWorkflow {
  icon: string;
  name: string;
  description: string;
}

interface WelcomeContent {
  title: string;
  workflows: WelcomeWorkflow[];
  tips: string[];
}

export interface FirstTimeWelcomeProps {
  onDismiss: () => void;
}

export function FirstTimeWelcome({ onDismiss }: FirstTimeWelcomeProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const welcomeContent: WelcomeContent = {
    title: 'Welcome to LWC Convert!',
    workflows: [
      {
        icon: '⚡',
        name: 'Convert',
        description: 'Transform Aura/VF components to LWC',
      },
      {
        icon: '📊',
        name: 'Grade',
        description: 'Analyze component complexity',
      },
      {
        icon: '📦',
        name: 'Browse',
        description: 'Explore your components',
      },
      {
        icon: '⚙️',
        name: 'Settings',
        description: 'Customize your preferences',
      },
    ],
    tips: [
      'Use arrow keys to navigate the dashboard',
      'Press [C] to quickly start a conversion',
      'Press [?] for help anytime',
    ],
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
      width="100%"
    >
      <Box flexDirection="column" width="100%">
        <Text color={theme.accent} bold>
          🎉 {welcomeContent.title}
        </Text>
        <Box marginTop={1} flexDirection="column">
          {welcomeContent.workflows.map((workflow, idx) => (
            <Box
              key={idx}
              marginBottom={idx < welcomeContent.workflows.length - 1 ? 1 : 0}
            >
              <Text>
                <Text color={theme.primary}>{workflow.icon}</Text> <Text bold>{workflow.name}</Text>
                <Text color={theme.textMuted}> - {workflow.description}</Text>
              </Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.textMuted} dimColor>
            Quick tips:
          </Text>
          {welcomeContent.tips.slice(0, 2).map((tip, idx) => (
            <Text key={idx} color={theme.textMuted}>
              {' '}
              • {tip}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.textMuted}>Press any key to continue...</Text>
        </Box>
      </Box>
    </Box>
  );
}
