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
}

export const logger = new Logger();
