import React from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { CLI_VERSION } from '../../../cli/options.js';

export interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps): React.ReactElement {
  const { columns } = useTerminalSize();
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const appName = 'LWC Convert';
  const version = `v${CLI_VERSION}`;
  const helpText = '[?] Help  [S] Settings';

  // Calculate spacing
  const leftContent = `  ${appName}`;
  const centerContent = title;
  const rightContent = `${helpText}  `;

  const totalContentLength =
    leftContent.length + centerContent.length + rightContent.length;
  const availableSpace = columns - totalContentLength;

  const leftPad = Math.floor(availableSpace / 2);
  const rightPad = availableSpace - leftPad;

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border}
      paddingX={0}
      width={columns}
    >
      <Box width={columns - 2} justifyContent="space-between">
        <Text color={theme.primary} bold>
          {appName}{' '}
          <Text color={theme.textMuted} dimColor>
            {version}
          </Text>
        </Text>

        <Text color={theme.text} bold>
          {title}
        </Text>

        <Text color={theme.textMuted}>{helpText}</Text>
      </Box>
    </Box>
  );
}
