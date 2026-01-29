# Dashboard TUI Redesign Plan

## Overview

Redesign the Dashboard screen (`src/tui/screens/Dashboard.tsx`) to transform it from a static information display into an interactive, keyboard-driven command center using a two-panel layout pattern inspired by Settings, GradingResults, and ComponentBrowser screens.

### Current State
- Static welcome message and project name
- First-time welcome banner (overlay)
- Two side-by-side boxes: Quick Actions (shortcut reminders) and Project Health (stats)
- Recent Conversions list (display only, not interactive)
- Tip section at bottom
- No interactive navigation beyond global shortcuts
- Component discovery runs on mount

### Pain Points
1. **No interactivity**: Users can't navigate or select items on the dashboard
2. **Static shortcuts**: Quick Actions are just reminders, not actionable items
3. **Wasted space**: Recent conversions displayed but can't interact with them
4. **No detail view**: Project health shows summary but no drill-down
5. **Poor scalability**: Adding more dashboard items would clutter the layout
6. **No discoverability**: Users must memorize shortcuts to use features

### Goals
1. **Make it interactive**: Navigate and select dashboard items with keyboard
2. **Actionable items**: Click/select to perform actions, not just shortcuts
3. **Rich details**: Show contextual information in detail panel
4. **Keyboard-first UX**: Efficient navigation with clear visual feedback
5. **Discoverability**: See what's available and how to use it
6. **Extensibility**: Easy to add new dashboard widgets/cards

---

## Recommended Approach: Interactive Two-Panel Dashboard

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard - LWC Convert                              [?] Help       │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┬────────────────────────────────────────┐   │
│ │ DASHBOARD (35ch)     │ DETAIL (flexible)                      │   │
│ │                      │                                         │   │
│ │ ▶ QUICK START        │ Quick Start                            │   │
│ │                      │                                         │   │
│ │   Convert Component  │ Start converting Aura or Visualforce   │   │
│ │   Grade Complexity   │ components to Lightning Web Components │   │
│ │   Browse Components  │                                         │   │
│ │   Settings           │ Actions:                               │   │
│ │                      │ • [Enter] Launch conversion wizard     │   │
│ │ PROJECT HEALTH       │ • Select components interactively      │   │
│ │   📊 12 Components   │ • Choose conversion mode               │   │
│ │   🎯 Avg Grade: B    │ • Set output location                  │   │
│ │                      │                                         │   │
│ │ RECENT (3)           │ Keyboard: [C] shortcut available       │   │
│ │   ✓ myComponent      │                                         │   │
│ │   ✓ anotherOne       │                                         │   │
│ │   ✗ failedOne        │                                         │   │
│ └──────────────────────┴────────────────────────────────────────┘   │
│ Project: /path/to/project                      [R] Refresh          │
├─────────────────────────────────────────────────────────────────────┤
│ [↑↓] Navigate [Enter] Select [R] Refresh [Esc] Exit                │
└─────────────────────────────────────────────────────────────────────┘
```

### Visual Indicators
- `▶` = Focused section/item (accent color when focused)
- `✓` = Success indicator
- `✗` = Failed/error indicator
- `📊` `🎯` = Section icons for visual hierarchy
- Bold = Section headers

---

## Implementation Plan

### Phase 1: Dashboard Item Definitions (2-3 hours)

**Create: `src/tui/screens/Dashboard/dashboardItems.ts`**

```typescript
export type DashboardItemType =
  | 'quick-action'
  | 'project-stat'
  | 'recent-conversion'
  | 'tip';

export type QuickActionId =
  | 'convert'
  | 'grade'
  | 'browse'
  | 'settings';

export interface DashboardItem {
  id: string;
  type: DashboardItemType;
  label: string;
  description: string;
  icon?: string;
  category: string;
  action?: () => void;
  metadata?: Record<string, unknown>;
}

export interface QuickActionItem extends DashboardItem {
  type: 'quick-action';
  shortcut: string;
  enabled: boolean;
}

