import React from 'react';
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
  keyExtractor = (_item, index) => String(index),
}: TableProps<T>): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  if (data.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.textMuted}>{emptyMessage}</Text>
      </Box>
    );
  }

  // Calculate column widths
  const columnWidths = columns.map((col) => {
    if (typeof col.width === 'number') return col.width;

    // Auto-calculate width based on content
    let maxWidth = col.header.length;
    for (const item of data) {
      const value = getColumnValue(item, col);
      const rendered = col.render ? col.render(value, item) : String(value ?? '');
      maxWidth = Math.max(maxWidth, rendered.length);
    }
    return Math.min(maxWidth + 2, 30); // Cap at 30 chars
  });

  // Get visible rows
  const visibleData = maxRows
    ? data.slice(scrollOffset, scrollOffset + maxRows)
    : data;

  return (
    <Box flexDirection="column">
      {/* Header */}
      {showHeader && (
        <Box borderStyle="single" borderBottom borderColor={theme.border}>
          {columns.map((col, colIndex) => (
            <Box key={col.key as string} width={columnWidths[colIndex]} paddingX={1}>
              <Text color={theme.textMuted} bold>
                {alignText(col.header, columnWidths[colIndex] - 2, col.align || 'left')}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Rows */}
      {visibleData.map((item, rowIndex) => {
        const actualIndex = scrollOffset + rowIndex;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box
            key={keyExtractor(item, actualIndex)}
          >
            {isSelected && (
              <Text color={theme.accent}>▶</Text>
            )}
            {!isSelected && (
              <Text> </Text>
            )}
            {columns.map((col, colIndex) => {
              const value = getColumnValue(item, col);
              const rendered = col.render ? col.render(value, item) : String(value ?? '');

              return (
                <Box key={col.key as string} width={columnWidths[colIndex]} paddingX={1}>
                  <Text color={isSelected ? theme.text : theme.text}>
                    {alignText(rendered, columnWidths[colIndex] - 2, col.align || 'left')}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {maxRows && data.length > maxRows && (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxRows, data.length)} of{' '}
            {data.length}
          </Text>
        </Box>
      )}
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
