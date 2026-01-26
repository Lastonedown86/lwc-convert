/**
 * Interactive TUI for Grade Complexity
 * Provides keyboard navigation, color-coded grades, and drill-down details
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { ComponentGrade, GradingSummary } from '../../grading/types';

interface TuiState {
  components: ComponentGrade[];
  summary: GradingSummary;
  selectedIndex: number;
  scrollOffset: number;
  viewMode: 'list' | 'detail';
  sortBy: 'score' | 'name' | 'complexity' | 'type';
  filterGrade: string | null;
  searchQuery: string;
  isSearching: boolean;
}

const VISIBLE_ROWS = 15;

/**
 * Get color for grade
 */
function getGradeColor(grade: string): chalk.Chalk {
  switch (grade) {
    case 'A': return chalk.green;
    case 'B': return chalk.cyan;
    case 'C': return chalk.yellow;
    case 'D': return chalk.rgb(255, 165, 0); // Orange
    case 'F': return chalk.red;
    default: return chalk.white;
  }
}

/**
 * Get complexity color
 */
function getComplexityColor(complexity: string): chalk.Chalk {
  switch (complexity) {
    case 'Simple': return chalk.green;
    case 'Easy': return chalk.cyan;
    case 'Moderate': return chalk.yellow;
    case 'Complex': return chalk.rgb(255, 165, 0);
    case 'Very Complex': return chalk.red;
    default: return chalk.white;
  }
}

/**
 * Format a grade badge
 */
function gradeBadge(grade: string): string {
  const color = getGradeColor(grade);
  return color.bold(` ${grade} `);
}

/**
 * Clear screen and move cursor to top
 */
function clearScreen(): void {
  process.stdout.write('\x1B[2J\x1B[0f');
}

/**
 * Hide cursor
 */
function hideCursor(): void {
  process.stdout.write('\x1B[?25l');
}

/**
 * Show cursor
 */
function showCursor(): void {
  process.stdout.write('\x1B[?25h');
}

/**
 * Render the header
 */
function renderHeader(state: TuiState): string {
  const lines: string[] = [];

  lines.push(chalk.bgBlue.white.bold(' LWC Convert: Complexity Grading '));
  lines.push('');

  // Controls
  const controls = [
    chalk.dim('[↑↓]') + ' Navigate',
    chalk.dim('[Enter]') + ' Details',
    chalk.dim('[s]') + ' Sort',
    chalk.dim('[f]') + ' Filter',
    chalk.dim('[/]') + ' Search',
    chalk.dim('[q]') + ' Quit',
  ];
  lines.push(controls.join('  '));
  lines.push('');

  // Current sort/filter status
  const status: string[] = [];
  status.push(chalk.dim('Sort: ') + chalk.cyan(state.sortBy));
  if (state.filterGrade) {
    status.push(chalk.dim('Filter: ') + chalk.yellow(`Grade ${state.filterGrade}`));
  }
  if (state.searchQuery) {
    status.push(chalk.dim('Search: ') + chalk.yellow(state.searchQuery));
  }
  lines.push(status.join('  │  '));
  lines.push('');

  return lines.join('\n');
}

/**
 * Render the component list
 */
function renderList(state: TuiState): string {
  const lines: string[] = [];

  // Column headers
  const header =
    chalk.dim('   ') +
    chalk.bold('Component'.padEnd(28)) +
    chalk.bold('Type'.padEnd(8)) +
    chalk.bold('Score'.padEnd(8)) +
    chalk.bold('Grade'.padEnd(8)) +
    chalk.bold('Complexity');
  lines.push(header);
  lines.push(chalk.dim('─'.repeat(75)));

  // Filter components
  let filtered = [...state.components];
  if (state.filterGrade) {
    filtered = filtered.filter(c => c.letterGrade === state.filterGrade);
  }
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.componentName.toLowerCase().includes(query) ||
      c.componentType.toLowerCase().includes(query)
    );
  }

  // Sort components
  sortComponents(filtered, state.sortBy);

  // Calculate visible range
  const totalItems = filtered.length;
  const startIdx = state.scrollOffset;
  const endIdx = Math.min(startIdx + VISIBLE_ROWS, totalItems);

  // Render visible rows
  for (let i = startIdx; i < endIdx; i++) {
    const comp = filtered[i];
    const isSelected = i === state.selectedIndex;

    const prefix = isSelected ? chalk.cyan('›') : ' ';
    const name = comp.componentName.length > 26
      ? comp.componentName.substring(0, 23) + '...'
      : comp.componentName;

    const gradeColor = getGradeColor(comp.letterGrade);
    const complexityColor = getComplexityColor(comp.complexity);

    let row =
      ` ${prefix} ` +
      name.padEnd(28) +
      comp.componentType.padEnd(8) +
      comp.overallScore.toString().padEnd(8) +
      gradeColor.bold(comp.letterGrade.padEnd(8)) +
      complexityColor(comp.complexity);

    if (isSelected) {
      row = chalk.bgGray(row);
    }

    lines.push(row);
  }

  // Pad remaining rows
  for (let i = endIdx - startIdx; i < VISIBLE_ROWS; i++) {
    lines.push('');
  }

  // Scrollbar indicator
  if (totalItems > VISIBLE_ROWS) {
    const scrollPercent = Math.round((state.selectedIndex / (totalItems - 1)) * 100);
    lines.push(chalk.dim(`─── ${state.selectedIndex + 1}/${totalItems} (${scrollPercent}%) ${'─'.repeat(50)}`));
  } else {
    lines.push(chalk.dim('─'.repeat(75)));
  }

  return lines.join('\n');
}

