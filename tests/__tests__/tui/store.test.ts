/**
 * Tests for TUI Zustand Store
 */

import { useStore } from '../../../src/tui/store/index';
import type { ScreenType, ModalType, GradeLevel } from '../../../src/tui/types';
import type { ComponentGrade, GradingSummary } from '../../../src/grading/types';

// Reset the store before each test
beforeEach(() => {
  useStore.setState({
    currentScreen: 'dashboard',
    screenHistory: [],
    modalStack: [],
    projectPath: process.cwd(),
    auraComponents: [],
    vfComponents: [],
    gradingResults: [],
    gradingSummary: null,
    recentConversions: [],
    projectHealth: null,
    browser: {
      expandedNodes: new Set<string>(),
      selectedItems: [],
      searchQuery: '',
      sortBy: 'name',
      filterType: 'all',
      scrollOffset: 0,
    },
    grading: {
      selectedIndex: 0,
      scrollOffset: 0,
      viewMode: 'list',
      sortBy: 'score',
      sortDirection: 'desc',
      filterGrade: null,
      searchQuery: '',
    },
    wizard: {
      currentStep: 0,
      sourceType: null,
      sourcePath: '',
      sourceComponent: null,
      conversionMode: 'scaffolding',
      outputDir: './lwc-output',
      generatePreview: false,
      generateTests: true,
      controllerPaths: [],
    },
  });
});

describe('TUI Store - Navigation', () => {
  it('should start on dashboard screen', () => {
    const state = useStore.getState();
    expect(state.currentScreen).toBe('dashboard');
    expect(state.screenHistory).toHaveLength(0);
  });

  it('should navigate to a new screen and add to history', () => {
    const { navigate } = useStore.getState();

    navigate('browser');

    const state = useStore.getState();
    expect(state.currentScreen).toBe('browser');
    expect(state.screenHistory).toEqual(['dashboard']);
  });

  it('should navigate through multiple screens correctly', () => {
    const { navigate } = useStore.getState();

    navigate('browser');
    navigate('grading');
    navigate('settings');

    const state = useStore.getState();
    expect(state.currentScreen).toBe('settings');
    expect(state.screenHistory).toEqual(['dashboard', 'browser', 'grading']);
  });

  it('should go back to previous screen', () => {
    const { navigate, goBack } = useStore.getState();

    navigate('browser');
    navigate('grading');
    goBack();

    const state = useStore.getState();
    expect(state.currentScreen).toBe('browser');
    expect(state.screenHistory).toEqual(['dashboard']);
  });

  it('should not go back when history is empty', () => {
    const { goBack } = useStore.getState();

    goBack();

    const state = useStore.getState();
    expect(state.currentScreen).toBe('dashboard');
    expect(state.screenHistory).toHaveLength(0);
  });
});

describe('TUI Store - Modals', () => {
  it('should open a modal', () => {
    const { openModal } = useStore.getState();

    openModal('export');

    const state = useStore.getState();
    expect(state.modalStack).toEqual(['export']);
  });

  it('should stack multiple modals', () => {
    const { openModal } = useStore.getState();

    openModal('export');
    openModal('help');

    const state = useStore.getState();
    expect(state.modalStack).toEqual(['export', 'help']);
  });

  it('should close the topmost modal', () => {
    const { openModal, closeModal } = useStore.getState();

    openModal('export');
    openModal('help');
    closeModal();

    const state = useStore.getState();
    expect(state.modalStack).toEqual(['export']);
  });

  it('should handle closing when no modals are open', () => {
    const { closeModal } = useStore.getState();

    closeModal();

    const state = useStore.getState();
    expect(state.modalStack).toHaveLength(0);
  });
});

describe('TUI Store - Browser State', () => {
  it('should update browser state', () => {
    const { updateBrowserState } = useStore.getState();

    updateBrowserState({
      searchQuery: 'test',
      sortBy: 'grade',
    });

    const state = useStore.getState();
    expect(state.browser.searchQuery).toBe('test');
    expect(state.browser.sortBy).toBe('grade');
  });

  it('should toggle node expansion', () => {
    const { toggleNodeExpanded } = useStore.getState();

    toggleNodeExpanded('node1');

    let state = useStore.getState();
    expect(state.browser.expandedNodes.has('node1')).toBe(true);

    toggleNodeExpanded('node1');

    state = useStore.getState();
    expect(state.browser.expandedNodes.has('node1')).toBe(false);
  });

  it('should toggle item selection', () => {
    const { toggleItemSelected } = useStore.getState();

    toggleItemSelected('item1');

    let state = useStore.getState();
    expect(state.browser.selectedItems).toContain('item1');

    toggleItemSelected('item1');

    state = useStore.getState();
    expect(state.browser.selectedItems).not.toContain('item1');
  });

  it('should clear selection', () => {
    const { toggleItemSelected, clearSelection } = useStore.getState();

    toggleItemSelected('item1');
    toggleItemSelected('item2');
    clearSelection();

    const state = useStore.getState();
    expect(state.browser.selectedItems).toHaveLength(0);
  });
});

