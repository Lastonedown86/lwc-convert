# LWC Convert TUI Redesign Plan

> A comprehensive plan for overhauling the TUI to create an intuitive, hassle-free, and seamlessly navigable interface.

## Executive Summary

This plan redesigns the TUI experience for lwc-convert to provide an intuitive, hassle-free, and seamlessly navigable interface. The current implementation uses two disconnected systems (@clack/prompts for wizard flow and raw readline for grade-tui), creating inconsistent user experiences. This overhaul unifies everything under a single framework with shared state, persistent preferences, and modern UX patterns.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Framework Selection](#2-framework-selection)
3. [Screen Architecture](#3-screen-architecture)
4. [Navigation System](#4-navigation-system)
5. [State Management](#5-state-management)
6. [Component Library](#6-component-library)
7. [Implementation Phases](#7-implementation-phases)
8. [Migration Strategy](#8-migration-strategy)
9. [Technical Considerations](#9-technical-considerations)
10. [Success Metrics](#10-success-metrics)

---

## 1. Current State Analysis

### 1.1 Existing TUI Systems

The project currently uses a **hybrid approach** with two different TUI frameworks:

#### Primary: @clack/prompts (Interactive Wizard)
- **Location**: `/src/cli/interactive.ts`
- **Use case**: Initial wizard flow for conversion/grading selections
- **Features**: Multi-step forms, breadcrumb navigation, component auto-discovery

#### Secondary: Native Node.js readline (Grade Results Display)
- **Location**: `/src/cli/tui/grade-tui.ts`
- **Use case**: Interactive results navigation for grading output
- **Techniques**: Raw terminal mode, ANSI escape codes, manual screen rendering

### 1.2 Current Pain Points

| Category | Issue | Impact |
|----------|-------|--------|
| **Consistency** | Two separate TUI systems | Inconsistent interaction patterns |
| **Display** | Hardcoded 15 visible rows | No dynamic terminal sizing |
| **Preferences** | Settings not remembered | Must re-enter same choices repeatedly |
| **Export** | Can't export mid-session | Must use CLI flags before running |
| **Navigation** | No file browser | Only auto-discovery or manual paths |
| **Comparison** | No side-by-side views | Hard to compare components |
| **Recovery** | No error recovery | Must restart on failure |

### 1.3 What Works Well

- Interactive wizard with breadcrumb navigation
- Grade TUI with keyboard navigation, sorting, filtering, search
- Two-mode rendering (TTY interactive, non-TTY static)
- Session persistence across CLI invocations
- Color-coded output throughout
- Modular command structure

---

## 2. Framework Selection

### 2.1 Evaluation Matrix

| Framework | React Model | TypeScript | Layouts | Navigation | Ecosystem | Decision |
|-----------|-------------|------------|---------|------------|-----------|----------|
| **Ink** | Native React | Excellent | Flexbox | Built-in | Rich | **Selected** |
| Blessed | No | Fair | Custom | Manual | Mature | Too complex |
| @clack/prompts | No | Good | Linear | Wizard only | Limited | Current |
| Bubbletea | Go-style | N/A | Manual | Manual | N/A | Wrong language |

### 2.2 Why Ink

1. **React Component Model**: Familiar paradigm for building composable UIs
2. **TypeScript First**: Full type definitions, excellent IDE support
3. **Flexbox Layouts**: Responsive terminal layouts that adapt to terminal size
4. **Built-in Primitives**: `useInput`, `useFocus`, `useStdin`, `useFocusManager`
5. **Rich Ecosystem**: `ink-text-input`, `ink-select-input`, `ink-table`, `ink-spinner`
6. **Incremental Rendering**: Only re-renders changed components

### 2.3 Required Dependencies

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "ink-text-input": "^5.0.1",
    "ink-select-input": "^5.0.0",
    "ink-spinner": "^5.0.0",
    "ink-table": "^3.1.0",
    "react": "^18.2.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "ink-testing-library": "^3.0.0"
  }
}
```

---

## 3. Screen Architecture

### 3.1 Screen Flow Diagram

```
                          +------------------+
                          |    Dashboard     |
                          | (Welcome Screen) |
                          +--------+---------+
                                   |
         +------------+------------+------------+------------+
         |            |            |            |            |
         v            v            v            v            v
   +-----------+ +-----------+ +-----------+ +-----------+ +-----------+
   | Component | | Conversion| |  Grading  | |Dependencies| | Settings |
   |  Browser  | |  Wizard   | |  Results  | |   Graph   | |          |
   +-----------+ +-----------+ +-----------+ +-----------+ +-----------+
         |            |            |
         v            v            v
   +-----------+ +-----------+ +-----------+
   |  File     | |  Export   | |  Detail   |
   |  Preview  | |  Options  | |   View    |
   +-----------+ +-----------+ +-----------+
```

### 3.2 Screen Specifications

#### 3.2.1 Dashboard / Welcome Screen

**Purpose**: Central hub showing project status and quick actions

```
┌──────────────────────────────────────────────────────────────────┐
│  LWC Convert v1.3.1                        [?] Help  [S] Settings│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Welcome to LWC Convert                                          │
│  Project: my-salesforce-project                                  │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐          │
│  │ Quick Actions          │  │ Project Health         │          │
│  │ [C] Convert Component  │  │ Aura: 12 components    │          │
│  │ [G] Grade Complexity   │  │ VF: 8 pages            │          │
│  │ [D] View Dependencies  │  │ Avg Grade: B (72)      │          │
│  │ [B] Browse Components  │  │ Ready to convert: 15   │          │
│  └────────────────────────┘  └────────────────────────┘          │
│                                                                  │
│  Recent Conversions                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ AccountCard      Aura → LWC    2 min ago    Grade A (92)   │  │
│  │ ContactList      VF → LWC      1 hour ago   Grade B (78)   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [Tab] Navigate  [Enter] Select  [Q] Quit                         │
└──────────────────────────────────────────────────────────────────┘
```

**State Requirements**:
- Project path detection
- Component counts (Aura, VF)
- Recent conversions from session store
- Quick health metrics

#### 3.2.2 Component Browser Screen

**Purpose**: File tree navigation with filtering and selection

```
┌──────────────────────────────────────────────────────────────────┐
│  Component Browser                         [/] Search  [F] Filter│
├──────────────────────────────────────────────────────────────────┤
│  Path: force-app/main/default                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ AURA COMPONENTS (12)                         Score  Grade  │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ ▶ AccountCard/                              92    A   │  │  │
│  │ │   ├── AccountCard.cmp                                 │  │  │
│  │ │   ├── AccountCardController.js                        │  │  │
│  │ │   └── AccountCardHelper.js                            │  │  │
│  │ │ ▶ ContactManager/                           67    C   │  │  │
│  │ │ ▶ LeadConverter/                            45    D   │  │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │ VISUALFORCE PAGES (8)                        Score  Grade  │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │   AccountReport.page                        78    B   │  │  │
│  │ │   ContactList.page                          82    B   │  │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Selected: AccountCard (Aura)                                    │
├──────────────────────────────────────────────────────────────────┤
│ [Space] Select  [Enter] Convert  [P] Preview  [G] Grade          │
└──────────────────────────────────────────────────────────────────┘
```

**Features**:
- Tree view with expand/collapse
- Real-time search filtering
- Multi-select capability
- Grade indicators inline
- Sorting by name/grade/type

#### 3.2.3 Conversion Wizard Screen

**Purpose**: Step-by-step conversion configuration

```
┌──────────────────────────────────────────────────────────────────┐
│  Conversion Wizard                   Step 2 of 4: Configuration  │
├──────────────────────────────────────────────────────────────────┤
│  [●] Source  [○] Config  [○] Options  [○] Review                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Source Component                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Name: AccountCard                                          │  │
│  │  Type: Aura Component                                       │  │
│  │  Path: force-app/main/default/aura/AccountCard              │  │
│  │  Files: 4 (cmp, js, helper, css)                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Conversion Mode                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ( ) Scaffolding - Generate skeleton with TODO comments     │  │
│  │  (●) Full - Complete automated transformation               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Output Directory                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ./lwc-output  [Browse...]                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [←] Back  [→] Next  [Esc] Cancel                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Wizard Steps**:
1. **Source Selection** - From browser or manual path
2. **Configuration** - Mode, controllers (VF only)
3. **Options** - Output dir, preview, tests
4. **Review & Confirm** - Summary before execution

#### 3.2.4 Grading Results Screen

**Purpose**: Display and explore complexity grading results

**List View**:
```
┌──────────────────────────────────────────────────────────────────┐
│  Grading Results                    [S] Sort  [F] Filter  [E] Export│
├──────────────────────────────────────────────────────────────────┤
│  Summary: 20 components │ Avg: 72 (B) │ Effort: ~45 hrs          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Distribution: [████████A████████][███B███][██C██][D][F]    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Component           Type   Score  Grade  Complexity       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │▶ AccountCard         Aura    92     A     Simple           │  │
│  │  ContactManager      Aura    67     C     Moderate         │  │
│  │  LeadConverter       Aura    45     D     Complex          │  │
│  │  OpportunityView     VF      78     B     Easy             │  │
│  │  ReportDashboard     VF      34     F     Very Complex     │  │
│  │  ...                                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                           Showing 1-15 of 20     │
├──────────────────────────────────────────────────────────────────┤
│ [Enter] Details  [C] Convert  [Space] Select  [PgUp/Dn] Scroll   │
└──────────────────────────────────────────────────────────────────┘
```

**Detail View**:
```
┌──────────────────────────────────────────────────────────────────┐
│  Component Details: LeadConverter                    [Esc] Back  │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Score: 45       │  │  COMPLEXITY FACTORS                  │  │
│  │  Grade: D        │  ├──────────────────────────────────────┤  │
│  │  Complexity:     │  │  [HIGH] Circular dependencies (3)    │  │
│  │    Complex       │  │  [HIGH] Complex event handling       │  │
│  │                  │  │  [MED]  Multiple Apex controllers    │  │
│  │  Effort Est:     │  │  [MED]  Dynamic component creation   │  │
│  │  12-16 hours     │  │  [LOW]  Custom CSS (200 lines)       │  │
│  └──────────────────┘  └──────────────────────────────────────┘  │
│                                                                  │
│  CATEGORY BREAKDOWN                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Markup:      [████████░░░░░] 65%                          │  │
│  │  Logic:       [█████░░░░░░░░] 40%                          │  │
│  │  Data Access: [███████░░░░░░] 55%                          │  │
│  │  Events:      [████░░░░░░░░░] 35%                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  RECOMMENDATIONS                                                 │
│  1. Break into smaller components before converting              │
│  2. Refactor event handling to use LMS                          │
│  3. Consider converting dependent components first               │
├──────────────────────────────────────────────────────────────────┤
│ [C] Convert  [D] Dependencies  [←][→] Prev/Next Component        │
└──────────────────────────────────────────────────────────────────┘
```

#### 3.2.5 Settings Screen

**Purpose**: Configure defaults and user preferences

```
┌──────────────────────────────────────────────────────────────────┐
│  Settings                                           [Esc] Close  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DEFAULTS                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Default Output Directory:  ./lwc-output                   │  │
│  │  Default Conversion Mode:   [●] Scaffolding  [ ] Full      │  │
│  │  Auto-open Output Folder:   [●] Yes                        │  │
│  │  Generate UI Preview:       [ ] No                         │  │
│  │  Generate Jest Tests:       [●] Yes                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  DISPLAY                                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Theme:                     [●] Auto  [ ] Dark  [ ] Light  │  │
│  │  Show Grade Colors:         [●] Yes                        │  │
│  │  Visible Rows:              [ 20 ]  (auto-detected)        │  │
│  │  Confirm Before Actions:    [●] Yes                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  SESSION                                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Remember Last Project:     [●] Yes                        │  │
│  │  Session Expiry:            4 hours                        │  │
│  │  [Clear Session Data]       [Export Patterns]              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ [Tab] Navigate  [Space] Toggle  [Enter] Edit  [S] Save           │
└──────────────────────────────────────────────────────────────────┘
```

#### 3.2.6 Export Options Modal

**Purpose**: Configure export format and destination

```
┌──────────────────────────────────────────┐
│  Export Results                 [X] Close│
├──────────────────────────────────────────┤
│                                          │
│  Format:                                 │
│  [●] JSON   [ ] CSV   [ ] HTML   [ ] MD  │
│                                          │
│  Include:                                │
│  [●] Summary Statistics                  │
│  [●] Component Details                   │
│  [●] Recommendations                     │
│  [ ] Raw Metrics Data                    │
│                                          │
│  Output:                                 │
│  ┌────────────────────────────────────┐  │
│  │  ./grading-report.json             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ ] Open file after export              │
│                                          │
│  ┌────────┐  ┌────────┐                  │
│  │ Cancel │  │ Export │                  │
│  └────────┘  └────────┘                  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 4. Navigation System

### 4.1 Global Navigation

Every screen includes a consistent header and footer:

**Header Pattern**:
```
┌──────────────────────────────────────────────────────────────────┐
│  LWC Convert            [Screen Name]       [?] Help  [S] Settings│
└──────────────────────────────────────────────────────────────────┘
```

**Footer Pattern** (Context-sensitive):
```
┌──────────────────────────────────────────────────────────────────┐
│ [Tab] Navigate  [Enter] Select  [/] Search  [Esc] Back  [Q] Quit │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Keyboard Shortcuts

#### Global Shortcuts (Available Everywhere)

| Key | Action | Description |
|-----|--------|-------------|
| `?` | Help | Show help overlay |
| `S` | Settings | Open settings screen |
| `Q` | Quit | Quit with confirmation |
| `Esc` | Back | Back / Cancel / Close modal |
| `Tab` | Next | Focus next element |
| `Shift+Tab` | Previous | Focus previous element |
| `Ctrl+K` | Commands | Open command palette |

#### Browser Screen Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `F` | Toggle filter panel |
| `Space` | Select/deselect item |
| `Enter` | Open/Expand or Convert |
| `P` | Preview component |
| `G` | Grade selected |

#### Grading Results Shortcuts

| Key | Action |
|-----|--------|
| `S` | Cycle sort (score/name/complexity) |
| `F` | Cycle filter (All/A/B/C/D/F) |
| `E` | Export dialog |
| `C` | Convert selected |
| `Enter` | Show details |
| `PgUp/PgDn` | Page scroll |
| `←/→` | Prev/Next in detail view |

### 4.3 Command Palette (Ctrl+K)

Fuzzy-searchable command palette for power users:

```
┌──────────────────────────────────────────┐
│  > _                                     │
├──────────────────────────────────────────┤
│  Convert AccountCard                     │
│  Grade All Components                    │
│  Open Settings                           │
│  Export to JSON                          │
│  View Dependencies                       │
│  Clear Session                           │
└──────────────────────────────────────────┘
```

### 4.4 Context Preservation

When navigating between screens, preserve:
- Scroll position in lists
- Selected items
- Active filters/sorts
- Search queries
- Expanded tree nodes

---

## 5. State Management

### 5.1 Architecture: Zustand Store

```typescript
// /src/tui/store/index.ts

interface AppState {
  // Navigation
  currentScreen: ScreenType;
  screenHistory: ScreenType[];
  modalStack: ModalType[];

  // Project
  projectPath: string;
  auraComponents: ComponentInfo[];
  vfPages: ComponentInfo[];

  // User Preferences (persisted)
  preferences: UserPreferences;

  // Session
  session: SessionData;

  // Screen-specific state
  browser: BrowserState;
  grading: GradingState;
  wizard: WizardState;

  // Actions
  navigate: (screen: ScreenType) => void;
  goBack: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}
```

### 5.2 User Preferences Schema

```typescript
interface UserPreferences {
  // Defaults
  defaultOutputDir: string;
  defaultConversionMode: 'scaffolding' | 'full';
  autoOpenFolder: boolean;
  generatePreview: boolean;
  generateTests: boolean;

  // Display
  theme: 'auto' | 'dark' | 'light';
  showGradeColors: boolean;
  visibleRows: number | 'auto';
  confirmBeforeActions: boolean;

  // Session
  rememberLastProject: boolean;
  sessionExpiryHours: number;

  // Grading defaults
  defaultGradingDetailLevel: 'summary' | 'standard' | 'detailed';
  defaultExportFormat: 'json' | 'csv' | 'html' | 'md';
}
```

### 5.3 Persistence Layer

```typescript
// Preferences stored in ~/.lwc-convert/preferences.json
// Session data in OS temp dir (existing session-store.ts)

const PREFS_PATH = path.join(os.homedir(), '.lwc-convert', 'preferences.json');
```

### 5.4 Screen-Specific State

```typescript
interface BrowserState {
  expandedNodes: Set<string>;
  selectedItems: string[];
  searchQuery: string;
  sortBy: 'name' | 'grade' | 'type';
  filterType: 'all' | 'aura' | 'vf';
}

interface GradingState {
  components: ComponentGrade[];
  summary: GradingSummary;
  selectedIndex: number;
  scrollOffset: number;
  viewMode: 'list' | 'detail';
  sortBy: 'score' | 'name' | 'complexity' | 'type';
  filterGrade: string | null;
  searchQuery: string;
}

interface WizardState {
  currentStep: number;
  stepHistory: WizardStepData[];
  source: SourceConfig;
  options: ConversionOptions;
}
```

---

## 6. Component Library

### 6.1 Directory Structure

```
src/tui/
├── components/
│   ├── core/
│   │   ├── Box.tsx           # Flexbox container with borders
│   │   ├── Text.tsx          # Styled text with themes
│   │   ├── Divider.tsx       # Horizontal/vertical dividers
│   │   └── Spacer.tsx        # Flexible spacing
│   ├── layout/
│   │   ├── Screen.tsx        # Full screen with header/footer
│   │   ├── Header.tsx        # App header bar
│   │   ├── Footer.tsx        # Context-sensitive footer
│   │   ├── Sidebar.tsx       # Optional navigation sidebar
│   │   └── Modal.tsx         # Overlay modal container
│   ├── navigation/
│   │   ├── Breadcrumbs.tsx   # Step/path indicator
│   │   ├── TabBar.tsx        # Horizontal tab navigation
│   │   └── CommandPalette.tsx# Ctrl+K fuzzy search
│   ├── data/
│   │   ├── Table.tsx         # Sortable/filterable table
│   │   ├── Tree.tsx          # Expandable file tree
│   │   ├── List.tsx          # Virtual scrolling list
│   │   └── DetailPane.tsx    # Key-value detail view
│   ├── forms/
│   │   ├── TextInput.tsx     # Text input with validation
│   │   ├── Select.tsx        # Dropdown select
│   │   ├── Checkbox.tsx      # Toggle checkbox
│   │   ├── RadioGroup.tsx    # Radio button group
│   │   └── PathInput.tsx     # File/folder path input
│   ├── feedback/
│   │   ├── Spinner.tsx       # Loading spinner
│   │   ├── Progress.tsx      # Progress bar
│   │   ├── StatusBar.tsx     # Status indicators
│   │   ├── Toast.tsx         # Temporary notifications
│   │   └── Badge.tsx         # Grade/status badges
│   └── visualization/
│       ├── GradeDistribution.tsx  # Visual grade bar
│       ├── ScoreBar.tsx           # Horizontal score bar
│       └── Sparkline.tsx          # Mini inline chart
├── screens/
│   ├── Dashboard.tsx
│   ├── ComponentBrowser.tsx
│   ├── ConversionWizard.tsx
│   ├── GradingResults.tsx
│   ├── ComponentDetail.tsx
│   ├── Settings.tsx
│   └── ExportModal.tsx
├── hooks/
│   ├── useTerminalSize.ts    # Dynamic terminal dimensions
│   ├── useKeyBindings.ts     # Global keyboard shortcuts
│   ├── useFocusZone.ts       # Focus management
│   ├── useVirtualScroll.ts   # Efficient list rendering
│   └── useAsyncAction.ts     # Loading states for async ops
├── store/
│   ├── index.ts              # Main Zustand store
│   ├── preferences.ts        # User preferences slice
│   ├── session.ts            # Session data slice
│   └── persistence.ts        # File I/O for persistence
├── themes/
│   ├── index.ts              # Theme definitions
│   ├── dark.ts
│   └── light.ts
└── App.tsx                   # Root component with router
```

### 6.2 Core Component Interfaces

#### Table Component

```typescript
interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortable?: boolean;
  filterable?: boolean;
  selectable?: 'single' | 'multi' | false;
  selected?: T[];
  onSelect?: (items: T[]) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  pageSize?: number | 'auto';
  renderRow?: (item: T, isSelected: boolean) => React.ReactNode;
}
```

#### Tree Component

```typescript
interface TreeProps {
  data: TreeNode[];
  expanded?: string[];
  selected?: string;
  onSelect?: (nodeId: string) => void;
  onExpand?: (nodeId: string) => void;
  onCollapse?: (nodeId: string) => void;
  renderNode?: (node: TreeNode, depth: number) => React.ReactNode;
  filterQuery?: string;
}
```

#### Modal Component

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: number | 'auto';
  height?: number | 'auto';
  closeOnEsc?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

### 6.3 Dynamic Terminal Sizing Hook

```typescript
function useTerminalSize() {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });

  useEffect(() => {
    const handler = () => {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
      });
    };

    process.stdout.on('resize', handler);
    return () => process.stdout.off('resize', handler);
  }, []);

  const contentRows = size.rows - 4;  // minus header/footer

  return { ...size, contentRows };
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation

**Goal**: Set up Ink infrastructure and migrate core components

**Tasks**:
1. Add Ink and React dependencies to package.json
2. Configure TypeScript for JSX (tsconfig.json)
3. Create base component library (Box, Text, Screen, Header, Footer)
4. Implement Zustand store with preferences persistence
5. Create useTerminalSize and useKeyBindings hooks
6. Build App shell with basic navigation
7. Implement Dashboard screen (good starting point)

**Deliverables**:
- Working Ink app that launches on `lwc-convert` (no args)
- Dashboard showing project health
- Settings screen with persistence
- Global keyboard shortcuts working

### Phase 2: Component Browser

**Goal**: Build file browser with grading integration

**Tasks**:
1. Create Tree component with expand/collapse
2. Build List component with virtual scrolling
3. Implement search/filter functionality
4. Integrate grading data into browser view
5. Add multi-select capability
6. Create Preview pane

**Deliverables**:
- Fully navigable component browser
- Real-time search filtering
- Grade badges on components
- Selection state management

### Phase 3: Conversion Wizard

**Goal**: Modernize conversion flow with better UX

**Tasks**:
1. Create step-based wizard framework
2. Build form components (TextInput, Select, RadioGroup)
3. Implement breadcrumb navigation
4. Add validation and error states
5. Create review/confirm screen
6. Connect to existing conversion logic

**Deliverables**:
- Multi-step conversion wizard
- Back/forward navigation
- Input validation
- Integration with convertAura/convertVf

### Phase 4: Grading Results

**Goal**: Replace grade-tui with full-featured results screen

**Tasks**:
1. Create Table component with sorting/filtering
2. Build GradeDistribution visualization
3. Implement Detail view with category breakdowns
4. Add Export modal
5. Create smooth transitions between list/detail
6. Add keyboard navigation throughout

**Deliverables**:
- Full replacement for grade-tui.ts
- Sort by score/name/complexity/type
- Filter by grade
- Export to JSON/CSV/HTML/MD
- Detail view with recommendations

### Phase 5: Polish & Integration

**Goal**: Finalize UX and integrate all screens

**Tasks**:
1. Implement Command Palette (Ctrl+K)
2. Add Toast notifications
3. Create Help overlay
4. Implement themes (dark/light/auto)
5. Add error recovery flows
6. Performance optimization for large projects
7. Comprehensive keyboard shortcut documentation

**Deliverables**:
- Complete unified TUI
- All screens navigable
- Preferences persisted
- Session continuity
- Help documentation

### Phase 6: Advanced Features (Future)

**Goal**: Add comparison views and advanced workflows

**Tasks**:
1. Side-by-side component comparison
2. Batch conversion workflow
3. Dependency graph visualization in TUI
4. Custom conversion templates
5. Plugin system for custom grading rules
6. Watch mode for continuous grading

---

## 8. Migration Strategy

### 8.1 Parallel Operation

During development, both systems coexist:

```typescript
// /src/index.ts

if (process.argv.slice(2).length === 0) {
  if (process.env.LWC_CONVERT_LEGACY_TUI || process.argv.includes('--legacy-tui')) {
    // Use old @clack/prompts system
    import('./cli/interactive').then(({ runInteractiveTui }) => {
      runInteractiveTui();
    });
  } else {
    // Use new Ink-based TUI
    import('./tui/App').then(({ render }) => {
      render();
    });
  }
}
```

### 8.2 Migration Stages

| Stage | New TUI Access | Legacy TUI Access | Duration |
|-------|----------------|-------------------|----------|
| Development | `--new-tui` flag | Default | Phase 1-4 |
| Beta | Default | `--legacy-tui` flag | Phase 5 |
| Stable | Default | Removed | Post Phase 5 |

### 8.3 Files to Remove (Eventually)

After full migration:
- `/src/cli/interactive.ts` - clack-based wizard
- `/src/cli/tui/grade-tui.ts` - readline-based TUI

### 8.4 Files to Modify

- `/src/index.ts` - Entry point routing
- `/src/cli/commands/grade.ts` - Launch new grading screen
- `/package.json` - Add new dependencies
- `/tsconfig.json` - Enable JSX

---

## 9. Technical Considerations

### 9.1 Bundle Size Impact

| Package | Size (minified) |
|---------|-----------------|
| Ink | ~50KB |
| React | ~40KB |
| Zustand | ~5KB |
| Total increase | ~100KB |

Acceptable for a CLI tool. Dynamic imports can load TUI only when needed.

### 9.2 Node.js Compatibility

- Ink 4.x requires Node.js 14+
- Project already requires Node.js 18+ (see package.json engines)
- No compatibility issues expected

### 9.3 Testing Strategy

```typescript
// Use ink-testing-library for TUI component tests

import { render } from 'ink-testing-library';
import { Table } from './components/data/Table';

test('Table renders data correctly', () => {
  const { lastFrame } = render(
    <Table data={mockData} columns={mockColumns} />
  );

  expect(lastFrame()).toContain('AccountCard');
  expect(lastFrame()).toContain('92');
});
```

### 9.4 Error Handling

Global error boundary for graceful recovery:

```typescript
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <Screen>
        <Text color="red">An error occurred: {error.message}</Text>
        <Text>Press any key to return to dashboard...</Text>
      </Screen>
    );
  }

  return <ErrorBoundaryInner onError={setError}>{children}</ErrorBoundaryInner>;
}
```

---

## 10. Success Metrics

### 10.1 User Experience Goals

| Metric | Current | Target |
|--------|---------|--------|
| Time to first conversion | ~60s (many prompts) | <30s |
| Keystrokes for common action | 8-12 | 3-5 |
| Learning curve | Moderate (two systems) | Low (unified) |
| Error recovery | Restart required | In-place recovery |
| Preference retention | None | Full persistence |

### 10.2 Technical Goals

| Metric | Current | Target |
|--------|---------|--------|
| Code duplication | High (2 TUI systems) | Minimal (shared components) |
| Test coverage for TUI | 0% | >70% |
| Terminal resize handling | None | Full responsive |
| Accessibility (keyboard-only) | Partial | Complete |

---

## Appendix A: Critical Files Reference

| File | Purpose |
|------|---------|
| `/src/cli/interactive.ts` | Current clack wizard (reference for workflow) |
| `/src/cli/tui/grade-tui.ts` | Current grade TUI (reference for patterns) |
| `/src/utils/session-store.ts` | Session persistence (extend for preferences) |
| `/src/grading/types.ts` | Core types (ComponentGrade, GradingSummary) |
| `/src/index.ts` | Entry point (modify for TUI routing) |

---

## Appendix B: Design Principles

1. **Progressive Disclosure**: Show essential info first, details on demand
2. **Consistent Shortcuts**: Same keys work the same way everywhere
3. **Visible State**: Always show current filter/sort/selection state
4. **Forgiving**: Easy to undo, cancel, or go back
5. **Fast**: Instant feedback, no unnecessary delays
6. **Discoverable**: Help available contextually, shortcuts shown in footer
7. **Responsive**: Adapt to terminal size, not fixed dimensions

---

*Last updated: January 2026*