/**
 * Render the summary footer
 */
function renderSummary(state: TuiState): string {
  const lines: string[] = [];
  const s = state.summary;

  lines.push('');

  // Grade distribution bar
  const total = s.totalComponents || 1;
  const dist = s.distribution || { A: 0, B: 0, C: 0, D: 0, F: 0 };

  const bar = [
    chalk.green('█'.repeat(Math.round((dist.A / total) * 30))),
    chalk.cyan('█'.repeat(Math.round((dist.B / total) * 30))),
    chalk.yellow('█'.repeat(Math.round((dist.C / total) * 30))),
    chalk.rgb(255, 165, 0)('█'.repeat(Math.round((dist.D / total) * 30))),
    chalk.red('█'.repeat(Math.round((dist.F / total) * 30))),
  ].join('');

  lines.push(chalk.dim('Grade Distribution: ') + bar);
  lines.push(
    chalk.green(`A:${dist.A}`) + '  ' +
    chalk.cyan(`B:${dist.B}`) + '  ' +
    chalk.yellow(`C:${dist.C}`) + '  ' +
    chalk.rgb(255, 165, 0)(`D:${dist.D}`) + '  ' +
    chalk.red(`F:${dist.F}`)
  );
  lines.push('');

  // Summary stats
  const stats = [
    chalk.dim('Total: ') + chalk.white.bold(s.totalComponents.toString()),
    chalk.dim('Avg Score: ') + chalk.white.bold(`${s.averageScore}`),
    chalk.dim('Avg Grade: ') + getGradeColor(s.averageGrade).bold(s.averageGrade),
    chalk.dim('Est. Effort: ') + chalk.yellow.bold(`${s.totalEffort?.manualHours?.estimate || '?'} hrs`),
  ];
  lines.push(stats.join('  │  '));

  return lines.join('\n');
}

/**
 * Render detail view for a component
 */
function renderDetailView(state: TuiState): string {
  const lines: string[] = [];
  const comp = state.components[state.selectedIndex];

  if (!comp) return '';

  lines.push(chalk.bgBlue.white.bold(` Component Details `));
  lines.push('');
  lines.push(chalk.dim('[Esc/Enter]') + ' Back to list');
  lines.push('');

  // Component header
  const gradeColor = getGradeColor(comp.letterGrade);
  lines.push(
    chalk.bold.white(comp.componentName) + '  ' +
    gradeColor.bold(`[${comp.letterGrade}]`) + '  ' +
    chalk.dim(comp.componentType)
  );
  lines.push('');

  // Score breakdown
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push(chalk.bold('Score: ') + chalk.white.bold(`${comp.overallScore}/100`));
  lines.push(chalk.bold('Complexity: ') + getComplexityColor(comp.complexity)(comp.complexity));
  lines.push(chalk.bold('File: ') + chalk.dim(comp.filePath || 'N/A'));
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push('');

  // Complexity factors
  lines.push(chalk.bold.underline('Complexity Factors:'));
  lines.push('');

  if (comp.complexityFactors && comp.complexityFactors.length > 0) {
    // Group by category
    const grouped = new Map<string, string[]>();
    for (const factor of comp.complexityFactors) {
      const category = factor.category || 'General';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(factor.factor);
    }

    for (const [category, factors] of grouped) {
      lines.push(chalk.cyan.bold(`  ${category}:`));
      for (const factor of factors) {
        lines.push(chalk.dim('    • ') + factor);
      }
      lines.push('');
    }
  } else {
    lines.push(chalk.green('  ✓ No significant complexity factors'));
  }

  // Recommendations
  if (comp.recommendations && comp.recommendations.length > 0) {
    lines.push('');
    lines.push(chalk.bold.underline('Recommendations:'));
    for (const rec of comp.recommendations) {
      lines.push(chalk.yellow('  → ') + rec);
    }
  }

  return lines.join('\n');
}

/**
 * Sort components by given criteria
 */
function sortComponents(components: ComponentGrade[], sortBy: string): void {
  switch (sortBy) {
    case 'score':
      components.sort((a, b) => a.overallScore - b.overallScore);
      break;
    case 'name':
      components.sort((a, b) => a.componentName.localeCompare(b.componentName));
      break;
    case 'complexity': {
      const complexityOrder: Record<string, number> = {
        'Very Complex': 0, 'Complex': 1, 'Moderate': 2, 'Easy': 3, 'Simple': 4
      };
      components.sort((a, b) => complexityOrder[a.complexity] - complexityOrder[b.complexity]);
      break;
    }
    case 'type':
      components.sort((a, b) => a.componentType.localeCompare(b.componentType));
      break;
  }
}

/**
 * Main render function
 */
