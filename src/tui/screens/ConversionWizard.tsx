import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { StepIndicator } from '../components/navigation/Breadcrumbs.js';
import { RadioGroup } from '../components/forms/Checkbox.js';
import { TextInput } from '../components/forms/TextInput.js';
import { Spinner } from '../components/feedback/Spinner.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import type { KeyBinding, ConversionMode, ComponentType } from '../types.js';

const WIZARD_STEPS = ['Source', 'Config', 'Options', 'Review'];

export function ConversionWizard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const goBack = useStore((state) => state.goBack);
  const navigate = useStore((state) => state.navigate);
  const wizard = useStore((state) => state.wizard);
  const updateWizardState = useStore((state) => state.updateWizardState);
  const resetWizard = useStore((state) => state.resetWizard);
  const addRecentConversion = useStore((state) => state.addRecentConversion);

  const theme = getTheme(preferences.theme);
  const [focusedField, setFocusedField] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const canGoNext = (): boolean => {
    switch (wizard.currentStep) {
      case 0: // Source
        return wizard.sourceType !== null && wizard.sourcePath.length > 0;
      case 1: // Config
        return true; // Mode always has a default
      case 2: // Options
        return wizard.outputDir.length > 0;
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  const handleNext = async (): Promise<void> => {
    if (wizard.currentStep < WIZARD_STEPS.length - 1) {
      updateWizardState({ currentStep: wizard.currentStep + 1 });
      setFocusedField(0);
    } else {
      // Execute conversion
      await executeConversion();
    }
  };

  const handlePrev = (): void => {
    if (wizard.currentStep > 0) {
      updateWizardState({ currentStep: wizard.currentStep - 1 });
      setFocusedField(0);
    } else {
      goBack();
    }
  };

  const executeConversion = async (): Promise<void> => {
    setIsConverting(true);
    setConversionError(null);

    try {
      // Import and run the actual conversion
      const { convertAura } = await import('../../cli/commands/aura.js');
      const { convertVf } = await import('../../cli/commands/vf.js');

      if (wizard.sourceType === 'aura') {
        await convertAura(wizard.sourcePath, {
          output: wizard.outputDir,
          full: wizard.conversionMode === 'full',
          preview: wizard.generatePreview,
          dryRun: false,
          verbose: false,
          open: false,
        });
      } else if (wizard.sourceType === 'vf') {
        await convertVf(wizard.sourcePath, {
          output: wizard.outputDir,
          full: wizard.conversionMode === 'full',
          preview: wizard.generatePreview,
          dryRun: false,
          verbose: false,
          open: false,
          controller: wizard.controllerPaths[0],
        });
      }

      // Add to recent conversions
      addRecentConversion({
        name: wizard.sourcePath.split('/').pop() || 'Unknown',
        type: wizard.sourceType!,
        timestamp: new Date(),
        score: 0, // Would need to grade
        grade: 'B',
        success: true,
      });

      // Reset and go back
      resetWizard();
      navigate('dashboard');
    } catch (error) {
      setConversionError(
        error instanceof Error ? error.message : 'Conversion failed'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: handlePrev, description: wizard.currentStep === 0 ? 'Cancel' : 'Back' },
    {
      key: 'return',
      action: () => {
        if (canGoNext()) handleNext();
      },
      description: wizard.currentStep === WIZARD_STEPS.length - 1 ? 'Convert' : 'Next',
    },
    {
      key: 'tab',
      action: () => setFocusedField((f) => f + 1),
      description: 'Next Field',
    },
  ];

  useKeyBindings(footerBindings, { isActive: !isConverting });

  if (isConverting) {
    return (
      <Screen title="Converting..." footerBindings={[]}>
        <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={4}>
          <Spinner label="Converting component..." />
          <Box marginTop={1}>
            <Text color={theme.textMuted}>
              This may take a moment...
            </Text>
          </Box>
        </Box>
      </Screen>
    );
  }

  return (
    <Screen title="Conversion Wizard" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* Step indicator */}
        <StepIndicator steps={WIZARD_STEPS} currentStep={wizard.currentStep} />

        {/* Error message */}
        {conversionError && (
          <Box
            borderStyle="single"
            borderColor={theme.error}
            paddingX={2}
            paddingY={1}
            marginBottom={1}
          >
            <Text color={theme.error}>Error: {conversionError}</Text>
          </Box>
        )}

        {/* Step content */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.border}
          paddingX={2}
          paddingY={1}
        >
          {wizard.currentStep === 0 && (
            <SourceStep
              sourceType={wizard.sourceType}
              sourcePath={wizard.sourcePath}
              focusedField={focusedField}
              onSourceTypeChange={(type) => updateWizardState({ sourceType: type })}
              onSourcePathChange={(path) => updateWizardState({ sourcePath: path })}
            />
          )}

          {wizard.currentStep === 1 && (
            <ConfigStep
              conversionMode={wizard.conversionMode}
              focusedField={focusedField}
              onModeChange={(mode) => updateWizardState({ conversionMode: mode })}
            />
          )}

          {wizard.currentStep === 2 && (
            <OptionsStep
              outputDir={wizard.outputDir}
              generatePreview={wizard.generatePreview}
              generateTests={wizard.generateTests}
              focusedField={focusedField}
              onOutputDirChange={(dir) => updateWizardState({ outputDir: dir })}
              onPreviewChange={(preview) => updateWizardState({ generatePreview: preview })}
              onTestsChange={(tests) => updateWizardState({ generateTests: tests })}
            />
          )}

          {wizard.currentStep === 3 && (
            <ReviewStep wizard={wizard} />
          )}
        </Box>

        {/* Navigation hint */}
        <Box marginTop={1}>
          <Text color={theme.textMuted}>
            Press <Text color={theme.accent}>[Enter]</Text> to continue,{' '}
            <Text color={theme.accent}>[Esc]</Text> to go back
          </Text>
        </Box>
      </Box>
    </Screen>
  );
}

interface SourceStepProps {
  sourceType: ComponentType | null;
  sourcePath: string;
  focusedField: number;
  onSourceTypeChange: (type: ComponentType) => void;
  onSourcePathChange: (path: string) => void;
}

function SourceStep({
  sourceType,
  sourcePath,
  focusedField,
  onSourceTypeChange,
  onSourcePathChange,
}: SourceStepProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      <Text color={theme.primary} bold>
        Source Component
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text} bold>
          Component Type
        </Text>
        <RadioGroup
          options={[
            { label: 'Aura Component', value: 'aura' as ComponentType },
            { label: 'Visualforce Page', value: 'vf' as ComponentType },
          ]}
          value={sourceType || 'aura'}
          onChange={onSourceTypeChange}
          focusedIndex={focusedField === 0 ? 0 : -1}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label="Component Path"
          value={sourcePath}
          onChange={onSourcePathChange}
          placeholder="Enter path to component..."
          focus={focusedField === 1}
        />
      </Box>
    </Box>
  );
}

