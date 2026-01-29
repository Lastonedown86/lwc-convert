/**
 * Logger utility for colored console output with enhanced UX
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

// Icons for visual feedback
const ICONS = {
  success: '✓',
  error: '✗',
  warn: '⚠',
  info: 'ℹ',
  step: '→',
  file: '+',
  folder: '📁',
  component: '⚡',
  test: '🧪',
  docs: '📄',
  aura: '🌀',
  vf: '📋',
};

// Warning categories for aggregation
const WARNING_CATEGORIES: { pattern: RegExp; label: string; icon: string }[] = [
  { pattern: /apex|@auraenabled|controller/i, label: 'Apex Dependencies', icon: '⚙️' },
  { pattern: /event|handler|fire|dispatch/i, label: 'Event Handling', icon: '📡' },
  { pattern: /aura:attribute|v\.|attribute/i, label: 'Attributes/Properties', icon: '📝' },
  { pattern: /label|custom label|\$label/i, label: 'Custom Labels', icon: '🏷️' },
  { pattern: /static resource|ltng:require/i, label: 'Static Resources', icon: '📦' },
  { pattern: /permission|access|sharing/i, label: 'Permissions', icon: '🔒' },
  { pattern: /force:|ui:|lightning:/i, label: 'Base Components', icon: '🧱' },
  { pattern: /css|style|slds/i, label: 'Styling', icon: '🎨' },
  { pattern: /navigate|pageref|url/i, label: 'Navigation', icon: '🧭' },
  { pattern: /aura:if|aura:iteration|render/i, label: 'Conditional/Loop', icon: '🔄' },
];

export interface WarningCategory {
  label: string;
  icon: string;
  count: number;
  examples: string[];
}

export interface LoggerOptions {
  verbose: boolean;
}

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  // Brand banner for tool startup
  banner(): void {
    console.log('');
    console.log(`${COLORS.bright}${COLORS.cyan}  ╭─────────────────────────────────────────────╮${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}  │${COLORS.reset}  ${COLORS.bright}${COLORS.yellow}⚡ LWC Convert${COLORS.reset}                            ${COLORS.cyan}│${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}  │${COLORS.reset}  ${COLORS.dim}Aura & Visualforce → Lightning Web Components${COLORS.reset} ${COLORS.cyan}│${COLORS.reset}`);
    console.log(`${COLORS.bright}${COLORS.cyan}  ╰─────────────────────────────────────────────╯${COLORS.reset}`);
    console.log('');
  }

  info(message: string): void {
    console.log(`${COLORS.blue}${ICONS.info}${COLORS.reset}  ${message}`);
  }

  success(message: string): void {
    console.log(`${COLORS.green}${ICONS.success}${COLORS.reset}  ${message}`);
  }

  warn(message: string): void {
    console.log(`${COLORS.yellow}${ICONS.warn}${COLORS.reset}  ${message}`);
  }

  error(message: string): void {
    console.error(`${COLORS.red}${ICONS.error}${COLORS.reset}  ${message}`);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(`${COLORS.dim}   ${message}${COLORS.reset}`);
    }
  }

  // Step indicator with better visual hierarchy
  step(stepNumber: number, message: string): void {
    console.log(`${COLORS.cyan}${ICONS.step}${COLORS.reset}  ${COLORS.dim}Step ${stepNumber}:${COLORS.reset} ${message}`);
  }

  // Section header
  header(message: string): void {
    console.log('');
    console.log(`${COLORS.bright}${COLORS.white}  ${message}${COLORS.reset}`);
    console.log(`${COLORS.dim}  ${'─'.repeat(message.length + 2)}${COLORS.reset}`);
  }

  // Sub-section for grouping related output
  subheader(message: string): void {
    console.log(`\n${COLORS.dim}  ${message}${COLORS.reset}`);
  }

  divider(): void {
    console.log('');
  }

  // File creation with icon
  file(action: string, filePath: string): void {
    const icon = filePath.includes('__tests__') ? ICONS.test : 
                 filePath.endsWith('.md') ? ICONS.docs : ICONS.file;
    console.log(`   ${COLORS.green}${icon}${COLORS.reset} ${COLORS.dim}${action}${COLORS.reset} ${filePath}`);
  }

  // Conversion arrow
  conversion(from: string, to: string): void {
    console.log(`   ${COLORS.yellow}${from}${COLORS.reset} ${COLORS.dim}→${COLORS.reset} ${COLORS.green}${to}${COLORS.reset}`);
  }

  // Todo/action item
  todo(message: string): void {
    console.log(`   ${COLORS.yellow}○${COLORS.reset} ${message}`);
  }

  // Completed item
  done(message: string): void {
    console.log(`   ${COLORS.green}●${COLORS.reset} ${message}`);
  }

  // Summary box for final output
  summaryBox(title: string, items: { label: string; value: string; type?: 'success' | 'warn' | 'info' }[]): void {
    console.log('');
    console.log(`${COLORS.bright}  ${title}${COLORS.reset}`);
    console.log(`${COLORS.dim}  ${'─'.repeat(40)}${COLORS.reset}`);
    
    for (const item of items) {
      const color = item.type === 'success' ? COLORS.green : 
                    item.type === 'warn' ? COLORS.yellow : COLORS.white;
      console.log(`   ${COLORS.dim}${item.label}:${COLORS.reset} ${color}${item.value}${COLORS.reset}`);
    }
    console.log('');
  }

  // Next steps guidance
  nextSteps(steps: string[]): void {
    console.log(`${COLORS.bright}  Next Steps${COLORS.reset}`);
    console.log(`${COLORS.dim}  ${'─'.repeat(40)}${COLORS.reset}`);
    steps.forEach((step, i) => {
      console.log(`   ${COLORS.cyan}${i + 1}.${COLORS.reset} ${step}`);
    });
    console.log('');
  }

  // Blank line
  blank(): void {
    console.log('');
  }

  // Categorize warnings into groups for summary display
  categorizeWarnings(warnings: string[]): WarningCategory[] {
    const categories: Map<string, WarningCategory> = new Map();
    const uncategorized: string[] = [];

    for (const warning of warnings) {
      let matched = false;
      for (const cat of WARNING_CATEGORIES) {
        if (cat.pattern.test(warning)) {
          const existing = categories.get(cat.label);
          if (existing) {
            existing.count++;
            if (existing.examples.length < 2) {
              existing.examples.push(warning);
            }
          } else {
            categories.set(cat.label, {
              label: cat.label,
              icon: cat.icon,
              count: 1,
              examples: [warning],
            });
          }
          matched = true;
          break;
        }
      }
      if (!matched) {
        uncategorized.push(warning);
      }
    }

    // Add uncategorized warnings as "Other"
    if (uncategorized.length > 0) {
      categories.set('Other', {
        label: 'Other',
        icon: '📋',
        count: uncategorized.length,
        examples: uncategorized.slice(0, 2),
      });
    }

    return Array.from(categories.values()).sort((a, b) => b.count - a.count);
  }

  // Display warning summary by category
  warningSummary(warnings: string[], verbose: boolean = false): void {
    if (warnings.length === 0) return;

    const categories = this.categorizeWarnings(warnings);

    console.log('');
    console.log(`${COLORS.yellow}${COLORS.bright}  ⚠ Warning Summary (${warnings.length} total)${COLORS.reset}`);
    console.log(`${COLORS.dim}  ${'─'.repeat(40)}${COLORS.reset}`);

    for (const cat of categories) {
      console.log(`   ${cat.icon} ${COLORS.yellow}${cat.count}${COLORS.reset} ${cat.label}`);
      if (verbose && cat.examples.length > 0) {
        for (const example of cat.examples) {
          const truncated = example.length > 60 ? example.substring(0, 57) + '...' : example;
          console.log(`      ${COLORS.dim}• ${truncated}${COLORS.reset}`);
        }
      }
    }

    if (!verbose && warnings.length > 3) {
      console.log(`\n   ${COLORS.dim}Run with --verbose to see all warning details${COLORS.reset}`);
    }
    console.log('');
  }

  // Smart mode recommendation based on grading results
  modeRecommendation(avgGrade: string, avgScore: number, totalWarnings: number, componentCount: number): void {
    const isComplex = ['D', 'F'].includes(avgGrade) || avgScore < 50;
    const hasHighWarnings = totalWarnings / Math.max(componentCount, 1) > 5;
    const isSimple = ['A', 'B'].includes(avgGrade) && avgScore >= 75;

    console.log('');
    console.log(`${COLORS.bright}${COLORS.cyan}  💡 Conversion Mode Recommendation${COLORS.reset}`);
    console.log(`${COLORS.dim}  ${'─'.repeat(40)}${COLORS.reset}`);

    if (isComplex || hasHighWarnings) {
      console.log(`   ${COLORS.yellow}📝 Scaffolding Mode${COLORS.reset} ${COLORS.bright}(Recommended)${COLORS.reset}`);
      console.log(`   ${COLORS.dim}Your components have ${isComplex ? 'high complexity' : 'many warnings'}.${COLORS.reset}`);
      console.log(`   ${COLORS.dim}Scaffolding generates a skeleton with TODOs for${COLORS.reset}`);
      console.log(`   ${COLORS.dim}manual completion - safer for complex conversions.${COLORS.reset}`);
      console.log('');
      console.log(`   ${COLORS.dim}Run:${COLORS.reset} lwc-convert aura <component>`);
    } else if (isSimple) {
      console.log(`   ${COLORS.green}⚡ Full Conversion${COLORS.reset} ${COLORS.bright}(May work well)${COLORS.reset}`);
      console.log(`   ${COLORS.dim}Your components scored well (${avgGrade}, ${avgScore}/100).${COLORS.reset}`);
      console.log(`   ${COLORS.dim}Full conversion attempts complete transformation.${COLORS.reset}`);
      console.log(`   ${COLORS.dim}Review output carefully and test thoroughly.${COLORS.reset}`);
      console.log('');
      console.log(`   ${COLORS.dim}Run:${COLORS.reset} lwc-convert aura <component> --full`);
    } else {
      console.log(`   ${COLORS.yellow}📝 Scaffolding Mode${COLORS.reset} ${COLORS.bright}(Recommended)${COLORS.reset}`);
      console.log(`   ${COLORS.dim}For moderate complexity, scaffolding provides a${COLORS.reset}`);
      console.log(`   ${COLORS.dim}safe starting point with clear TODO markers.${COLORS.reset}`);
      console.log('');
      console.log(`   ${COLORS.dim}Run:${COLORS.reset} lwc-convert aura <component>`);
    }
    console.log('');
  }

  // Success toast for completed operations
  successToast(title: string, details: string[], outputPath?: string): void {
    console.log('');
    console.log(`${COLORS.green}  ╭─────────────────────────────────────────╮${COLORS.reset}`);
    console.log(`${COLORS.green}  │${COLORS.reset}                                         ${COLORS.green}│${COLORS.reset}`);
    console.log(`${COLORS.green}  │${COLORS.reset}            ${COLORS.bright}✨ Success! ✨${COLORS.reset}               ${COLORS.green}│${COLORS.reset}`);
    console.log(`${COLORS.green}  │${COLORS.reset}                                         ${COLORS.green}│${COLORS.reset}`);

    details.forEach(detail => {
      const padded = detail.padEnd(38);
      console.log(`${COLORS.green}  │${COLORS.reset}  ${padded} ${COLORS.green}│${COLORS.reset}`);
    });

    if (outputPath) {
      console.log(`${COLORS.green}  │${COLORS.reset}                                         ${COLORS.green}│${COLORS.reset}`);
      const pathText = `📁 ${outputPath}`.padEnd(38);
      console.log(`${COLORS.green}  │${COLORS.reset}  ${pathText} ${COLORS.green}│${COLORS.reset}`);
    }

    console.log(`${COLORS.green}  │${COLORS.reset}                                         ${COLORS.green}│${COLORS.reset}`);
    console.log(`${COLORS.green}  ╰─────────────────────────────────────────╯${COLORS.reset}`);
    console.log('');
  }
}

export const logger = new Logger();