export interface ProjectStatItem extends DashboardItem {
  type: 'project-stat';
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface RecentConversionItem extends DashboardItem {
  type: 'recent-conversion';
  timestamp: Date;
  success: boolean;
  componentName: string;
  componentType: 'aura' | 'vf';
  grade?: string;
  score?: number;
}

// Factory functions to create items from app state
export function createQuickActions(navigate: (screen: ScreenType) => void): QuickActionItem[];
export function createProjectStats(projectHealth: ProjectHealth | null): ProjectStatItem[];
export function createRecentItems(recentConversions: RecentConversion[]): RecentConversionItem[];
```

### Phase 2: State Management (1-2 hours)

**Modify: `src/tui/store/index.ts`**

Add DashboardState to AppState:
```typescript
export interface DashboardState {
  selectedIndex: number;        // Which dashboard item is focused
  selectedCategory: string;      // Which category is open
  isRefreshing: boolean;         // Component discovery in progress
  lastRefresh: Date | null;      // Last refresh timestamp
}

const initialDashboardState: DashboardState = {
  selectedIndex: 0,
  selectedCategory: 'quick-start',
  isRefreshing: false,
  lastRefresh: null,
};

// Add to AppState interface
dashboard: DashboardState;

// Add actions
updateDashboardState: (state: Partial<DashboardState>) => void;
refreshProject: () => Promise<void>;
```

**Create: `src/tui/screens/Dashboard/types.ts`**
```typescript
export interface DashboardState { /* ... */ }
export interface DashboardItem { /* ... */ }
export interface QuickActionItem { /* ... */ }
export interface ProjectStatItem { /* ... */ }
export interface RecentConversionItem { /* ... */ }
```

### Phase 3: Left Panel - Dashboard Navigation (3-4 hours)

**Create: `src/tui/screens/Dashboard/DashboardNav.tsx`**

Component responsibilities:
- Render dashboard sections (Quick Start, Project Health, Recent)
- Show item counts per section
- Handle ↑↓ navigation through items
- Track focused index across all sections
- Show item indicators (✓, ✗, icons)

Layout:
```tsx
<Box flexDirection="column" width={35} borderStyle="single">
  <Text bold>DASHBOARD</Text>

  {/* Quick Start Section */}
  <Box flexDirection="column" marginTop={1}>
    <Text color={textMuted} bold>QUICK START</Text>
    {quickActions.map(action => (
      <Box key={action.id}>
        <Text color={arrowColor}>▶ </Text>
        <Text color={action.enabled ? text : textMuted}>
          {action.label}
        </Text>
        <Text color={accent}> [{action.shortcut}]</Text>
      </Box>
    ))}
  </Box>

  {/* Project Health Section */}
  <Box flexDirection="column" marginTop={1}>
    <Text color={textMuted} bold>PROJECT HEALTH</Text>
    {projectStats.map(stat => (
      <Box key={stat.id}>
        <Text color={arrowColor}>▶ </Text>
        <Text>{stat.icon} {stat.label}: </Text>
        <Text color={stat.color || text} bold>{stat.value}</Text>
      </Box>
    ))}
  </Box>

  {/* Recent Conversions Section */}
  <Box flexDirection="column" marginTop={1}>
    <Text color={textMuted} bold>RECENT ({recentCount})</Text>
    {recentItems.slice(0, 5).map(item => (
      <Box key={item.id}>
        <Text color={arrowColor}>▶ </Text>
        <Text color={item.success ? success : error}>
          {item.success ? '✓' : '✗'}
        </Text>
        <Text> {item.componentName}</Text>
        <Text color={textMuted}> {formatTimeAgo(item.timestamp)}</Text>
      </Box>
    ))}
  </Box>
</Box>
```

### Phase 4: Right Panel - Detail View (3-4 hours)

**Create: `src/tui/screens/Dashboard/DashboardDetail.tsx`**

Component responsibilities:
- Render contextual details for selected item
- Show different layouts based on item type
- Display available actions and shortcuts
- Show hints and help text
- Render rich project statistics with charts

For Quick Actions:
```tsx
<Box flexDirection="column" borderStyle="single" flexGrow={1}>
  <Text bold>{action.label}</Text>
  <Text color={textMuted}>{action.description}</Text>

  <Box marginTop={1}>
    <Text color={primary} bold>What this does:</Text>
    <Text>{action.detailedDescription}</Text>
  </Box>

