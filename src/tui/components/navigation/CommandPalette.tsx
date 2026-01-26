import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Fuse from 'fuse.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
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
  const clampedIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1));

  // Handle all input directly since we have a text input
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, clampedIndex - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(filteredCommands.length - 1, clampedIndex + 1));
      return;
    }
    if (key.return) {
      if (filteredCommands[clampedIndex]) {
        onExecute?.(filteredCommands[clampedIndex]);
        filteredCommands[clampedIndex].action();
        onClose();
      }
      return;
    }
    if (key.backspace) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

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
          <Text color={query ? theme.text : theme.textMuted}>
            {query || 'Type a command...'}
          </Text>
          <Text color={theme.accent}>▌</Text>
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
              <Text color={isSelected ? theme.accent : theme.textMuted}>
                {isSelected ? '▸ ' : '  '}
              </Text>
              <Box flexGrow={1}>
                <Text color={isSelected ? theme.text : theme.textMuted} bold={isSelected}>
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