function render(state: TuiState): void {
  clearScreen();

  let output: string;

  if (state.viewMode === 'detail') {
    output = renderDetailView(state);
  } else {
    output = [
      renderHeader(state),
      renderList(state),
      renderSummary(state),
    ].join('\n');
  }

  // Search input line
  if (state.isSearching) {
    output += '\n' + chalk.yellow('Search: ') + state.searchQuery + chalk.cyan('_');
  }

  process.stdout.write(output);
}

/**
 * Cycle to next sort option
 */
function cycleSort(state: TuiState): void {
  const sortOptions: TuiState['sortBy'][] = ['score', 'name', 'complexity', 'type'];
  const currentIdx = sortOptions.indexOf(state.sortBy);
  state.sortBy = sortOptions[(currentIdx + 1) % sortOptions.length];
  state.selectedIndex = 0;
  state.scrollOffset = 0;
}

/**
 * Cycle grade filter
 */
function cycleFilter(state: TuiState): void {
  const filterOptions = [null, 'A', 'B', 'C', 'D', 'F'];
  const currentIdx = filterOptions.indexOf(state.filterGrade);
  state.filterGrade = filterOptions[(currentIdx + 1) % filterOptions.length];
  state.selectedIndex = 0;
  state.scrollOffset = 0;
}

/**
 * Get filtered component count
 */
function getFilteredCount(state: TuiState): number {
  let filtered = state.components;
  if (state.filterGrade) {
    filtered = filtered.filter(c => c.letterGrade === state.filterGrade);
  }
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.componentName.toLowerCase().includes(query) ||
      c.componentType.toLowerCase().includes(query)
    );
  }
  return filtered.length;
}

/**
 * Launch the interactive TUI
 */
export async function launchGradeTui(
  components: ComponentGrade[],
  summary: GradingSummary
): Promise<void> {
  // Check if running in TTY
  if (!process.stdin.isTTY) {
    console.log(chalk.yellow('Interactive mode not available. Outputting static report.'));
    return;
  }

  const state: TuiState = {
    components,
    summary,
    selectedIndex: 0,
    scrollOffset: 0,
    viewMode: 'list',
    sortBy: 'score',
    filterGrade: null,
    searchQuery: '',
    isSearching: false,
  };

  // Initial sort
  sortComponents(state.components, state.sortBy);

  // Set up terminal
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  hideCursor();

  // Initial render
  render(state);

  return new Promise((resolve) => {
    const handleKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key) return;

      // Handle search mode
      if (state.isSearching) {
        if (key.name === 'escape' || key.name === 'return') {
          state.isSearching = false;
        } else if (key.name === 'backspace') {
          state.searchQuery = state.searchQuery.slice(0, -1);
          state.selectedIndex = 0;
          state.scrollOffset = 0;
        } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
          state.searchQuery += str;
          state.selectedIndex = 0;
          state.scrollOffset = 0;
        }
        render(state);
        return;
      }

      const filteredCount = getFilteredCount(state);

      // Handle different keys
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        // Quit
        showCursor();
        clearScreen();
        process.stdin.setRawMode(false);
        resolve();
        return;
      }

      if (state.viewMode === 'detail') {
        // In detail view, any key goes back to list
        if (key.name === 'escape' || key.name === 'return' || key.name === 'backspace') {
          state.viewMode = 'list';
        }
      } else {
        // List view navigation
        switch (key.name) {
          case 'up':
            if (state.selectedIndex > 0) {
              state.selectedIndex--;
              if (state.selectedIndex < state.scrollOffset) {
                state.scrollOffset = state.selectedIndex;
              }
            }
            break;

          case 'down':
            if (state.selectedIndex < filteredCount - 1) {
              state.selectedIndex++;
              if (state.selectedIndex >= state.scrollOffset + VISIBLE_ROWS) {
                state.scrollOffset = state.selectedIndex - VISIBLE_ROWS + 1;
              }
            }
            break;

          case 'pageup':
            state.selectedIndex = Math.max(0, state.selectedIndex - VISIBLE_ROWS);
            state.scrollOffset = Math.max(0, state.scrollOffset - VISIBLE_ROWS);
            break;

          case 'pagedown':
            state.selectedIndex = Math.min(filteredCount - 1, state.selectedIndex + VISIBLE_ROWS);
            state.scrollOffset = Math.min(
              Math.max(0, filteredCount - VISIBLE_ROWS),
              state.scrollOffset + VISIBLE_ROWS
            );
            break;

          case 'return':
            state.viewMode = 'detail';
            break;

          case 'escape':
            // Clear search/filter
            state.searchQuery = '';
            state.filterGrade = null;
            state.selectedIndex = 0;
            state.scrollOffset = 0;
            break;

          default:
            // Letter shortcuts
            if (str === 's') {
              cycleSort(state);
            } else if (str === 'f') {
              cycleFilter(state);
            } else if (str === '/') {
              state.isSearching = true;
              state.searchQuery = '';
            }
        }
      }

      render(state);
    };

    process.stdin.on('keypress', handleKeypress);
  });
}

/**
 * Check if interactive mode should be used
 */
export function shouldUseInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}