  <Box marginTop={1}>
    <Text color={primary} bold>Actions:</Text>
    {action.steps.map(step => (
      <Text key={step}>• {step}</Text>
    ))}
  </Box>

  <Box marginTop={1}>
    <Text color={textMuted}>
      <Text color={accent}>[Enter]</Text> Launch
      <Text color={accent}>[{action.shortcut}]</Text> Quick shortcut
    </Text>
  </Box>
</Box>
```

For Project Stats:
```tsx
<Box flexDirection="column" borderStyle="single" flexGrow={1}>
  <Text bold>Project Health Overview</Text>

  <Box flexDirection="column" marginTop={1}>
    <Box>
      <Text>Total Components: </Text>
      <Text bold>{auraCount + vfCount}</Text>
    </Box>
    <Box marginLeft={2}>
      <Text color={textMuted}>Aura: {auraCount}</Text>
    </Box>
    <Box marginLeft={2}>
      <Text color={textMuted}>Visualforce: {vfCount}</Text>
    </Box>
  </Box>

  <Box marginTop={1}>
    <Text>Average Complexity: </Text>
    <GradeBadge grade={avgGrade} />
    <Text> ({avgScore}/100)</Text>
  </Box>

  {/* Grade Distribution Chart */}
  <Box marginTop={1}>
    <GradeDistribution results={gradingResults} />
  </Box>

  <Box marginTop={1}>
    <Text color={textMuted}>
      <Text color={accent}>[G]</Text> View detailed grading report
    </Text>
  </Box>
</Box>
```

For Recent Conversions:
```tsx
<Box flexDirection="column" borderStyle="single" flexGrow={1}>
  <Box flexDirection="row" gap={1}>
    <Text bold>{item.componentName}</Text>
    <Badge variant={item.success ? 'success' : 'error'}>
      {item.success ? 'Success' : 'Failed'}
    </Badge>
  </Box>

  <Box marginTop={1}>
    <Text color={textMuted}>Type: {item.componentType.toUpperCase()} → LWC</Text>
  </Box>

  <Box marginTop={1}>
    <Text color={textMuted}>
      Converted: {formatDetailedTime(item.timestamp)}
    </Text>
  </Box>

  {item.grade && (
    <Box marginTop={1}>
      <Text>Complexity: </Text>
      <GradeBadge grade={item.grade} />
      <Text> ({item.score}/100)</Text>
    </Box>
  )}

  <Box marginTop={1}>
    <Text color={primary} bold>Actions:</Text>
    <Text>• View in file explorer</Text>
    <Text>• Re-run conversion</Text>
    <Text>• View conversion logs</Text>
  </Box>

  <Box marginTop={1}>
    <Text color={textMuted}>
      <Text color={accent}>[Enter]</Text> View details
      <Text color={accent}>[O]</Text> Open folder
    </Text>
  </Box>
</Box>
```

### Phase 5: Main Screen - Two-Panel Layout (3-4 hours)

**Modify: `src/tui/screens/Dashboard/index.tsx`**

New structure:
```tsx
export function Dashboard(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const dashboard = useStore((state) => state.dashboard);
  const navigate = useStore((state) => state.navigate);
  const projectPath = useStore((state) => state.projectPath);
  const projectHealth = useStore((state) => state.projectHealth);
  const recentConversions = useStore((state) => state.recentConversions);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);
  const updateDashboardState = useStore((state) => state.updateDashboardState);
  const refreshProject = useStore((state) => state.refreshProject);

  const theme = getTheme(preferences.theme);

  // Build dashboard items from app state
  const quickActions = createQuickActions(navigate);
  const projectStats = createProjectStats(projectHealth);
  const recentItems = createRecentItems(recentConversions);

  // Flatten all items for navigation
  const allItems = [
    ...quickActions,
    ...projectStats,
    ...recentItems,
  ];

  const currentItem = allItems[dashboard.selectedIndex];

  const handleNavigate = (direction: 'up' | 'down') => {
    const newIndex = direction === 'up'
      ? Math.max(0, dashboard.selectedIndex - 1)
      : Math.min(allItems.length - 1, dashboard.selectedIndex + 1);
    updateDashboardState({ selectedIndex: newIndex });
  };

