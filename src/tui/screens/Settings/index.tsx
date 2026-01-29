import React from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../../components/layout/Screen.js';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import { useKeyBindings } from '../../hooks/useKeyBindings.js';
import type { KeyBinding } from '../../types.js';
import { SettingsList } from './SettingsList.js';
import { SettingDetail } from './SettingDetail.js';
import { settingDefinitions } from './settingDefinitions.js';

export function Settings(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const settings = useStore((state) => state.settings);
  const updatePreferences = useStore((state) => state.updatePreferences);
  const updateSettingsState = useStore((state) => state.updateSettingsState);
  const resetSetting = useStore((state) => state.resetSetting);
  const goBack = useStore((state) => state.goBack);

  const theme = getTheme(preferences.theme);
  const currentSetting = settingDefinitions[settings.selectedIndex];

  const handleNavigate = (direction: 'up' | 'down'): void => {
    const newIndex =
      direction === 'up'
        ? Math.max(0, settings.selectedIndex - 1)
        : Math.min(settingDefinitions.length - 1, settings.selectedIndex + 1);
    updateSettingsState({ selectedIndex: newIndex });
  };

  const handleToggle = async (): Promise<void> => {
    if (!currentSetting) return;

    if (currentSetting.type === 'boolean') {
      await updatePreferences({
        [currentSetting.id]: !preferences[currentSetting.id],
      });
    } else if (currentSetting.type === 'radio' && currentSetting.options) {
      // Cycle through options
      const currentIndex = currentSetting.options.findIndex(
        (opt) => opt.value === preferences[currentSetting.id]
      );
      const nextIndex = (currentIndex + 1) % currentSetting.options.length;
      await updatePreferences({
        [currentSetting.id]: currentSetting.options[nextIndex].value,
      });
    }
  };

  const handleReset = async (): Promise<void> => {
    if (!currentSetting) return;
    await resetSetting(currentSetting.id);
  };

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: goBack, description: 'Back' },
    {
      key: 'up',
      action: () => handleNavigate('up'),
      description: 'Up',
    },
    {
      key: 'down',
      action: () => handleNavigate('down'),
      description: 'Down',
    },
    { key: 'return', action: handleToggle, description: 'Toggle' },
    { key: 'r', action: handleReset, description: 'Reset' },
  ];

  useKeyBindings(footerBindings);

  if (!currentSetting) {
    return (
      <Screen title="Settings" footerBindings={footerBindings}>
        <Box paddingY={1}>
          <Text color={theme.error}>No settings available</Text>
        </Box>
      </Screen>
    );
  }

  return (
    <Screen title="Settings" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* Two-panel layout */}
        <Box flexDirection="row" gap={2}>
          <SettingsList
            settings={settingDefinitions}
            selectedIndex={settings.selectedIndex}
            currentValues={preferences}
          />
          <SettingDetail
            setting={currentSetting}
            currentValue={preferences[currentSetting.id]}
            onToggle={handleToggle}
            onReset={handleReset}
          />
        </Box>

        {/* Auto-save notice */}
        <Box marginTop={1}>
          <Text color={theme.textMuted}>
            Changes saved automatically
          </Text>
        </Box>
      </Box>
    </Screen>
  );
}
