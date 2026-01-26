import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface SpinnerProps {
  label?: string;
  type?: 'dots' | 'line' | 'arc' | 'circle';
}

export function Spinner({
  label = 'Loading...',
  type = 'dots',
}: SpinnerProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box>
      <Text color={theme.primary}>
        <InkSpinner type={type} />
      </Text>
      <Text color={theme.text}> {label}</Text>
    </Box>
  );
}
