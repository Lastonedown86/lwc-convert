import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../../themes/index.js';
import { useStore } from '../../store/index.js';
import { Checkbox, RadioGroup } from '../../components/forms/Checkbox.js';
import type { SettingDefinition } from './settingDefinitions.js';
import { isModified } from './settingDefinitions.js';

export interface SettingDetailProps {
  setting: SettingDefinition;
  currentValue: unknown;
  onToggle: () => void;
  onReset: () => void;
}

export function SettingDetail({
  setting,
  currentValue,
}: SettingDetailProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);
  const modified = isModified(preferences, setting.id);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      paddingY={1}
    >
      {/* Header */}
      <Box flexDirection="row" gap={1}>
        <Text color={theme.primary} bold>
          {setting.label}
        </Text>
        {modified && (
          <Text color={theme.warning} bold>
            ●
          </Text>
        )}
      </Box>

      {/* Description */}
      <Box marginTop={1}>
        <Text color={theme.textMuted}>{setting.description}</Text>
      </Box>

      {/* Current vs Default */}
      <Box flexDirection="column" marginTop={1} gap={0}>
        <Box>
          <Text color={theme.textMuted}>Current: </Text>
          {setting.type === 'boolean' ? (
            <Text color={currentValue ? theme.success : theme.textMuted}>
              {currentValue ? '✓ Enabled' : '  Disabled'}
            </Text>
          ) : (
            <Text color={theme.text}>
              {setting.options?.find(opt => opt.value === currentValue)?.label || String(currentValue)}
            </Text>
          )}
        </Box>
        <Box>
          <Text color={theme.textMuted}>Default: </Text>
          {setting.type === 'boolean' ? (
            <Text color={theme.textMuted}>
              {setting.defaultValue ? '✓ Enabled' : '  Disabled'}
            </Text>
          ) : (
            <Text color={theme.textMuted}>
              {setting.options?.find(opt => opt.value === setting.defaultValue)?.label || String(setting.defaultValue)}
            </Text>
          )}
        </Box>
      </Box>

      {/* Control */}
      <Box flexDirection="column" marginTop={2}>
        {setting.type === 'boolean' ? (
          <Checkbox
            label="Enable this setting"
            checked={currentValue as boolean}
            onChange={() => { }}
            isFocused={true}
          />
        ) : setting.type === 'radio' && setting.options ? (
          <>
            <RadioGroup
              options={setting.options.map(opt => ({
                label: opt.label,
                value: opt.value,
              }))}
              value={currentValue as string}
              onChange={() => { }}
              focusedIndex={-1}
            />

            {/* Show hint for selected option */}
            {setting.options.find(opt => opt.value === currentValue)?.hint && (
              <Box marginTop={1}>
                <Text color={theme.textMuted} italic>
                  {setting.options.find(opt => opt.value === currentValue)?.hint}
                </Text>
              </Box>
            )}
          </>
        ) : null}
      </Box>

      {/* Keyboard shortcuts */}
      <Box marginTop={2}>
        <Text color={theme.textMuted}>
          {setting.type === 'boolean' ? (
            <>
              <Text color={theme.accent}>[Enter]</Text> Toggle  <Text color={theme.accent}>[R]</Text> Reset
            </>
          ) : (
            <>
              <Text color={theme.accent}>[Enter]</Text> Cycle  <Text color={theme.accent}>[R]</Text> Reset
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}
