import React from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { useKeyBindings } from '../../hooks/useKeyBindings.js';

export interface ModalProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  onClose?: () => void;
  footer?: React.ReactNode;
}

export function Modal({
  title,
  children,
  width = 50,
  onClose,
  footer,
}: ModalProps): React.ReactElement {
  const { columns, rows } = useTerminalSize();
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Handle escape key to close
  useKeyBindings([
    {
      key: 'escape',
      action: () => onClose?.(),
      description: 'Close',
    },
  ]);

  const modalWidth = Math.min(width, columns - 4);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={columns}
      height={rows}
    >
      <Box
        flexDirection="column"
        width={modalWidth}
        borderStyle="double"
        borderColor={theme.borderFocus}
        paddingX={1}
        paddingY={0}
      >
        {/* Modal Header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color={theme.text} bold>
            {title}
          </Text>
          {onClose && (
            <Text color={theme.textMuted}>[X] Close</Text>
          )}
        </Box>

        {/* Modal Content */}
        <Box flexDirection="column">{children}</Box>

        {/* Modal Footer */}
        {footer && (
          <Box marginTop={1} justifyContent="flex-end">
            {footer}
          </Box>
        )}
      </Box>
    </Box>
  );
}
