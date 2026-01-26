import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { Checkbox, Radio } from '../components/forms/Checkbox.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import type { KeyBinding, UserPreferences, ThemeMode, ConversionMode } from '../types.js';

interface SettingItem {
  id: keyof UserPreferences;
  label: string;
  type: 'boolean' | 'radio' | 'number';
  options?: Array<{ label: string; value: string }>;
  category: string;
}

const settingItems: SettingItem[] = [
  // Defaults
  {
    id: 'defaultConversionMode',
    label: 'Default Conversion Mode',
    type: 'radio',
    options: [
      { label: 'Scaffolding', value: 'scaffolding' },
      { label: 'Full', value: 'full' },
    ],
    category: 'Defaults',
  },
  {
    id: 'autoOpenFolder',
    label: 'Auto-open Output Folder',
    type: 'boolean',
    category: 'Defaults',
  },
  {
    id: 'generatePreview',
    label: 'Generate UI Preview',
    type: 'boolean',
    category: 'Defaults',
  },
  {
    id: 'generateTests',
    label: 'Generate Jest Tests',
    type: 'boolean',
    category: 'Defaults',
  },
  // Display
  {
    id: 'theme',
    label: 'Theme',
    type: 'radio',
    options: [
      { label: 'Auto', value: 'auto' },
      { label: 'Dark', value: 'dark' },
      { label: 'Light', value: 'light' },
    ],
    category: 'Display',
  },
  {
    id: 'showGradeColors',
    label: 'Show Grade Colors',
    type: 'boolean',
    category: 'Display',
  },
  {
    id: 'confirmBeforeActions',
    label: 'Confirm Before Actions',
    type: 'boolean',
    category: 'Display',
  },
  // Session
  {
    id: 'rememberLastProject',
    label: 'Remember Last Project',
    type: 'boolean',
    category: 'Session',
  },
];

export function Settings(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const goBack = useStore((state) => state.goBack);

  const theme = getTheme(preferences.theme);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: goBack, description: 'Back' },
    {
      key: 'return',
      action: () => toggleCurrentSetting(),
      description: 'Toggle',
    },
    {
      key: 'up',
      action: () => setFocusedIndex(Math.max(0, focusedIndex - 1)),
      description: 'Up',
    },
    {
      key: 'down',
      action: () =>
        setFocusedIndex(Math.min(settingItems.length - 1, focusedIndex + 1)),
      description: 'Down',
    },
  ];

  useKeyBindings(footerBindings);

  const toggleCurrentSetting = async (): Promise<void> => {
    const setting = settingItems[focusedIndex];
    if (!setting) return;

    if (setting.type === 'boolean') {
      const currentValue = preferences[setting.id] as boolean;
      await updatePreferences({ [setting.id]: !currentValue });
    } else if (setting.type === 'radio' && setting.options) {
      const currentValue = preferences[setting.id] as string;
      const currentIndex = setting.options.findIndex(
        (opt) => opt.value === currentValue
      );
      const nextIndex = (currentIndex + 1) % setting.options.length;
      await updatePreferences({
        [setting.id]: setting.options[nextIndex].value,
      });
    }
  };

  // Group settings by category
  const categories = [...new Set(settingItems.map((s) => s.category))];

  let globalIndex = 0;

  return (
    <Screen title="Settings" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {categories.map((category) => {
          const categorySettings = settingItems.filter(
            (s) => s.category === category
          );

          return (
            <Box
              key={category}
              flexDirection="column"
              marginBottom={1}
              borderStyle="single"
              borderColor={theme.border}
              paddingX={2}
              paddingY={1}
            >
              <Text color={theme.primary} bold>
                {category.toUpperCase()}
              </Text>
              <Box flexDirection="column" marginTop={1}>
                {categorySettings.map((setting) => {
                  const currentGlobalIndex = globalIndex++;
                  const isFocused = currentGlobalIndex === focusedIndex;
                  const value = preferences[setting.id];

                  if (setting.type === 'boolean') {
                    return (
                      <Checkbox
                        key={setting.id}
                        label={setting.label}
                        checked={value as boolean}
                        onChange={() => {}}
                        isFocused={isFocused}
                      />
                    );
                  }

                  if (setting.type === 'radio' && setting.options) {
                    const currentOption = setting.options.find(
                      (opt) => opt.value === value
                    );
                    return (
                      <Box key={setting.id}>
                        <Text color={isFocused ? theme.accent : theme.textMuted}>
                          {isFocused ? '▶ ' : '  '}
                        </Text>
                        <Text color={theme.text}>{setting.label}: </Text>
                        <Text color={theme.primary} bold>
                          {currentOption?.label || String(value)}
                        </Text>
                        <Text color={theme.textMuted}> (Enter to cycle)</Text>
                      </Box>
                    );
                  }

                  return null;
                })}
              </Box>
            </Box>
          );
        })}

        {/* Actions */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
        >
          <Text color={theme.primary} bold>
            ACTIONS
          </Text>
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.textMuted}>
              Press <Text color={theme.accent}>[↑↓]</Text> to navigate,{' '}
              <Text color={theme.accent}>[Enter]</Text> to toggle
            </Text>
            <Text color={theme.textMuted}>
              Changes are saved automatically
            </Text>
          </Box>
        </Box>
      </Box>
    </Screen>
  );
}
