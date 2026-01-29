import React from 'react';
import { Box, Text } from 'ink';
import { getTheme } from '../../themes/index.js';
import { useStore } from '../../store/index.js';
import { Badge } from '../../components/feedback/Badge.js';
import type { UserPreferences } from '../../types.js';
import type { SettingDefinition } from './settingDefinitions.js';
import { getCategories, isModified } from './settingDefinitions.js';

export interface SettingsListProps {
  settings: SettingDefinition[];
  selectedIndex: number;
  currentValues: UserPreferences;
}

export function SettingsList({
  settings,
  selectedIndex,
  currentValues,
}: SettingsListProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);
  const categories = getCategories();

  let globalIndex = 0;

  return (
    <Box flexDirection="column" width={32} paddingX={1} paddingY={1}>
      <Text color={theme.primary} bold>
        SETTINGS
      </Text>

      {categories.map((category) => {
        const categorySettings = settings.filter((s) => s.category === category.name);

        return (
          <Box key={category.name} flexDirection="column" marginTop={1}>
            <Text color={theme.textMuted} bold>
              {category.name.toUpperCase()} ({category.count})
            </Text>

            {categorySettings.map((setting) => {
              const currentGlobalIndex = globalIndex++;
              const isFocused = currentGlobalIndex === selectedIndex;
              const value = currentValues[setting.id];
              const modified = isModified(currentValues, setting.id);

              const arrowColor = isFocused ? theme.accent : theme.background;

              return (
                <Box key={setting.id} marginLeft={1}>
                  <Text color={arrowColor}>▶ </Text>
                  <Text color={isFocused ? theme.text : theme.textMuted}>
                    {setting.label}
                  </Text>

                  {/* Modified indicator */}
                  {modified && (
                    <Text color={theme.warning}> ●</Text>
                  )}

                  {/* Value preview */}
                  {setting.type === 'boolean' && value && (
                    <Text color={theme.success}> ✓</Text>
                  )}
                  {setting.type === 'radio' && (
                    <Text color={theme.textMuted}>
                      {' '}[{setting.options?.find(opt => opt.value === value)?.label || String(value)}]
                    </Text>
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
