/**
 * Interactive TUI for lwc-convert CLI
 * Redesigned with @clack/prompts for a modern, polished experience
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import * as path from 'path';
import * as fs from 'fs-extra';
import { DEFAULT_OUTPUT_DIR } from './options';
import {
  findVfControllers,
  VfControllerReference,
  getControllerTypeLabel
} from '../utils/vf-controller-resolver';

export interface TuiAnswers {
  conversionType: 'aura' | 'vf';
  componentPath: string;
  controllerPath?: string;
  controllerPaths?: string[];
  detectedControllers?: VfControllerReference[];
  outputDir: string;
  conversionMode: 'scaffolding' | 'full';
  openFolder: boolean;
  preview: boolean;
}

// Step definitions for breadcrumbs
const STEPS = ['Type', 'Source', 'Controllers', 'Options', 'Confirm'] as const;

/**
 * Display breadcrumb navigation showing current progress
 */
function showBreadcrumbs(currentStep: number, conversionType?: 'aura' | 'vf'): void {
  const breadcrumb = STEPS.map((step, i) => {
    // Skip Controllers step for Aura
    if (step === 'Controllers' && conversionType === 'aura') {
      return null;
    }

    if (i < currentStep) {
      return color.green(`✓ ${step}`);
    } else if (i === currentStep) {
      return color.cyan(`● ${step}`);
    } else {
      return color.dim(step);
    }
  }).filter(Boolean).join(color.dim(' → '));

  console.log(`\n${color.dim('📍')} ${breadcrumb}\n`);
}

/**
 * Find available Aura components in the project
 */
