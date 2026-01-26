import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export interface SelectProps<T = string> {
  label?: string;
  options: SelectOption<T>[];
  value?: T;
  onSelect: (value: T) => void;
  isFocused?: boolean;
}

interface SelectItem<T> {
  label: string;
  value: T;
}

export function Select<T = string>({
  label,
  options,
  value,
  onSelect,
  isFocused = true,
}: SelectProps<T>): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const items: SelectItem<T>[] = options.map((opt) => ({
    label: opt.label,
    value: opt.value,
  }));

  const initialIndex = value !== undefined
    ? options.findIndex((opt) => opt.value === value)
    : 0;

  const handleSelect = (item: SelectItem<T>): void => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      {label && (
        <Text color={theme.text} bold>
          {label}
        </Text>
      )}
      <Box
        borderStyle="single"
        borderColor={isFocused ? theme.borderFocus : theme.border}
        paddingX={1}
        flexDirection="column"
      >
        <SelectInput
          items={items}
          initialIndex={initialIndex >= 0 ? initialIndex : 0}
          onSelect={handleSelect}
          isFocused={isFocused}
        />
      </Box>
    </Box>
  );
}
