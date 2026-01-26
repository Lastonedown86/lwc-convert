import React from 'react';
import { Box, useApp } from 'ink';
import { useStore, useCurrentModal } from './store/index.js';
import { useKeyBindings } from './hooks/useKeyBindings.js';
import { CommandPalette, useDefaultCommands } from './components/navigation/CommandPalette.js';
import {
  Dashboard,
  Settings,
  ComponentBrowser,
  GradingResults,
  ConversionWizard,
  ExportModal,
  HelpModal,
} from './screens/index.js';
import type { KeyBinding } from './types.js';

export function App(): React.ReactElement {
  const { exit } = useApp();

  const currentScreen = useStore((state) => state.currentScreen);
  const navigate = useStore((state) => state.navigate);
  const goBack = useStore((state) => state.goBack);
  const openModal = useStore((state) => state.openModal);
  const closeModal = useStore((state) => state.closeModal);
  const currentModal = useCurrentModal();

  const commands = useDefaultCommands();

  // Global keyboard shortcuts
  const globalBindings: KeyBinding[] = [
    {
      key: 'q',
      action: () => exit(),
      description: 'Quit',
      global: true,
    },
    {
      key: '?',
      action: () => openModal('help'),
      description: 'Help',
      global: true,
    },
    {
      key: 's',
      shift: true,
      action: () => navigate('settings'),
      description: 'Settings',
      global: true,
    },
    {
      key: '/',
      action: () => openModal('command-palette'),
      description: 'Command Palette',
      global: true,
    },
  ];

  useKeyBindings(globalBindings, { isActive: !currentModal });

  // Render current screen
  const renderScreen = (): React.ReactElement => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'settings':
        return <Settings />;
      case 'browser':
        return <ComponentBrowser />;
      case 'grading':
        return <GradingResults />;
      case 'wizard':
        return <ConversionWizard />;
      default:
        return <Dashboard />;
    }
  };

  // Render current modal
  const renderModal = (): React.ReactElement | null => {
    switch (currentModal) {
      case 'help':
        return <HelpModal />;
      case 'export':
        return <ExportModal />;
      case 'command-palette':
        return (
          <CommandPalette
            commands={commands}
            onClose={closeModal}
          />
        );
      default:
        return null;
    }
  };

  // If command palette is open, render it centered instead of the screen
  if (currentModal === 'command-palette') {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="flex-start" paddingTop={3}>
        {renderModal()}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {renderScreen()}
      {currentModal && renderModal()}
    </Box>
  );
}