  const handleSelect = async () => {
    if (!currentItem) return;

    if (currentItem.type === 'quick-action') {
      currentItem.action?.();
    } else if (currentItem.type === 'recent-conversion') {
      // Open folder or re-run conversion
    }
  };

  const handleRefresh = async () => {
    await refreshProject();
  };

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: () => process.exit(0), description: 'Exit' },
    { key: 'up', action: () => handleNavigate('up'), description: 'Up' },
    { key: 'down', action: () => handleNavigate('down'), description: 'Down' },
    { key: 'return', action: handleSelect, description: 'Select' },
    { key: 'r', action: handleRefresh, description: 'Refresh' },
    // Quick shortcuts
    { key: 'c', action: () => navigate('wizard'), description: 'Convert' },
    { key: 'g', action: () => navigate('grading'), description: 'Grade' },
    { key: 'b', action: () => navigate('browser'), description: 'Browse' },
    { key: 's', action: () => navigate('settings'), description: 'Settings' },
  ];

  useKeyBindings(footerBindings);

  return (
    <Screen title="Dashboard - LWC Convert" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* First-time welcome (if needed) - keep as overlay */}
        {showFirstTime && <FirstTimeWelcome onDismiss={dismissFirstTime} />}

        {/* Two-panel layout */}
        <Box flexDirection="row" gap={2}>
          <DashboardNav
            quickActions={quickActions}
            projectStats={projectStats}
            recentItems={recentItems}
            selectedIndex={dashboard.selectedIndex}
            isRefreshing={dashboard.isRefreshing}
          />
          <DashboardDetail
            item={currentItem}
            projectHealth={projectHealth}
            onAction={handleSelect}
          />
        </Box>

        {/* Status bar */}
        <Box marginTop={1} flexDirection="row" justifyContent="space-between">
          <Text color={theme.textMuted}>
            Project: {projectPath}
          </Text>
          {dashboard.lastRefresh && (
            <Text color={theme.textMuted}>
              Last refresh: {formatTimeAgo(dashboard.lastRefresh)}
            </Text>
          )}
        </Box>
      </Box>
    </Screen>
  );
}
```

### Phase 6: Enhanced Features (2-3 hours)

1. **Quick Action Execution** (Enter key)
   - Launch wizard/grading/browser directly
   - Pre-populate wizard with smart defaults
   - Show success feedback

2. **Recent Conversion Actions**
   - Re-run conversion with same settings
   - Open output folder
   - View conversion logs
   - Delete conversion history item

3. **Project Stats Drill-Down**
   - Click to see detailed breakdown
   - View grade distribution chart
   - Filter by component type
   - Sort by various metrics

4. **Refresh Feedback**
   - Show spinner during refresh
   - Display "Last refreshed" timestamp
   - Show toast on completion
   - Handle errors gracefully

5. **Smart Suggestions**
   - "No components found" → Suggest checking project path
   - "Low grades detected" → Suggest reviewing grading details
   - "Failed conversions" → Suggest viewing logs

### Phase 7: Components & Utilities (2-3 hours)

**Create: `src/tui/screens/Dashboard/FirstTimeWelcome.tsx`**
- Extract first-time welcome into separate component
- Make dismissible with any key
- Show keyboard shortcuts hint
- Clean overlay design

**Create: `src/tui/screens/Dashboard/EmptyState.tsx`**
- Show when no components found
- Suggest actions (check path, scan project)
- Show loading skeleton during discovery

**Create: `src/tui/screens/Dashboard/utils.ts`**
- `formatTimeAgo(date: Date): string`
- `formatDetailedTime(date: Date): string`
- `getCategoryForItem(item: DashboardItem): string`
- `getItemIndex(items: DashboardItem[], id: string): number`

### Phase 8: Polish & Testing (2-3 hours)

- Test all keyboard navigation flows
- Verify with different terminal sizes (min 80 cols)
- Test with no components (empty state)
- Test with failed conversions
- Test refresh functionality
- Edge cases: first-time flow, errors, etc.
- Ensure arrow doesn't flicker during navigation
- Verify theme colors apply correctly

---

## File Changes Summary

### New Files
```
src/tui/screens/Dashboard/
  ├── index.tsx                 # Main Dashboard screen (two-panel)
  ├── DashboardNav.tsx          # Left panel navigation list
  ├── DashboardDetail.tsx       # Right panel detail view
  ├── dashboardItems.ts         # Item definitions and factories
  ├── FirstTimeWelcome.tsx      # First-time welcome overlay
  ├── EmptyState.tsx            # Empty state when no components
  ├── types.ts                  # DashboardState, DashboardItem types
  └── utils.ts                  # Helper functions
