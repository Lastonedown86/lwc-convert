import React from 'react';
import { Box, Text } from 'ink';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import type { KeyBinding } from '../../types.js';

export interface ScreenProps {
  title: string;
  children: React.ReactNode;
  footerBindings?: KeyBinding[];
  showHeader?: boolean;
  showFooter?: boolean;
}

export function Screen({
  title,
  children,
  footerBindings = [],
  showHeader = true,
  showFooter = true,
}: ScreenProps): React.ReactElement {
  const { columns, rows } = useTerminalSize();

  // Calculate available height for content (minus header and footer)
  const headerHeight = showHeader ? 3 : 0;
  const footerHeight = showFooter ? 3 : 0;
  const contentHeight = Math.max(1, rows - headerHeight - footerHeight);

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
    >
      {showHeader && <Header title={title} />}

      <Box
        flexDirection="column"
        height={contentHeight}
        paddingX={1}
        overflow="hidden"
      >
        {children}
      </Box>

      {showFooter && <Footer bindings={footerBindings} />}
    </Box>
  );
}