interface ConfigStepProps {
  conversionMode: ConversionMode;
  focusedField: number;
  onModeChange: (mode: ConversionMode) => void;
}

function ConfigStep({
  conversionMode,
  focusedField,
  onModeChange,
}: ConfigStepProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      <Text color={theme.primary} bold>
        Conversion Configuration
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text} bold>
          Conversion Mode
        </Text>
        <RadioGroup
          options={[
            {
              label: 'Scaffolding - Generate skeleton with TODO comments',
              value: 'scaffolding' as ConversionMode,
            },
            {
              label: 'Full - Complete automated transformation',
              value: 'full' as ConversionMode,
            },
          ]}
          value={conversionMode}
          onChange={onModeChange}
          focusedIndex={focusedField === 0 ? (conversionMode === 'scaffolding' ? 0 : 1) : -1}
        />
      </Box>

      <Box marginTop={1}>
        <Text color={theme.textMuted}>
          Tip: Scaffolding mode is recommended for complex components
        </Text>
      </Box>
    </Box>
  );
}

interface OptionsStepProps {
  outputDir: string;
  generatePreview: boolean;
  generateTests: boolean;
  focusedField: number;
  onOutputDirChange: (dir: string) => void;
  onPreviewChange: (preview: boolean) => void;
  onTestsChange: (tests: boolean) => void;
}

function OptionsStep({
  outputDir,
  generatePreview,
  generateTests,
  focusedField,
  onOutputDirChange,
}: OptionsStepProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      <Text color={theme.primary} bold>
        Output Options
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label="Output Directory"
          value={outputDir}
          onChange={onOutputDirChange}
          placeholder="./lwc-output"
          focus={focusedField === 0}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.textMuted}>
          Additional options are configured in Settings
        </Text>
      </Box>
    </Box>
  );
}

interface ReviewStepProps {
  wizard: {
    sourceType: ComponentType | null;
    sourcePath: string;
    conversionMode: ConversionMode;
    outputDir: string;
    generatePreview: boolean;
    generateTests: boolean;
  };
}

function ReviewStep({ wizard }: ReviewStepProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  return (
    <Box flexDirection="column">
      <Text color={theme.primary} bold>
        Review & Confirm
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={theme.textMuted}>Source Type: </Text>
          <Text color={theme.text}>{wizard.sourceType?.toUpperCase()}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>Source Path: </Text>
          <Text color={theme.text}>{wizard.sourcePath}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>Mode: </Text>
          <Text color={theme.text}>{wizard.conversionMode}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>Output: </Text>
          <Text color={theme.text}>{wizard.outputDir}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>Preview: </Text>
          <Text color={theme.text}>{wizard.generatePreview ? 'Yes' : 'No'}</Text>
        </Box>
        <Box>
          <Text color={theme.textMuted}>Tests: </Text>
          <Text color={theme.text}>{wizard.generateTests ? 'Yes' : 'No'}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.success} bold>
          Press Enter to start conversion
        </Text>
      </Box>
    </Box>
  );
}