describe('TUI Store - Grading State', () => {
  const mockResults: ComponentGrade[] = [
    {
      componentName: 'ComponentA',
      componentType: 'aura',
      filePath: '/path/to/a',
      overallScore: 95,
      letterGrade: 'A',
      complexity: 'Simple',
      categoryScores: {},
      complexityFactors: [],
      conversionEffort: {
        automatedPercentage: 90,
        manualHours: { min: 1, max: 2, estimate: 1.5 },
        skillLevel: 'beginner',
      },
      recommendations: [],
      warnings: [],
      gradedAt: new Date(),
      gradedVersion: '1.0.0',
    },
    {
      componentName: 'ComponentB',
      componentType: 'vf',
      filePath: '/path/to/b',
      overallScore: 65,
      letterGrade: 'C',
      complexity: 'Moderate',
      categoryScores: {},
      complexityFactors: [],
      conversionEffort: {
        automatedPercentage: 60,
        manualHours: { min: 4, max: 8, estimate: 6 },
        skillLevel: 'intermediate',
      },
      recommendations: ['Consider refactoring'],
      warnings: [],
      gradedAt: new Date(),
      gradedVersion: '1.0.0',
    },
  ];

  const mockSummary: GradingSummary = {
    totalComponents: 2,
    averageScore: 80,
    averageGrade: 'B',
    distribution: { A: 1, B: 0, C: 1, D: 0, F: 0 },
    totalEffort: {
      automatedPercentage: 75,
      manualHours: { min: 5, max: 10, estimate: 7.5 },
    },
    recommendations: [],
  };

  it('should set grading results', () => {
    const { setGradingResults } = useStore.getState();

    setGradingResults(mockResults, mockSummary);

    const state = useStore.getState();
    expect(state.gradingResults).toHaveLength(2);
    expect(state.gradingSummary).toEqual(mockSummary);
  });

  it('should reset scroll and selection when setting results', () => {
    const { setGradingResults, updateGradingState } = useStore.getState();

    updateGradingState({ selectedIndex: 5, scrollOffset: 3 });
    setGradingResults(mockResults, mockSummary);

    const state = useStore.getState();
    expect(state.grading.selectedIndex).toBe(0);
    expect(state.grading.scrollOffset).toBe(0);
  });

  it('should update grading display state', () => {
    const { updateGradingState } = useStore.getState();

    updateGradingState({
      viewMode: 'detail',
      sortBy: 'name',
      filterGrade: 'A',
    });

    const state = useStore.getState();
    expect(state.grading.viewMode).toBe('detail');
    expect(state.grading.sortBy).toBe('name');
    expect(state.grading.filterGrade).toBe('A');
  });
});

describe('TUI Store - Wizard State', () => {
  it('should update wizard state', () => {
    const { updateWizardState } = useStore.getState();

    updateWizardState({
      currentStep: 2,
      sourceType: 'aura',
      sourcePath: '/path/to/component',
    });

    const state = useStore.getState();
    expect(state.wizard.currentStep).toBe(2);
    expect(state.wizard.sourceType).toBe('aura');
    expect(state.wizard.sourcePath).toBe('/path/to/component');
  });

  it('should reset wizard state', () => {
    const { updateWizardState, resetWizard } = useStore.getState();

    updateWizardState({
      currentStep: 3,
      sourceType: 'vf',
      sourcePath: '/path/to/page',
    });

    resetWizard();

    const state = useStore.getState();
    expect(state.wizard.currentStep).toBe(0);
    expect(state.wizard.sourceType).toBeNull();
    expect(state.wizard.sourcePath).toBe('');
  });
});

describe('TUI Store - Recent Conversions', () => {
  it('should add recent conversion', () => {
    const { addRecentConversion } = useStore.getState();

    addRecentConversion({
      name: 'TestComponent',
      type: 'aura',
      timestamp: new Date(),
      success: true,
      grade: 'A',
      score: 92,
    });

    const state = useStore.getState();
    expect(state.recentConversions).toHaveLength(1);
    expect(state.recentConversions[0].name).toBe('TestComponent');
  });

  it('should limit recent conversions to 10', () => {
    const { addRecentConversion } = useStore.getState();

    for (let i = 0; i < 15; i++) {
      addRecentConversion({
        name: `Component${i}`,
        type: 'aura',
        timestamp: new Date(),
        success: true,
        grade: 'A',
        score: 90,
      });
    }

    const state = useStore.getState();
    expect(state.recentConversions).toHaveLength(10);
    expect(state.recentConversions[0].name).toBe('Component14');
  });
});

describe('TUI Store - Project State', () => {
  it('should set project path', () => {
    const { setProjectPath } = useStore.getState();

    setProjectPath('/new/project/path');

    const state = useStore.getState();
    expect(state.projectPath).toBe('/new/project/path');
  });

  it('should set components', () => {
    const { setComponents } = useStore.getState();

    const auraComponents = [
      { id: '1', name: 'Comp1', path: '/path/1', type: 'aura' as const, files: ['Comp1.cmp'] },
    ];
    const vfComponents = [
      { id: '2', name: 'Page1', path: '/path/2', type: 'vf' as const, files: ['Page1.page'] },
    ];

    setComponents(auraComponents, vfComponents);

    const state = useStore.getState();
    expect(state.auraComponents).toHaveLength(1);
    expect(state.vfComponents).toHaveLength(1);
  });

  it('should set project health', () => {
    const { setProjectHealth } = useStore.getState();

    setProjectHealth({
      auraCount: 10,
      vfCount: 5,
      avgGrade: 'B',
      avgScore: 75,
      readyToConvert: 8,
    });

    const state = useStore.getState();
    expect(state.projectHealth?.auraCount).toBe(10);
    expect(state.projectHealth?.avgGrade).toBe('B');
  });
});
