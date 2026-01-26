import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import Fuse from 'fuse.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { TextInput } from '../forms/TextInput.js';
import { useKeyBindings } from '../../hooks/useKeyBindings.js';
import type { ScreenType } from '../../types.js';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}

export interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
  onExecute?: (command: Command) => void;
}

export function CommandPalette({
  commands,
  onClose,
  onExecute,
}: CommandPaletteProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Set up fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['label', 'category'],
        threshold: 0.4,
      }),
    [commands]
  );

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    return fuse.search(query).map((result) => result.item);
  }, [query, fuse, commands]);

  // Clamp selected index
  const clampedIndex = Math.min(selectedIndex, filteredCommands.length - 1);

  // Handle keyboard navigation
  useKeyBindings([
    {
      key: 'escape',
      action: onClose,
      description: 'Close',
    },
    {
      key: 'up',
      action: () => setSelectedIndex(Math.max(0, clampedIndex - 1)),
      description: 'Previous',
    },
    {
      key: 'down',
      action: () =>
        setSelectedIndex(Math.min(filteredCommands.length - 1, clampedIndex + 1)),
      description: 'Next',
    },
    {
      key: 'return',
      action: () => {
        if (filteredCommands[clampedIndex]) {
          onExecute?.(filteredCommands[clampedIndex]);
          filteredCommands[clampedIndex].action();
          onClose();
        }
      },
      description: 'Execute',
    },
  ]);

  const maxVisibleCommands = 8;
  const visibleCommands = filteredCommands.slice(0, maxVisibleCommands);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.borderFocus}
      paddingX={1}
      paddingY={0}
      width={60}
    >
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={theme.accent}>{'>'}</Text>
        <Box marginLeft={1} flexGrow={1}>
          <TextInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command..."
            focus
          />
        </Box>
      </Box>

      {/* Command list */}
      {visibleCommands.length === 0 ? (
        <Text color={theme.textMuted}>No commands found</Text>
      ) : (
        visibleCommands.map((command, index) => {
          const isSelected = index === clampedIndex;
          return (
            <Box
              key={command.id}
              paddingX={1}
            >
              <Box flexGrow={1}>
                <Text color={isSelected ? theme.text : theme.text}>
                  {command.label}
                </Text>
              </Box>
              {command.shortcut && (
                <Text color={theme.textMuted}>{command.shortcut}</Text>
              )}
            </Box>
          );
        })
      )}

      {/* More indicator */}
      {filteredCommands.length > maxVisibleCommands && (
        <Text color={theme.textMuted}>
          ... and {filteredCommands.length - maxVisibleCommands} more
        </Text>
      )}
    </Box>
  );
}

export function useDefaultCommands(): Command[] {
  const navigate = useStore((state) => state.navigate);
  const openModal = useStore((state) => state.openModal);

  return [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      action: () => navigate('dashboard'),
    },
    {
      id: 'browser',
      label: 'Open Component Browser',
      shortcut: 'B',
      category: 'Navigation',
      action: () => navigate('browser'),
    },
    {
      id: 'grading',
      label: 'View Grading Results',
      shortcut: 'G',
      category: 'Navigation',
      action: () => navigate('grading'),
    },
    {
      id: 'wizard',
      label: 'Start Conversion Wizard',
      shortcut: 'C',
      category: 'Actions',
      action: () => navigate('wizard'),
    },
    {
      id: 'settings',
      label: 'Open Settings',
      shortcut: 'S',
      category: 'Navigation',
      action: () => navigate('settings'),
    },
    {
      id: 'export',
      label: 'Export Results',
      shortcut: 'E',
      category: 'Actions',
      action: () => openModal('export'),
    },
    {
      id: 'help',
      label: 'Show Help',
      shortcut: '?',
      category: 'Help',
      action: () => openModal('help'),
    },
  ];
}
