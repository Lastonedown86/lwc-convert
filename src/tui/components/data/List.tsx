import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  rightContent?: string;
  disabled?: boolean;
}

export interface ListProps {
  items: ListItem[];
  selectedIndex?: number;
  onSelect?: (item: ListItem, index: number) => void;
  maxRows?: number;
  scrollOffset?: number;
  emptyMessage?: string;
  showIndex?: boolean;
}

export function List({
  items,
  selectedIndex = 0,
  maxRows,
  scrollOffset = 0,
  emptyMessage = 'No items',
  showIndex = false,
}: ListProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.textMuted}>{emptyMessage}</Text>
      </Box>
    );
  }

  // Get visible items
  const visibleItems = maxRows
    ? items.slice(scrollOffset, scrollOffset + maxRows)
    : items;

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, index) => {
        const actualIndex = scrollOffset + index;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box
            key={item.id}
            paddingX={1}
          >
            {/* Selection indicator */}
            <Text color={isSelected ? theme.accent : theme.textMuted}>
              {isSelected ? '▶ ' : '  '}
            </Text>

            {/* Index (optional) */}
            {showIndex && (
              <Text color={theme.textMuted}>
                {String(actualIndex + 1).padStart(2, ' ')}.
              </Text>
            )}

            {/* Icon (optional) */}
            {item.icon && (
              <Text color={item.disabled ? theme.textMuted : theme.text}>
                {item.icon}{' '}
              </Text>
            )}

            {/* Main content */}
            <Box flexGrow={1}>
              <Text
                color={item.disabled ? theme.textMuted : theme.text}
                dimColor={item.disabled}
              >
                {item.label}
              </Text>
              {item.description && (
                <Text color={theme.textMuted}> - {item.description}</Text>
              )}
            </Box>

            {/* Right content (optional) */}
            {item.rightContent && (
              <Text color={theme.textMuted}>{item.rightContent}</Text>
            )}
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {maxRows && items.length > maxRows && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.textMuted}>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxRows, items.length)} of{' '}
            {items.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface SelectableListProps extends Omit<ListProps, 'selectedIndex'> {
  selectedIds?: string[];
  onToggle?: (item: ListItem) => void;
  multiSelect?: boolean;
  focusedIndex?: number;
}

export function SelectableList({
  items,
  selectedIds = [],
  focusedIndex = 0,
  maxRows,
  scrollOffset = 0,
  emptyMessage = 'No items',
  multiSelect = false,
}: SelectableListProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  if (items.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.textMuted}>{emptyMessage}</Text>
      </Box>
    );
  }

  const visibleItems = maxRows
    ? items.slice(scrollOffset, scrollOffset + maxRows)
    : items;

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, index) => {
        const actualIndex = scrollOffset + index;
        const isFocused = actualIndex === focusedIndex;
        const isSelected = selectedIds.includes(item.id);

        return (
          <Box
            key={item.id}
            paddingX={1}
          >
            {/* Focus indicator */}
            <Text color={isFocused ? theme.accent : theme.textMuted}>
              {isFocused ? '▶ ' : '  '}
            </Text>

            {/* Selection checkbox */}
            <Text color={isSelected ? theme.success : theme.textMuted}>
              {multiSelect
                ? isSelected
                  ? '[✓] '
                  : '[ ] '
                : isSelected
                ? '(●) '
                : '( ) '}
            </Text>

            {/* Icon (optional) */}
            {item.icon && (
              <Text color={item.disabled ? theme.textMuted : theme.text}>
                {item.icon}{' '}
              </Text>
            )}

            {/* Label */}
            <Box flexGrow={1}>
              <Text
                color={item.disabled ? theme.textMuted : theme.text}
                dimColor={item.disabled}
              >
                {item.label}
              </Text>
              {item.description && (
                <Text color={theme.textMuted}> - {item.description}</Text>
              )}
            </Box>

            {/* Right content */}
            {item.rightContent && (
              <Text color={theme.textMuted}>{item.rightContent}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