```

### Modified Files
```
src/tui/store/index.ts          # Add DashboardState and actions
src/tui/screens/index.ts        # Update Dashboard export path
```

### Deleted Files
```
src/tui/screens/Dashboard.tsx   # Replaced by Dashboard directory
```

---

## Component Dependencies

**Using Existing Components:**
- `Screen` (layout/Screen.tsx)
- `Spinner` (feedback/Spinner.tsx)
- `Badge` (feedback/Badge.tsx)
- `GradeDistribution` (feedback/GradeDistribution.tsx)
- `GradeBadge` (feedback/Badge.tsx)
- `Box`, `Text` from Ink

**May need new components:**
- `StatCard` (optional) - For project health cards
- `ActionButton` (optional) - For interactive quick actions

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` | Navigate to previous item in dashboard |
| `↓` | Navigate to next item in dashboard |
| `Enter` | Execute selected quick action or view item details |
| `R` | Refresh project (scan for components) |
| `C` | Quick shortcut: Convert Component |
| `G` | Quick shortcut: Grade Complexity |
| `B` | Quick shortcut: Browse Components |
| `S` | Quick shortcut: Settings |
| `O` | Open folder (when recent conversion selected) |
| `/` | Open command palette (future) |
| `Esc` | Exit application |

---

## Detailed Item Types & Actions

### Quick Action Items

1. **Convert Component**
   - Description: Launch wizard to convert Aura/VF to LWC
   - Action: `navigate('wizard')`
   - Shortcut: `[C]`
   - Detail view: Shows wizard steps, explains process

2. **Grade Complexity**
   - Description: Analyze component complexity and conversion difficulty
   - Action: `navigate('grading')`
   - Shortcut: `[G]`
   - Detail view: Shows grading criteria, sample results

3. **Browse Components**
   - Description: Explore project components in tree view
   - Action: `navigate('browser')`
   - Shortcut: `[B]`
   - Detail view: Shows component count, filter options

4. **Settings**
   - Description: Configure conversion defaults and preferences
   - Action: `navigate('settings')`
   - Shortcut: `[S]`
   - Detail view: Shows settings categories, quick toggles

### Project Stat Items

1. **Total Components**
   - Shows: Aura + VF count
   - Detail: Breakdown by type, drill-down to browser

2. **Average Grade**
   - Shows: Letter grade + numeric score
   - Detail: Grade distribution chart, drill-down to grading

3. **Conversion Rate**
   - Shows: Success/failure ratio from recent conversions
   - Detail: Success rate chart, common failure reasons

4. **Last Activity**
   - Shows: Most recent action timestamp
   - Detail: Activity log, recent operations

### Recent Conversion Items

1. **Successful Conversion**
   - Shows: Component name, timestamp, grade
   - Actions: Open folder, view details, re-run
   - Detail: Conversion settings used, output location

2. **Failed Conversion**
   - Shows: Component name, timestamp, error icon
   - Actions: View logs, retry with different settings
   - Detail: Error message, suggested fixes

---

## State Management Details

### DashboardState

```typescript
interface DashboardState {
  // Navigation
  selectedIndex: number;           // Currently focused item (0-based)
  selectedCategory: string;        // Current category context

  // Data loading
  isRefreshing: boolean;           // Component discovery in progress
  lastRefresh: Date | null;        // Last successful refresh time

  // First-time experience
  showFirstTime: boolean;          // Whether to show welcome overlay

  // View preferences (future)
  collapsedSections: Set<string>;  // Which sections are collapsed
  pinnedItems: string[];           // User-pinned quick actions
}
```

### Store Actions

