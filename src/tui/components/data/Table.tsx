import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import type { TableColumn } from '../../types.js';

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  selectedIndex?: number;
  onSelect?: (item: T, index: number) => void;
  maxRows?: number;
  scrollOffset?: number;
  emptyMessage?: string;
  showHeader?: boolean;
  keyExtractor?: (item: T, index: number) => string;
}

export function Table<T>({
  data,
  columns,
  selectedIndex = -1,
  maxRows,
  scrollOffset = 0,
  emptyMessage = 'No data',
  showHeader = true,
}: TableProps<T>): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Memoize column widths calculation
  const columnWidths = useMemo(() => {
    return columns.map((col) => {
      if (typeof col.width === 'number') return col.width;

      let maxWidth = col.header.length;
      for (const item of data) {
        const value = getColumnValue(item, col);
        const rendered = col.render ? col.render(value, item) : String(value ?? '');
        maxWidth = Math.max(maxWidth, rendered.length);
      }
      return Math.min(maxWidth + 2, 30);
    });
  }, [data, columns]);

  if (data.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.textMuted}>{emptyMessage}</Text>
      </Box>
    );
  }

  // Get visible rows
  const visibleData = maxRows
    ? data.slice(scrollOffset, scrollOffset + maxRows)
    : data;

  // Build header line
  const headerLine = '  ' + columns.map((col, colIndex) => 
    alignText(col.header, columnWidths[colIndex], col.align || 'left')
  ).join('');

  // Build entire table as single string with ANSI color codes
  const accentCode = getAnsiColor(theme.accent);
  const textCode = getAnsiColor(theme.text);
  const resetCode = '\x1b[0m';

  const tableLines = visibleData.map((item, rowIndex) => {
    const actualIndex = scrollOffset + rowIndex;
    const isSelected = actualIndex === selectedIndex;
    const selectorChar = isSelected ? '▶ ' : '  ';
    
    const rowContent = columns.map((col, colIndex) => {
      const value = getColumnValue(item, col);
      const rendered = col.render ? col.render(value, item) : String(value ?? '');
      return alignText(rendered, columnWidths[colIndex], col.align || 'left');
    }).join('');

    const colorCode = isSelected ? accentCode : textCode;
    return `${colorCode}${selectorChar}${rowContent}${resetCode}`;
  }).join('\n');

  return (
    <Box flexDirection="column">
      {showHeader && (
        <Box borderStyle="single" borderBottom borderColor={theme.border}>
          <Text color={theme.textMuted} bold>{headerLine}</Text>
        </Box>
      )}

      <Text>{tableLines}</Text>
    </Box>
  );
}

function getColumnValue<T>(item: T, column: TableColumn<T>): unknown {
  const key = column.key as keyof T;
  if (key in (item as object)) {
    return item[key];
  }
  return undefined;
}

function alignText(text: string, width: number, align: 'left' | 'center' | 'right'): string {
  const truncated = text.length > width ? text.slice(0, width - 1) + '…' : text;
  const padding = width - truncated.length;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + truncated;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);
    default:
      return truncated + ' '.repeat(padding);
  }
}

// Convert color name/hex to ANSI escape code
function getAnsiColor(color: string): string {
  const colorMap: Record<string, string> = {
    // Basic colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    grey: '\x1b[90m',
    // Bright colors
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',
  };

  if (colorMap[color]) {
    return colorMap[color];
  }

  // Handle hex colors - convert to closest ANSI 256 color
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `\x1b[38;2;${r};${g};${b}m`;
  }

  return '\x1b[37m'; // Default to white
}
