import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface BorderedPanelProps {
  children: React.ReactNode;
  width: number;
  height: number;
  title?: string;
}

/**
 * A panel with manually rendered borders using box-drawing characters.
 * This ensures consistent border alignment regardless of content.
 */
export function BorderedPanel({
  children,
  width,
  height,
  title,
}: BorderedPanelProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Box drawing characters
  const horizontalLine = '─'; // U+2500
  const verticalLine = '│';   // U+2502
  const topLeft = '┌';        // U+250C
  const topRight = '┐';       // U+2510
  const bottomLeft = '└';     // U+2514
  const bottomRight = '┘';    // U+2518

  // Calculate dimensions (accounting for border characters)
  const innerWidth = width - 2; // -2 for left and right border characters
  const innerHeight = height - 2; // -2 for top and bottom borders

  // Create top border line (should be exactly `width` characters total)
  const topBorder = topLeft + horizontalLine.repeat(Math.max(0, innerWidth)) + topRight;

  // Create bottom border line (should be exactly `width` characters total)
  const bottomBorder = bottomLeft + horizontalLine.repeat(Math.max(0, innerWidth)) + bottomRight;

  return (
    <Box flexDirection="column" width={width} height={height} flexShrink={0}>
      {/* Top border */}
      <Box flexShrink={0}>
        <Text color={theme.border}>{topBorder}</Text>
      </Box>

      {/* Content area with side borders */}
      <Box height={innerHeight} flexShrink={0} flexDirection="row">
        <Box flexShrink={0}>
          <Text color={theme.border}>{verticalLine}</Text>
        </Box>
        <Box width={innerWidth} flexGrow={0} flexShrink={0}>
          <Box height={innerHeight} overflow="hidden" paddingX={1}>
            {children}
          </Box>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.border}>{verticalLine}</Text>
        </Box>
      </Box>

      {/* Bottom border */}
      <Box flexShrink={0}>
        <Text color={theme.border}>{bottomBorder}</Text>
      </Box>
    </Box>
  );
}