```typescript
// Update dashboard state
updateDashboardState: (state: Partial<DashboardState>) => void;

// Refresh project (async)
refreshProject: () => Promise<void> {
  const { projectPath, setComponents, setProjectHealth } = get();

  set(state => ({
    dashboard: { ...state.dashboard, isRefreshing: true }
  }));

  try {
    const discovered = await discoverComponents(projectPath);
    setComponents(discovered.aura, discovered.vf);
    setProjectHealth({ /* ... */ });

    set(state => ({
      dashboard: {
        ...state.dashboard,
        isRefreshing: false,
        lastRefresh: new Date(),
      }
    }));
  } catch (error) {
    // Handle error
  }
}

// Execute quick action
executeQuickAction: (actionId: QuickActionId) => void;

// Open recent conversion
openRecentConversion: (conversionId: string) => void;

// Dismiss first-time welcome
dismissFirstTimeWelcome: () => void {
  markFirstTimeCompleteSync();
  set(state => ({
    dashboard: { ...state.dashboard, showFirstTime: false }
  }));
}
```

---

## Verification Steps

### Manual Testing

1. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

2. **Test navigation:**
   - Press ↑↓ to navigate through all dashboard items
   - Verify arrow indicator moves correctly
   - Verify detail panel updates for each item type

3. **Test quick actions:**
   - Navigate to "Convert Component", press Enter
   - Verify it launches wizard
   - Test each quick action (Grade, Browse, Settings)
   - Test shortcut keys (C, G, B, S)

4. **Test project stats:**
   - Navigate to project health stats
   - Verify detail panel shows breakdown
   - Check grade distribution chart renders

5. **Test recent conversions:**
   - Navigate to a recent conversion item
   - Press Enter to view details
   - Test "Open folder" action if available

6. **Test refresh:**
   - Press R to refresh project
   - Verify spinner shows during refresh
   - Verify "Last refresh" timestamp updates

7. **Test empty states:**
   - Run in empty project (no components)
   - Verify helpful message and suggestions

8. **Test first-time experience:**
   - Delete `~/.config/lwc-convert/first-time-complete`
   - Restart app, verify welcome overlay
   - Press any key to dismiss

9. **Test responsive layout:**
   - Resize terminal to 80 columns
   - Verify layout doesn't break
   - Resize to 120+ columns
   - Verify layout uses extra space

### Edge Cases

- No components found
- All failed conversions
- Very long component names
- 50+ recent conversions (pagination)
- Slow component discovery (loading state)
- Errors during refresh

---

## Trade-offs & Considerations

### Advantages ✅
- **Interactive**: Users can explore and select items
- **Discoverable**: See what's available without memorizing shortcuts
- **Rich context**: Detail panel shows helpful information
- **Consistent UX**: Matches Settings/GradingResults patterns
- **Extensible**: Easy to add new dashboard items/sections
- **Efficient**: Quick shortcuts still available for power users

### Disadvantages ❌
- **Complexity**: More state management than static dashboard
- **Horizontal space**: Requires ~80+ column terminal
- **Learning curve**: Users must understand two-panel navigation
- **More code**: Larger codebase to maintain

### Risk Mitigation
1. **Performance**: Memoize expensive calculations, lazy load details
2. **Terminal size**: Test on minimum 80x24 terminals, graceful degradation
3. **State sync**: Ensure store updates propagate immediately
4. **Backwards compatibility**: Keep existing shortcuts working

---

## Future Enhancements

**Not in initial implementation, but designed to support:**

1. **Customizable Dashboard**
   - Drag-and-drop to reorder sections
   - Pin/unpin quick actions
   - Hide/show sections
   - Save layout preferences

2. **Smart Suggestions**
   - Context-aware tips based on project state
   - "You haven't graded yet" → suggest grading
   - "Many low grades" → suggest reviewing
   - "No recent activity" → suggest converting

3. **Activity Log**
   - New section showing all recent operations
   - View logs for any conversion
   - Filter by type, status, date
   - Export activity report

4. **Project Comparison**
   - Compare current project with previous
   - Show improvement over time
   - Grade trends, conversion success rate

5. **Notifications Center**
   - Show warnings, errors, updates
   - "New version available"
   - "Failed conversion needs attention"
   - Dismiss or act on notifications

6. **Quick Filters**
   - Filter recent conversions by status
   - Filter components by type/grade
   - Search dashboard items

