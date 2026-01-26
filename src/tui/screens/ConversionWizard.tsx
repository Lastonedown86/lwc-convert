import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { StepIndicator } from '../components/navigation/Breadcrumbs.js';
import { RadioGroup } from '../components/forms/Checkbox.js';
import { TextInput } from '../components/forms/TextInput.js';
import { Spinner } from '../components/feedback/Spinner.js';
import { useStore } from '../store/index.js';
import { getTheme } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import { useTerminalSize, useVisibleRows } from '../hooks/useTerminalSize.js';
import type { KeyBinding, ConversionMode, ComponentType, ComponentInfo } from '../types.js';

const WIZARD_STEPS = ['Source', 'Config', 'Options', 'Review'];

export function ConversionWizard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const goBack = useStore((state) => state.goBack);
  const navigate = useStore((state) => state.navigate);
  const wizard = useStore((state) => state.wizard);
  const updateWizardState = useStore((state) => state.updateWizardState);
  const resetWizard = useStore((state) => state.resetWizard);
  const addRecentConversion = useStore((state) => state.addRecentConversion);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);

  const theme = getTheme(preferences.theme);
  const [focusedField, setFocusedField] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [selectedComponentIndex, setSelectedComponentIndex] = useState(0);
  const [componentListScrollOffset, setComponentListScrollOffset] = useState(0);

  // Get components based on source type
  const currentComponents = useMemo(() => {
    if (wizard.sourceType === 'aura') return auraComponents;
    if (wizard.sourceType === 'vf') return vfComponents;
    return [];
  }, [wizard.sourceType, auraComponents, vfComponents]);

  const componentListVisibleRows = 5;

  const canGoNext = (): boolean => {
    switch (wizard.currentStep) {
      case 0: // Source
        return wizard.sourcePath.length > 0;
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
    // Ensure sourceType has a default value
    if (wizard.currentStep === 0 && !wizard.sourceType) {
      updateWizardState({ sourceType: 'aura' });
    }
    
    if (wizard.currentStep < WIZARD_STEPS.length - 1) {
      updateWizardState({ currentStep: wizard.currentStep + 1 });
      setFocusedField(0);
    } else {
      // Execute conversion
      await executeConversion();
    }
  };

  const handleEnter = (): void => {
    // If on a radio group field, select the current option and move to next field
    if (wizard.currentStep === 0 && focusedField === 0) {
      // Set sourceType if not already set
      if (!wizard.sourceType) {
        updateWizardState({ sourceType: 'aura' });
      }
      // Move to component list if available, otherwise to path input
      setFocusedField(currentComponents.length > 0 ? 2 : 1);
    } else if (wizard.currentStep === 0 && focusedField === 2) {
      // Select component from list
      const selectedComponent = currentComponents[selectedComponentIndex];
      if (selectedComponent) {
        updateWizardState({ sourcePath: selectedComponent.path });
        setFocusedField(1); // Move to path input to show selection
      }
    } else if (wizard.currentStep === 1 && focusedField === 0) {
      // Move to next step since mode is already selected
      handleNext();
    } else if (canGoNext()) {
      handleNext();
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

  // Calculate max fields per step for navigation
  const getMaxFields = (): number => {
    switch (wizard.currentStep) {
      case 0: // Source - radio group (0), path input (1), component list (2) if available
        return currentComponents.length > 0 ? 2 : 1;
      case 1: // Config - radio group only (field 0)
        return 0;
      case 2: // Options - output dir (field 0) + 2 checkboxes (fields 1, 2)
        return 2;
      case 3: // Review - no fields
        return 0;
      default:
        return 0;
    }
  };

  // Handle up/down for radio group selection
  const handleArrowUp = (): void => {
    if (wizard.currentStep === 0 && focusedField === 0) {
      // Toggle between aura/vf
      updateWizardState({ sourceType: 'aura' });
      // Reset component selection when changing type
      setSelectedComponentIndex(0);
      setComponentListScrollOffset(0);
    } else if (wizard.currentStep === 0 && focusedField === 2) {
      // Scroll component list up
      if (selectedComponentIndex > 0) {
        const newIndex = selectedComponentIndex - 1;
        setSelectedComponentIndex(newIndex);
        // Adjust scroll offset to keep selection visible
        if (newIndex < componentListScrollOffset) {
          setComponentListScrollOffset(newIndex);
        }
      }
    } else if (wizard.currentStep === 1 && focusedField === 0) {
      // Toggle conversion mode
      updateWizardState({ conversionMode: 'scaffolding' });
    } else {
      setFocusedField((f) => Math.max(f - 1, 0));
    }
  };

  const handleArrowDown = (): void => {
    if (wizard.currentStep === 0 && focusedField === 0) {
      // Toggle between aura/vf
      updateWizardState({ sourceType: 'vf' });
      // Reset component selection when changing type
      setSelectedComponentIndex(0);
      setComponentListScrollOffset(0);
    } else if (wizard.currentStep === 0 && focusedField === 2) {
      // Scroll component list down
      if (selectedComponentIndex < currentComponents.length - 1) {
        const newIndex = selectedComponentIndex + 1;
        setSelectedComponentIndex(newIndex);
        // Adjust scroll offset to keep selection visible
        if (newIndex >= componentListScrollOffset + componentListVisibleRows) {
          setComponentListScrollOffset(newIndex - componentListVisibleRows + 1);
        }
      }
    } else if (wizard.currentStep === 1 && focusedField === 0) {
      // Toggle conversion mode
      updateWizardState({ conversionMode: 'full' });
    } else {
      setFocusedField((f) => Math.min(f + 1, getMaxFields()));
    }
  };

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: handlePrev, description: wizard.currentStep === 0 ? 'Cancel' : 'Back' },
    {
      key: 'return',
      action: handleEnter,
      description: wizard.currentStep === WIZARD_STEPS.length - 1 ? 'Convert' : 'Next',
    },
    {
      key: 'tab',
      action: () => setFocusedField((f) => Math.min(f + 1, getMaxFields())),
      description: 'Next Field',
    },
    {
      key: 'up',
      action: handleArrowUp,
      description: 'Up',
    },
    {
      key: 'down',
      action: handleArrowDown,
      description: 'Down',
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
              selectedComponentIndex={selectedComponentIndex}
              componentListScrollOffset={componentListScrollOffset}
              onSourceTypeChange={(type) => {
                updateWizardState({ sourceType: type });
                setSelectedComponentIndex(0);
                setComponentListScrollOffset(0);
              }}
              onSourcePathChange={(path) => updateWizardState({ sourcePath: path })}
              onComponentSelect={(component) => {
                updateWizardState({ sourcePath: component.path });
              }}
              onSelectedIndexChange={setSelectedComponentIndex}
              onScrollOffsetChange={setComponentListScrollOffset}
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
  selectedComponentIndex: number;
  componentListScrollOffset: number;
  onSourceTypeChange: (type: ComponentType) => void;
  onSourcePathChange: (path: string) => void;
  onComponentSelect: (component: ComponentInfo) => void;
  onSelectedIndexChange: (index: number) => void;
  onScrollOffsetChange: (offset: number) => void;
}

function SourceStep({
  sourceType,
  sourcePath,
  focusedField,
  selectedComponentIndex,
  componentListScrollOffset,
  onSourceTypeChange,
  onSourcePathChange,
  onComponentSelect,
  onSelectedIndexChange,
  onScrollOffsetChange,
}: SourceStepProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);
  const theme = getTheme(preferences.theme);
  const { columns } = useTerminalSize();

  // Filter components based on selected type
  const components = useMemo(() => {
    if (sourceType === 'aura') return auraComponents;
    if (sourceType === 'vf') return vfComponents;
    return [];
  }, [sourceType, auraComponents, vfComponents]);

  // When field 0 is focused, highlight the currently selected radio
  const radioIndex = sourceType === 'vf' ? 1 : 0;
  
  // Visible rows for component list
  const visibleRows = 5;
  
  // Calculate available width for component names (account for borders, padding, selector)
  const listWidth = Math.max(columns - 12, 40); // 12 = borders + padding + margins
  
  // Use the scroll offset directly from parent (which keeps it in sync with selection)
  const visibleComponents = useMemo(() => 
    components.slice(componentListScrollOffset, componentListScrollOffset + visibleRows),
    [components, componentListScrollOffset, visibleRows]
  );

  return (
    <Box flexDirection="column">
      <Text color={theme.primary} bold>
        Source Component
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text} bold>
          Component Type {focusedField === 0 && <Text color={theme.accent}>(↑↓ to select, Enter to confirm)</Text>}
        </Text>
        <RadioGroup
          options={[
            { label: 'Aura Component', value: 'aura' as ComponentType },
            { label: 'Visualforce Page', value: 'vf' as ComponentType },
          ]}
          value={sourceType || 'aura'}
          onChange={onSourceTypeChange}
          focusedIndex={focusedField === 0 ? radioIndex : -1}
        />
      </Box>

      {/* Component List - shown after selecting type */}
      {sourceType && components.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={theme.text} bold>
              Select Component {focusedField === 2 && <Text color={theme.accent}>(↑↓ to select, Enter to choose)</Text>}
            </Text>
            {components.length > visibleRows && (
              <Text color={theme.textMuted}>
                {componentListScrollOffset + 1}-{Math.min(componentListScrollOffset + visibleRows, components.length)} of {components.length}
              </Text>
            )}
          </Box>
          <Box 
            flexDirection="column" 
            borderStyle="single" 
            borderColor={focusedField === 2 ? theme.accent : theme.border}
            paddingX={1}
            marginTop={1}
            height={visibleRows + 2}
            overflow="hidden"
          >
            <Text>
              {visibleComponents.slice(0, visibleRows).map((comp, idx) => {
                const actualIndex = componentListScrollOffset + idx;
                const isSelected = actualIndex === selectedComponentIndex;
                const selector = isSelected ? '▶' : ' ';
                const gradeText = comp.grade ? ` [${comp.grade}]` : '';
                const displayText = `${selector} ${comp.name}${gradeText}`;
                return displayText.padEnd(listWidth, ' ');
              }).join('\n')}
            </Text>
          </Box>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <TextInput
          label={`Component Path ${focusedField === 1 ? '(type path or select from list above)' : ''}`}
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
