import { create } from 'zustand';
import type {
  ScreenType,
  ModalType,
  UserPreferences,
  ComponentInfo,
  BrowserState,
  GradingDisplayState,
  WizardState,
  RecentConversion,
  ProjectHealth,
  GradeLevel,
} from '../types.js';
import { DEFAULT_PREFERENCES } from '../types.js';
import { loadPreferencesSync, savePreferences } from './persistence.js';
import type { ComponentGrade, GradingSummary } from '../../grading/types.js';

export interface AppState {
  // Navigation
  currentScreen: ScreenType;
  screenHistory: ScreenType[];
  modalStack: ModalType[];

  // Project
  projectPath: string;
  auraComponents: ComponentInfo[];
  vfComponents: ComponentInfo[];

  // Grading data
  gradingResults: ComponentGrade[];
  gradingSummary: GradingSummary | null;

  // User Preferences
  preferences: UserPreferences;

  // Recent activity
  recentConversions: RecentConversion[];
  projectHealth: ProjectHealth | null;

  // Screen-specific state
  browser: BrowserState;
  grading: GradingDisplayState;
  wizard: WizardState;

  // Actions - Navigation
  navigate: (screen: ScreenType) => void;
  goBack: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;

  // Actions - Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;

  // Actions - Project
  setProjectPath: (path: string) => void;
  setComponents: (aura: ComponentInfo[], vf: ComponentInfo[]) => void;
  setProjectHealth: (health: ProjectHealth) => void;

  // Actions - Grading
  setGradingResults: (results: ComponentGrade[], summary: GradingSummary) => void;
  clearGradingResults: () => void;
  updateGradingState: (state: Partial<GradingDisplayState>) => void;

  // Actions - Browser
  updateBrowserState: (state: Partial<BrowserState>) => void;
  toggleNodeExpanded: (nodeId: string) => void;
  toggleItemSelected: (itemId: string) => void;
  clearSelection: () => void;

  // Actions - Wizard
  updateWizardState: (state: Partial<WizardState>) => void;
  resetWizard: () => void;

  // Actions - Recent
  addRecentConversion: (conversion: RecentConversion) => void;
}

const initialBrowserState: BrowserState = {
  expandedNodes: new Set<string>(),
  selectedItems: [],
  searchQuery: '',
  sortBy: 'name',
  filterType: 'all',
  scrollOffset: 0,
};

const initialGradingState: GradingDisplayState = {
  selectedIndex: 0,
  scrollOffset: 0,
  viewMode: 'list',
  sortBy: 'score',
  sortDirection: 'desc',
  filterGrade: null,
  searchQuery: '',
};

