import React from 'react';
import { Box } from 'ink';
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
  const { rows, columns } = useTerminalSize();

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
    >
      {showHeader && <Header title={title} />}

      <Box
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
      >
        {children}
      </Box>

      {showFooter && <Footer bindings={footerBindings} />}
    </Box>
  );
}
