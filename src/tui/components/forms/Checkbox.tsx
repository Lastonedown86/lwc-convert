import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isFocused?: boolean;
  disabled?: boolean;
}

export function Checkbox({
  label,
  checked,
  isFocused = false,
  disabled = false,
}: CheckboxProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const checkboxColor = disabled
    ? theme.textMuted
    : checked
    ? theme.success
    : theme.textMuted;

  const arrowColor = isFocused ? theme.accent : theme.background;

  return (
    <Box>
      <Text color={arrowColor}>{'▶ '}</Text>
      <Text color={checkboxColor}>{checked ? '[✓]' : '[ ]'}</Text>
      <Text
        color={disabled ? theme.textMuted : theme.text}
        dimColor={disabled}
      >
        {' '}
        {label}
      </Text>
    </Box>
  );
}

export interface RadioProps {
  label: string;
  selected: boolean;
  isFocused?: boolean;
  disabled?: boolean;
}

export function Radio({
  label,
  selected,
  isFocused = false,
  disabled = false,
}: RadioProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  const radioColor = disabled
    ? theme.textMuted
    : selected
    ? theme.primary
    : theme.textMuted;

  const arrowColor = isFocused ? theme.accent : theme.background;

  return (
    <Box>
      <Text color={arrowColor}>{'▶ '}</Text>
      <Text color={radioColor}>{selected ? '(●)' : '( )'}</Text>
      <Text
        color={disabled ? theme.textMuted : theme.text}
        dimColor={disabled}
      >
        {' '}
        {label}
      </Text>
    </Box>
  );
}

export interface RadioGroupProps<T = string> {
  label?: string;
  options: Array<{ label: string; value: T; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
  focusedIndex?: number;
}

export function RadioGroup<T = string>({
  label,
  options,
  value,
  focusedIndex = -1,
}: RadioGroupProps<T>): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={1}>
          <Text color={theme.text} bold>
            {label}
          </Text>
        </Box>
      )}
      {options.map((option, index) => (
        <Radio
          key={index}
          label={option.label}
          selected={option.value === value}
          isFocused={index === focusedIndex}
          disabled={option.disabled}
        />
      ))}
    </Box>
  );
}

export interface CheckboxGroupProps {
  label?: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  values: string[];
  onChange: (values: string[]) => void;
  focusedIndex?: number;
}

export function CheckboxGroup({
  label,
  options,
  values,
  focusedIndex = -1,
}: CheckboxGroupProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={1}>
          <Text color={theme.text} bold>
            {label}
          </Text>
        </Box>
      )}
      {options.map((option, index) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={values.includes(option.value)}
          onChange={() => {}}
          isFocused={index === focusedIndex}
          disabled={option.disabled}
        />
      ))}
    </Box>
  );
}
