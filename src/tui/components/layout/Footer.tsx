import React from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { formatKeyBinding } from '../../hooks/useKeyBindings.js';
import type { KeyBinding } from '../../types.js';

export interface FooterProps {
  bindings?: KeyBinding[];
}

export function Footer({ bindings = [] }: FooterProps): React.ReactElement {
  const { columns } = useTerminalSize();
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Default bindings that are always shown
  const defaultBindings: KeyBinding[] = [
    { key: 'tab', action: () => {}, description: 'Navigate' },
    { key: 'escape', action: () => {}, description: 'Back' },
    { key: 'q', action: () => {}, description: 'Quit' },
  ];

  const allBindings = [...bindings, ...defaultBindings];

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border}
      width={columns}
      paddingX={1}
    >
      <Box width={columns - 4} justifyContent="flex-start" gap={2}>
        {allBindings.slice(0, 8).map((binding, index) => (
          <Text key={index}>
            <Text color={theme.accent}>[{formatKeyBinding(binding)}]</Text>
            <Text color={theme.textMuted}> {binding.description}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

export interface FooterHintProps {
  keyHint: string;
  description: string;
}

export function FooterHint({
  keyHint,
  description,
}: FooterHintProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Text>
      <Text color={theme.accent}>[{keyHint}]</Text>
      <Text color={theme.textMuted}> {description}</Text>
    </Text>
  );
}
