/**
 * Command registration and handlers
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LwcConvertClient } from '../client/lwcConvertClient';
import { ComponentTreeProvider } from '../providers/componentTreeProvider';
import { ConversionMode, ExtensionSettings } from '../types';

/**
 * Register all extension commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  client: LwcConvertClient,
  treeProvider: ComponentTreeProvider
): void {
  // Convert component command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.convertComponent', async (uri?: vscode.Uri) => {
      const filePath = await getFilePath(uri);
      if (!filePath) {
        return;
      }

      await convertComponent(client, filePath, false);
    })
  );

  // Convert with preview command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.convertWithPreview', async (uri?: vscode.Uri) => {
      const filePath = await getFilePath(uri);
      if (!filePath) {
        return;
      }

      await convertComponent(client, filePath, true);
    })
  );

  // Grade component command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.gradeComponent', async (uri?: vscode.Uri) => {
      const filePath = await getFilePath(uri);
      if (!filePath) {
        return;
      }

      await gradeComponent(client, filePath);
    })
  );

  // Grade workspace command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.gradeWorkspace', async () => {
      await gradeWorkspace(client, treeProvider);
    })
  );

  // Show dependency graph command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.showDependencyGraph', async (uri?: vscode.Uri) => {
      const workspacePath = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      await showDependencyGraph(client, workspacePath);
    })
  );

  // Show conversion order command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.showConversionOrder', async () => {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspacePath) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      await showConversionOrder(client, workspacePath);
    })
  );

  // Refresh tree view command
  context.subscriptions.push(
    vscode.commands.registerCommand('lwcConvert.refreshTreeView', () => {
      treeProvider.refresh();
    })
  );
}

/**
 * Get file path from URI or active editor
 */
async function getFilePath(uri?: vscode.Uri): Promise<string | undefined> {
  if (uri) {
    return uri.fsPath;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    return activeEditor.document.uri.fsPath;
  }

  vscode.window.showWarningMessage('No file selected');
  return undefined;
}

/**
 * Get extension settings
 */
function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration('lwcConvert');
  return {
    outputDirectory: config.get('outputDirectory', 'force-app/main/default/lwc'),
    conversionMode: config.get('conversionMode', 'scaffolding') as ConversionMode,
    showGradeDecorations: config.get('showGradeDecorations', true),
    autoGradeOnOpen: config.get('autoGradeOnOpen', false),
    showCodeLens: config.get('showCodeLens', true),
  };
}

/**
 * Convert a component
 */
async function convertComponent(
  client: LwcConvertClient,
  filePath: string,
  preview: boolean
): Promise<void> {
  const settings = getSettings();

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Converting ${path.basename(filePath)}...`,
      cancellable: false,
    },
    async () => {
      const result = await client.convertComponent(filePath, {
        mode: settings.conversionMode,
        outputDirectory: settings.outputDirectory,
        includeTests: false,
        dryRun: preview,
      });

      if (result.success) {
        if (preview) {
          vscode.window.showInformationMessage(
            `Preview generated. Output would be written to: ${result.outputPath}`
          );
        } else {
          const openAction = 'Open Folder';
          const action = await vscode.window.showInformationMessage(
            `Component converted successfully!`,
            openAction
          );

          if (action === openAction && result.outputPath) {
            const folderUri = vscode.Uri.file(result.outputPath);
            vscode.commands.executeCommand('revealInExplorer', folderUri);
          }
        }
      } else {
        vscode.window.showErrorMessage(
          `Conversion failed: ${result.errors.join(', ')}`
        );
      }
    }
  );
}

/**
 * Grade a single component
 */
async function gradeComponent(client: LwcConvertClient, filePath: string): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Grading ${path.basename(filePath)}...`,
      cancellable: false,
    },
    async () => {
      const grade = await client.gradeComponent(filePath);

      if (grade) {
        const detailAction = 'View Details';
        const convertAction = 'Convert Now';

        const action = await vscode.window.showInformationMessage(
          `Grade: ${grade.letterGrade} (Score: ${grade.score}/100) - Effort: ${grade.effort.description}`,
          detailAction,
          convertAction
        );

        if (action === convertAction) {
          vscode.commands.executeCommand('lwcConvert.convertWithPreview', vscode.Uri.file(filePath));
        } else if (action === detailAction) {
          // Show detailed breakdown in output channel
          const outputChannel = vscode.window.createOutputChannel('LWC Convert');
          outputChannel.appendLine(`\nGrade Report for ${path.basename(filePath)}`);
          outputChannel.appendLine('='.repeat(50));
          outputChannel.appendLine(`Overall Grade: ${grade.letterGrade} (${grade.score}/100)`);
          outputChannel.appendLine(`Estimated Effort: ${grade.effort.minHours}-${grade.effort.maxHours} hours`);
          outputChannel.appendLine('\nCategory Breakdown:');

          for (const category of grade.categories) {
            outputChannel.appendLine(`  ${category.name}: ${category.score}/${category.maxScore}`);
            for (const factor of category.factors) {
              outputChannel.appendLine(`    - ${factor}`);
            }
          }

          outputChannel.show();
        }
      } else {
        vscode.window.showWarningMessage('Could not grade component');
      }
    }
  );
}