async function findAuraComponents(): Promise<{ value: string; label: string; hint?: string }[]> {
  const searchPaths = [
    'force-app/main/default/aura',
    'src/aura',
    'aura',
  ];

  const components: { value: string; label: string; hint?: string }[] = [];
  const cwd = process.cwd();

  for (const searchPath of searchPaths) {
    const fullPath = path.join(cwd, searchPath);
    if (await fs.pathExists(fullPath)) {
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const cmpFile = path.join(fullPath, entry.name, `${entry.name}.cmp`);
            if (await fs.pathExists(cmpFile)) {
              components.push({
                value: path.join(searchPath, entry.name),
                label: `⚡ ${entry.name}`,
                hint: searchPath,
              });
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return components;
}

/**
 * Find available Visualforce pages in the project
 */
async function findVfPages(): Promise<{ value: string; label: string; hint?: string }[]> {
  const searchPaths = [
    'force-app/main/default/pages',
    'src/pages',
    'pages',
  ];

  const pages: { value: string; label: string; hint?: string }[] = [];
  const cwd = process.cwd();

  for (const searchPath of searchPaths) {
    const fullPath = path.join(cwd, searchPath);
    if (await fs.pathExists(fullPath)) {
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.page')) {
            pages.push({
              value: path.join(searchPath, entry.name),
              label: `📄 ${entry.name.replace('.page', '')}`,
              hint: searchPath,
            });
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return pages;
}

/**
 * Find available Apex controllers in the project
 */
async function findApexControllers(): Promise<{ value: string; label: string }[]> {
  const searchPaths = [
    'force-app/main/default/classes',
    'src/classes',
    'classes',
  ];

  const controllers: { value: string; label: string }[] = [];
  const cwd = process.cwd();

  for (const searchPath of searchPaths) {
    const fullPath = path.join(cwd, searchPath);
    if (await fs.pathExists(fullPath)) {
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.cls')) {
            controllers.push({
              value: path.join(searchPath, entry.name),
              label: `📋 ${entry.name.replace('.cls', '')}`,
            });
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return controllers;
}

/**
 * Check if user cancelled
 */
function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

/**
 * Handle cancellation
 */
function handleCancel(): null {
  p.cancel('Operation cancelled.');
  return null;
}

/**
 * Clear the terminal screen
 */
function clearScreen(): void {
  // Use platform-specific clear command
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // Synchronously execute cls on Windows
    require('child_process').execSync('cls', { stdio: 'inherit' });
  } else {
    // Use ANSI escape codes on Unix-like systems
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

/**
 * Display the welcome header
 */
function showHeader(): void {
  clearScreen();
  p.intro(color.bgCyan(color.black(' 🔄 LWC Convert ')));
  p.note(
    'Convert Aura & Visualforce to Lightning Web Components\n' +
    color.dim('Use arrow keys to navigate, Enter to select, Ctrl+C to cancel'),
    'Welcome'
  );
}

/**
 * Run the interactive TUI
 */
export async function runInteractiveTui(): Promise<TuiAnswers | null> {
  showHeader();

  // State management
  let currentStep = 0;
  let conversionType: 'aura' | 'vf' | undefined;
  let componentPath: string | undefined;
  let controllerPath: string | undefined;
  let controllerPaths: string[] = [];
  let detectedControllers: VfControllerReference[] = [];
  let outputDir: string = DEFAULT_OUTPUT_DIR;
  let conversionMode: 'scaffolding' | 'full' = 'scaffolding';
  let openFolder: boolean = true;
  let preview: boolean = false;

  // Main wizard loop - allows navigation back to any step
  wizardLoop: while (currentStep < 4) {
    // Step 1: Select conversion type
    while (currentStep === 0) {
      showBreadcrumbs(currentStep);

      const typeResult = await p.select({
        message: 'What would you like to convert?',
        options: [
          { value: 'aura', label: '⚡ Aura Component → LWC', hint: 'Convert Aura bundles' },
          { value: 'vf', label: '📄 Visualforce Page → LWC', hint: 'Convert VF pages' },
        ],
      });

      if (isCancel(typeResult)) return handleCancel();
      conversionType = typeResult as 'aura' | 'vf';
      currentStep = 1;
    }

    // Step 2: Select source component/page
    while (currentStep === 1) {
      showBreadcrumbs(currentStep, conversionType);

      if (conversionType === 'aura') {
        const s = p.spinner();
        s.start('Scanning for Aura components...');
        const auraComponents = await findAuraComponents();
        s.stop('Scan complete');

        if (auraComponents.length > 0) {
          const sourceResult = await p.select({
            message: 'Select an Aura component:',
            options: [
              ...auraComponents,
              { value: '__custom__', label: '📝 Enter path manually...', hint: 'Type a custom path' },
              { value: '__back__', label: color.yellow('← Back'), hint: 'Return to previous step' },
            ],
          });

          if (isCancel(sourceResult)) return handleCancel();

          if (sourceResult === '__back__') {
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }

          if (sourceResult === '__custom__') {
            const customPath = await p.text({
              message: 'Enter the path to the Aura component:',
              placeholder: 'force-app/main/default/aura/MyComponent (leave blank to go back)',
            });
            if (isCancel(customPath)) return handleCancel();
            if (!customPath || !(customPath as string).trim()) {
              // User left blank - go back to selection
              continue;
            }
            componentPath = customPath as string;
          } else {
            componentPath = sourceResult as string;
          }
        } else {
          p.log.warn('No Aura components found in project');

          const actionResult = await p.select({
            message: 'What would you like to do?',
            options: [
              { value: '__custom__', label: '📝 Enter path manually', hint: 'Type a custom path' },
              { value: '__back__', label: color.yellow('← Back to menu'), hint: 'Return to conversion type selection' },
            ],
          });

          if (isCancel(actionResult)) return handleCancel();

          if (actionResult === '__back__') {
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }

          const customPath = await p.text({
            message: 'Enter the path to the Aura component:',
            placeholder: 'force-app/main/default/aura/MyComponent (leave blank to go back)',
          });
          if (isCancel(customPath)) return handleCancel();
          if (!customPath || !(customPath as string).trim()) {
            // User left blank - go back to type selection
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }
          componentPath = customPath as string;
        }

        // Skip controllers step for Aura
        currentStep = 3;
      } else {
        // VF page selection
        const s = p.spinner();
        s.start('Scanning for Visualforce pages...');
        const vfPages = await findVfPages();
        s.stop('Scan complete');

        if (vfPages.length > 0) {
          const sourceResult = await p.select({
            message: 'Select a Visualforce page:',
            options: [
              ...vfPages,
              { value: '__custom__', label: '📝 Enter path manually...', hint: 'Type a custom path' },
              { value: '__back__', label: color.yellow('← Back'), hint: 'Return to previous step' },
            ],
          });

          if (isCancel(sourceResult)) return handleCancel();

          if (sourceResult === '__back__') {
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }

          if (sourceResult === '__custom__') {
            const customPath = await p.text({
              message: 'Enter the path to the Visualforce page:',
              placeholder: 'force-app/main/default/pages/MyPage.page (leave blank to go back)',
            });
            if (isCancel(customPath)) return handleCancel();
            if (!customPath || !(customPath as string).trim()) {
              // User left blank - go back to selection
              continue;
            }
            componentPath = customPath as string;
          } else {
            componentPath = sourceResult as string;
          }
        } else {
          p.log.warn('No Visualforce pages found in project');

          const actionResult = await p.select({
            message: 'What would you like to do?',
            options: [
              { value: '__custom__', label: '📝 Enter path manually', hint: 'Type a custom path' },
              { value: '__back__', label: color.yellow('← Back to menu'), hint: 'Return to conversion type selection' },
            ],
          });

          if (isCancel(actionResult)) return handleCancel();

          if (actionResult === '__back__') {
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }

          const customPath = await p.text({
            message: 'Enter the path to the Visualforce page:',
            placeholder: 'force-app/main/default/pages/MyPage.page (leave blank to go back)',
          });
          if (isCancel(customPath)) return handleCancel();
          if (!customPath || !(customPath as string).trim()) {
            // User left blank - go back to type selection
            showHeader();
            currentStep = 0;
            continue wizardLoop;
          }
          componentPath = customPath as string;
        }

        currentStep = 2;
      }
    }

    // Step 3: Controllers (VF only)
    while (currentStep === 2 && conversionType === 'vf' && componentPath) {
      showBreadcrumbs(currentStep, conversionType);

      const resolvedPagePath = path.resolve(componentPath);

      if (await fs.pathExists(resolvedPagePath)) {
        const s = p.spinner();
        s.start('Analyzing page for controller references...');
        const pageContent = await fs.readFile(resolvedPagePath, 'utf-8');
        const result = await findVfControllers(pageContent);
        detectedControllers = result.controllers;
        s.stop('Analysis complete');

        if (result.hasControllers) {
          // Display detected controllers
          const foundControllers = detectedControllers.filter(c => c.found);
          const missingControllers = detectedControllers.filter(c => !c.found);

          if (foundControllers.length > 0 || missingControllers.length > 0) {
            let message = '';
            if (foundControllers.length > 0) {
              message += color.green(`✓ Found: ${foundControllers.map(c => c.name).join(', ')}\n`);
            }
            if (missingControllers.length > 0) {
              message += color.yellow(`⚠ Not found: ${missingControllers.map(c => c.name).join(', ')}`);
            }
            p.note(message, '🔍 Detected Controllers');
          }

          if (foundControllers.length > 0) {
            const selectedControllers = await p.multiselect({
              message: 'Select controllers to include:',
              options: [
                ...foundControllers.map(c => ({
                  value: c.path!,
                  label: `${c.name}`,
                  hint: getControllerTypeLabel(c.type),
                })),
                { value: '__back__', label: color.yellow('← Back') },
              ],
              required: false,
            });

            if (isCancel(selectedControllers)) return handleCancel();

            const selections = selectedControllers as string[];
            if (selections.includes('__back__')) {
              currentStep = 1;
              continue wizardLoop;
            }

            controllerPaths = selections.filter(s => s !== '__back__');
            if (controllerPaths.length > 0) {
              controllerPath = controllerPaths[0];
            }
          }

          // Offer to add more controllers
          const addMore = await p.confirm({
            message: 'Add additional controllers manually?',
            initialValue: false,
          });

          if (isCancel(addMore)) return handleCancel();

          if (addMore) {
            const allControllers = await findApexControllers();
            const availableControllers = allControllers.filter(
              c => !controllerPaths.includes(path.resolve(c.value))
            );

            if (availableControllers.length > 0) {
              const additional = await p.multiselect({
                message: 'Select additional controllers:',
                options: availableControllers,
                required: false,
              });

              if (!isCancel(additional)) {
                controllerPaths.push(...(additional as string[]).map(c => path.resolve(c)));
              }
            }
          }
        } else {
          p.log.info('No controllers detected in page attributes');

          const includeController = await p.confirm({
            message: 'Add a controller manually?',
            initialValue: false,
          });

          if (isCancel(includeController)) return handleCancel();

          if (includeController) {
            const allControllers = await findApexControllers();
            if (allControllers.length > 0) {
              const selected = await p.select({
                message: 'Select an Apex controller:',
                options: [
                  ...allControllers,
                  { value: '__back__', label: color.yellow('← Back') },
                ],
              });

              if (isCancel(selected)) return handleCancel();

              if (selected === '__back__') {
                currentStep = 1;
                continue wizardLoop;
              }

              controllerPath = selected as string;
              controllerPaths = [path.resolve(controllerPath)];
            }
          }
        }
      }

      currentStep = 3;
    }

    // Step 4: Options
    while (currentStep === 3) {
      showBreadcrumbs(currentStep, conversionType);

      const modeResult = await p.select({
        message: 'Conversion mode:',
        options: [
          {
            value: 'scaffolding',
            label: '📝 Scaffolding',
            hint: 'Generates skeleton with TODO comments (recommended)'
          },
          {
            value: 'full',
            label: '⚡ Full Conversion',
            hint: 'Attempts complete code transformation'
          },
          { value: '__back__', label: color.yellow('← Back') },
        ],
      });

      if (isCancel(modeResult)) return handleCancel();

      if (modeResult === '__back__') {
        currentStep = conversionType === 'aura' ? 1 : 2;
        continue wizardLoop;
      }

      conversionMode = modeResult as 'scaffolding' | 'full';

      const outputResult = await p.text({
        message: 'Output directory:',
        initialValue: DEFAULT_OUTPUT_DIR,
        validate: (value) => {
          if (!value.trim()) return 'Output directory is required';
          return undefined;
        },
      });

      if (isCancel(outputResult)) return handleCancel();
      outputDir = outputResult as string;

      const openResult = await p.confirm({
        message: 'Open output folder after conversion?',
        initialValue: true,
      });

      if (isCancel(openResult)) return handleCancel();
      openFolder = openResult;

      const previewResult = await p.confirm({
        message: 'Generate UI preview in browser?',
        initialValue: false,
      });

      if (isCancel(previewResult)) return handleCancel();
      preview = previewResult;

      currentStep = 4;
    }
  } // end wizardLoop

  // Step 5: Confirmation
  showBreadcrumbs(currentStep, conversionType);

  const summaryLines = [
    `${color.dim('Type:')}         ${conversionType === 'aura' ? '⚡ Aura → LWC' : '📄 VF → LWC'}`,
    `${color.dim('Source:')}       ${componentPath}`,
  ];

  if (controllerPaths.length > 0) {
    summaryLines.push(`${color.dim('Controllers:')}  ${controllerPaths.length} selected`);
    controllerPaths.forEach(cp => {
      summaryLines.push(`               ${color.dim('•')} ${path.basename(cp)}`);
    });
  }

  summaryLines.push(`${color.dim('Mode:')}         ${conversionMode === 'full' ? '⚡ Full' : '📝 Scaffolding'}`);
  summaryLines.push(`${color.dim('Output:')}       ${outputDir}`);
  summaryLines.push(`${color.dim('Open folder:')} ${openFolder ? '✓ Yes' : '✗ No'}`);
  summaryLines.push(`${color.dim('UI Preview:')}   ${preview ? '✓ Yes' : '✗ No'}`);

  p.note(summaryLines.join('\n'), '📋 Conversion Summary');

  const confirm = await p.confirm({
    message: 'Proceed with conversion?',
    initialValue: true,
  });

  if (isCancel(confirm) || !confirm) {
    p.cancel('Conversion cancelled.');
    return null;
  }

  p.outro(color.green('Starting conversion...'));

  return {
    conversionType: conversionType!,
    componentPath: componentPath!,
    controllerPath,
    controllerPaths: controllerPaths.length > 0 ? controllerPaths : undefined,
    detectedControllers: detectedControllers.length > 0 ? detectedControllers : undefined,
    outputDir,
    conversionMode,
    openFolder,
    preview,
  };
}