7. **Keyboard Shortcuts Customization**
   - Rebind quick action shortcuts
   - Create custom shortcuts
   - View keyboard shortcut cheat sheet

---

## Timeline Estimate

| Phase | Time | Cumulative |
|-------|------|------------|
| 1. Dashboard Item Definitions | 2-3h | 2-3h |
| 2. State Management | 1-2h | 3-5h |
| 3. Left Panel - DashboardNav | 3-4h | 6-9h |
| 4. Right Panel - DashboardDetail | 3-4h | 9-13h |
| 5. Main Screen Integration | 3-4h | 12-17h |
| 6. Enhanced Features | 2-3h | 14-20h |
| 7. Components & Utilities | 2-3h | 16-23h |
| 8. Polish & Testing | 2-3h | 18-26h |

**Total: 18-26 hours** (2.5 - 3.5 days of focused work)

---

## Critical Implementation Notes

1. **Item Flattening**: Flatten all dashboard items into a single array for navigation, but render by category

2. **State Pattern**: Follow SettingsState pattern with screen-specific state slice in store

3. **Type Safety**: Use discriminated unions for DashboardItem types

4. **Performance**: Use `useMemo` for item generation, expensive calculations

5. **Component Discovery**: Reuse existing `discoverComponents()` function, don't duplicate logic

6. **First-Time Flow**: Extract into separate component, keep as overlay (doesn't affect two-panel layout)

7. **Theme Consistency**: Use `getTheme()` hook for all styling, respect user preferences

8. **Keyboard Hooks**: Use `useKeyBindings()` with footerBindings, maintain backward compatibility with existing shortcuts

9. **Error Handling**: Gracefully handle discovery errors, show helpful empty states

10. **Loading States**: Show spinner during refresh, disable actions while loading

---

## Success Criteria

The redesigned Dashboard will be considered successful if:

1. ✅ Users can navigate all dashboard items with keyboard
2. ✅ Quick actions are discoverable and executable from dashboard
3. ✅ Project stats show rich details in detail panel
4. ✅ Recent conversions are interactive (view, re-run, open folder)
5. ✅ Refresh functionality works reliably
6. ✅ First-time experience remains helpful and non-intrusive
7. ✅ Layout works on 80-column terminals
8. ✅ Navigation is smooth without visual glitches
9. ✅ All existing shortcuts continue to work
10. ✅ Codebase is maintainable and extensible

---

## Mockups & Visual Design

### Color Scheme (using existing theme)
- **Primary**: Section headers, important labels
- **Accent**: Focused arrow, keyboard shortcuts
- **Success**: ✓ success indicators
- **Error**: ✗ failure indicators
- **TextMuted**: Timestamps, hints, helper text
- **Border**: Panel borders

### Typography
- **Bold**: Section headers, item labels
- **Regular**: Body text, descriptions
- **Muted**: Secondary information

### Icons (existing pattern)
- 📦 Aura components
- 📄 Visualforce pages
- 📊 Statistics/analytics
- 🎯 Goals/targets
- ✓ Success
- ✗ Failure
- ▶ Focus indicator
- ⚡ Quick action

---

## Questions for Clarification

Before implementation, consider:

1. Should quick actions be executable from detail panel with dedicated buttons?
2. Should recent conversions support batch actions (re-run multiple)?
3. Should project stats show trend indicators (↑↓) for changes over time?
4. Should there be a "Pinned" section for user's favorite actions?
5. Should command palette be accessible from dashboard?
6. Should dashboard remember last selected item across sessions?
7. Should there be a "Tips of the day" rotating section?

---

## Migration Path

To migrate from current Dashboard to redesigned Dashboard:

1. **Phase 1**: Create new Dashboard directory alongside old Dashboard.tsx
2. **Phase 2**: Implement new components without removing old
3. **Phase 3**: Add feature flag `useNewDashboard` in preferences
4. **Phase 4**: Test both versions in parallel
5. **Phase 5**: Once stable, default to new dashboard
6. **Phase 6**: Remove old Dashboard.tsx after 1-2 releases
7. **Phase 7**: Remove feature flag

This allows rollback if issues arise and gives users time to adapt.
