import React from 'react';
import { Box, Text } from 'ink';
import { Modal } from '../components/layout/Modal.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';

interface KeyboardShortcut {
  key: string;
  description: string;
  context?: string;
}

const globalShortcuts: KeyboardShortcut[] = [
  { key: '?', description: 'Show this help' },
  { key: 'S', description: 'Open Settings' },
  { key: '/', description: 'Command Palette' },
  { key: 'Esc', description: 'Go back / Close modal' },
  { key: 'Q', description: 'Quit application' },
  { key: 'Tab', description: 'Next focusable element' },
];

const screenShortcuts: KeyboardShortcut[] = [
  { key: 'C', description: 'Start conversion wizard', context: 'Dashboard' },
  { key: 'G', description: 'Open grading results', context: 'Dashboard' },
  { key: 'B', description: 'Open component browser', context: 'Dashboard' },
  { key: '/', description: 'Search', context: 'Browser/Grading' },
  { key: 'F', description: 'Toggle filter', context: 'Browser/Grading' },
  { key: 'E', description: 'Export results', context: 'Grading' },
  { key: 'Enter', description: 'Select / Open details', context: 'Lists' },
  { key: '↑/↓', description: 'Navigate list', context: 'Lists' },
  { key: 'PgUp/PgDn', description: 'Page scroll', context: 'Lists' },
];

export function HelpModal(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const closeModal = useStore((state) => state.closeModal);

  const theme = getTheme(preferences.theme);

  useKeyBindings([
    { key: 'escape', action: closeModal, description: 'Close' },
    { key: '?', action: closeModal, description: 'Close' },
  ]);

  return (
    <Modal title="Help" onClose={closeModal} width={60}>
      <Box flexDirection="column">
        {/* Global shortcuts */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.primary} bold>
            Global Shortcuts
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {globalShortcuts.map((shortcut, index) => (
              <Box key={index}>
                <Box width={12}>
                  <Text color={theme.accent}>{shortcut.key}</Text>
                </Box>
                <Text color={theme.text}>{shortcut.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Screen-specific shortcuts */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.primary} bold>
            Screen Shortcuts
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {screenShortcuts.map((shortcut, index) => (
              <Box key={index}>
                <Box width={12}>
                  <Text color={theme.accent}>{shortcut.key}</Text>
                </Box>
                <Box width={25}>
                  <Text color={theme.text}>{shortcut.description}</Text>
                </Box>
                {shortcut.context && (
                  <Text color={theme.textMuted}>({shortcut.context})</Text>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Tips */}
        <Box flexDirection="column">
          <Text color={theme.primary} bold>
            Tips
          </Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.textMuted}>
              • Use Ctrl+K to quickly access any command
            </Text>
            <Text color={theme.textMuted}>
              • Settings are saved automatically
            </Text>
            <Text color={theme.textMuted}>
              • Press / to search in any list view
            </Text>
          </Box>
        </Box>

        <Box marginTop={1} justifyContent="center">
          <Text color={theme.textMuted}>Press Esc or ? to close</Text>
        </Box>
      </Box>
    </Modal>
  );
}
