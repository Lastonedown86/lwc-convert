import React from 'react';
import { Box, Text } from 'ink';
import InkTextInput from 'ink-text-input';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';

export interface TextInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  mask?: string;
  showCursor?: boolean;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder = '',
  focus = true,
  mask,
  showCursor = true,
}: TextInputProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      {label && (
        <Text color={theme.text} bold>
          {label}
        </Text>
      )}
      <Box
        borderStyle="single"
        borderColor={focus ? theme.borderFocus : theme.border}
        paddingX={1}
      >
        <InkTextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          focus={focus}
          mask={mask}
          showCursor={showCursor}
        />
      </Box>
    </Box>
  );
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  focus = true,
}: SearchInputProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box>
      <Text color={theme.textMuted}>/</Text>
      <Box
        borderStyle="single"
        borderColor={focus ? theme.borderFocus : theme.border}
        paddingX={1}
        marginLeft={1}
      >
        <InkTextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          focus={focus}
          showCursor
        />
      </Box>
    </Box>
  );
}