/**
 * Grade all components in workspace
 */
async function gradeWorkspace(
  client: LwcConvertClient,
  treeProvider: ComponentTreeProvider
): Promise<void> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Grading all components...',
      cancellable: false,
    },
    async () => {
      const components = await client.gradeWorkspace(workspacePath);
      treeProvider.updateComponents(components);

      const summary = summarizeGrades(components);
      vscode.window.showInformationMessage(
        `Graded ${components.length} components: ${summary}`
      );
    }
  );
}

/**
 * Show dependency graph
 */
async function showDependencyGraph(
  client: LwcConvertClient,
  workspacePath: string
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing dependencies...',
      cancellable: false,
    },
    async () => {
      const deps = await client.analyzeDependencies(workspacePath);

      if (deps) {
        // For now, show in output channel
        // TODO: Implement WebView visualization
        const outputChannel = vscode.window.createOutputChannel('LWC Convert - Dependencies');
        outputChannel.appendLine('Dependency Analysis');
        outputChannel.appendLine('='.repeat(50));
        outputChannel.appendLine(JSON.stringify(deps, null, 2));
        outputChannel.show();
      } else {
        vscode.window.showWarningMessage('Could not analyze dependencies');
      }
    }
  );
}

/**
 * Show recommended conversion order
 */
async function showConversionOrder(
  client: LwcConvertClient,
  workspacePath: string
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Calculating conversion order...',
      cancellable: false,
    },
    async () => {
      const deps = await client.analyzeDependencies(workspacePath);

      if (deps?.conversionOrder) {
        const outputChannel = vscode.window.createOutputChannel('LWC Convert - Conversion Order');
        outputChannel.appendLine('Recommended Conversion Order');
        outputChannel.appendLine('='.repeat(50));

        for (const wave of deps.conversionOrder.waves) {
          outputChannel.appendLine(`\nWave ${wave.wave} (${wave.components.length} components):`);
          for (const comp of wave.components) {
            outputChannel.appendLine(`  - ${comp}`);
          }
        }

        if (deps.conversionOrder.recommendations) {
          outputChannel.appendLine('\nRecommendations:');
          for (const rec of deps.conversionOrder.recommendations) {
            outputChannel.appendLine(`  ${rec}`);
          }
        }

        outputChannel.show();
      } else {
        vscode.window.showWarningMessage('Could not calculate conversion order');
      }
    }
  );
}

/**
 * Summarize grades for display
 */
function summarizeGrades(components: { grade?: { letterGrade: string } }[]): string {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  for (const comp of components) {
    if (comp.grade?.letterGrade) {
      counts[comp.grade.letterGrade] = (counts[comp.grade.letterGrade] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([grade, count]) => `${grade}:${count}`)
    .join(', ');
}