const initialWizardState: WizardState = {
  currentStep: 0,
  sourceType: null,
  sourcePath: '',
  sourceComponent: null,
  conversionMode: 'scaffolding',
  outputDir: './lwc-output',
  generatePreview: false,
  generateTests: true,
  controllerPaths: [],
};

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentScreen: 'dashboard',
  screenHistory: [],
  modalStack: [],

  projectPath: process.cwd(),
  auraComponents: [],
  vfComponents: [],

  gradingResults: [],
  gradingSummary: null,

  preferences: loadPreferencesSync(),

  recentConversions: [],
  projectHealth: null,

  browser: initialBrowserState,
  grading: initialGradingState,
  wizard: { ...initialWizardState, outputDir: loadPreferencesSync().defaultOutputDir },

  // Navigation actions
  navigate: (screen: ScreenType) => {
    const { currentScreen, screenHistory } = get();
    set({
      currentScreen: screen,
      screenHistory: [...screenHistory, currentScreen],
    });
  },

  goBack: () => {
    const { screenHistory } = get();
    if (screenHistory.length === 0) return;

    const newHistory = [...screenHistory];
    const previousScreen = newHistory.pop()!;
    set({
      currentScreen: previousScreen,
      screenHistory: newHistory,
    });
  },

  openModal: (modal: ModalType) => {
    set((state) => ({
      modalStack: [...state.modalStack, modal],
    }));
  },

  closeModal: () => {
    set((state) => ({
      modalStack: state.modalStack.slice(0, -1),
    }));
  },

  // Preferences actions
  updatePreferences: async (prefs: Partial<UserPreferences>) => {
    const newPrefs = { ...get().preferences, ...prefs };
    set({ preferences: newPrefs });
    await savePreferences(newPrefs);
  },

  // Project actions
  setProjectPath: (path: string) => {
    set({ projectPath: path });
  },

  setComponents: (aura: ComponentInfo[], vf: ComponentInfo[]) => {
    set({ auraComponents: aura, vfComponents: vf });
  },

  setProjectHealth: (health: ProjectHealth) => {
    set({ projectHealth: health });
  },

  // Grading actions
  setGradingResults: (results: ComponentGrade[], summary: GradingSummary) => {
    set({
      gradingResults: results,
      gradingSummary: summary,
      grading: {
        ...get().grading,
        selectedIndex: 0,
        scrollOffset: 0,
      },
    });
  },

  clearGradingResults: () => {
    set({
      gradingResults: [],
      gradingSummary: null,
      grading: initialGradingState,
    });
  },

  updateGradingState: (state: Partial<GradingDisplayState>) => {
    set((current) => ({
      grading: { ...current.grading, ...state },
    }));
  },

  // Browser actions
  updateBrowserState: (state: Partial<BrowserState>) => {
    set((current) => ({
      browser: { ...current.browser, ...state },
    }));
  },

  toggleNodeExpanded: (nodeId: string) => {
    set((state) => {
      const newExpanded = new Set(state.browser.expandedNodes);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return {
        browser: { ...state.browser, expandedNodes: newExpanded },
      };
    });
  },

  toggleItemSelected: (itemId: string) => {
    set((state) => {
      const { selectedItems } = state.browser;
      const index = selectedItems.indexOf(itemId);
      let newSelected: string[];

      if (index === -1) {
        newSelected = [...selectedItems, itemId];
      } else {
        newSelected = selectedItems.filter((id) => id !== itemId);
      }

      return {
        browser: { ...state.browser, selectedItems: newSelected },
      };
    });
  },

  clearSelection: () => {
    set((state) => ({
      browser: { ...state.browser, selectedItems: [] },
    }));
  },

  // Wizard actions
  updateWizardState: (state: Partial<WizardState>) => {
    set((current) => ({
      wizard: { ...current.wizard, ...state },
    }));
  },

  resetWizard: () => {
    const { preferences } = get();
    set({
      wizard: {
        ...initialWizardState,
        outputDir: preferences.defaultOutputDir,
        conversionMode: preferences.defaultConversionMode,
        generatePreview: preferences.generatePreview,
        generateTests: preferences.generateTests,
      },
    });
  },

  // Recent conversions
  addRecentConversion: (conversion: RecentConversion) => {
    set((state) => ({
      recentConversions: [conversion, ...state.recentConversions].slice(0, 10),
    }));
  },
}));

// Selectors for common derived state
export function useCurrentModal(): ModalType | null {
  return useStore((state) =>
    state.modalStack.length > 0
      ? state.modalStack[state.modalStack.length - 1]
      : null
  );
}

export function useIsModalOpen(modal: ModalType): boolean {
  return useStore((state) => state.modalStack.includes(modal));
}

export function useFilteredGradingResults(): ComponentGrade[] {
  return useStore((state) => {
    let results = [...state.gradingResults];
    const { filterGrade, searchQuery, sortBy, sortDirection } = state.grading;

    // Apply filter
    if (filterGrade) {
      results = results.filter((r) => r.letterGrade === filterGrade);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.componentName.toLowerCase().includes(query) ||
          r.componentType.toLowerCase().includes(query)
      );
    }

    // Apply sort
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'name':
          comparison = a.componentName.localeCompare(b.componentName);
          break;
        case 'complexity':
          comparison = a.complexity.localeCompare(b.complexity);
          break;
        case 'type':
          comparison = a.componentType.localeCompare(b.componentType);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return results;
  });
}

export function useGradeDistribution(): Record<GradeLevel, number> {
  return useStore((state) => {
    const distribution: Record<GradeLevel, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };

    for (const result of state.gradingResults) {
      if (result.letterGrade in distribution) {
        distribution[result.letterGrade as GradeLevel]++;
      }
    }

    return distribution;
  });
}
