/**
 * LWC Convert VS Code Extension
 * Main entry point for the extension
 */

import * as vscode from 'vscode';
import { LwcConvertClient } from './client/lwcConvertClient';
import { registerCommands } from './commands';
import { ComponentTreeProvider } from './providers/componentTreeProvider';
import { ConversionCodeLensProvider } from './providers/codeLensProvider';

let outputChannel: vscode.OutputChannel;

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('LWC Convert');
  outputChannel.appendLine('LWC Convert extension activating...');

  // Create the LWC Convert client
  const client = new LwcConvertClient();

  // Create tree view provider
  const componentTreeProvider = new ComponentTreeProvider();
  const treeView = vscode.window.createTreeView('lwcConvert.componentExplorer', {
    treeDataProvider: componentTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Create grading summary tree view (placeholder for now)
  const gradingSummaryProvider = new GradingSummaryProvider();
  const gradingTreeView = vscode.window.createTreeView('lwcConvert.gradingSummary', {
    treeDataProvider: gradingSummaryProvider,
  });
  context.subscriptions.push(gradingTreeView);

  // Register commands
  registerCommands(context, client, componentTreeProvider);

  // Register CodeLens provider
  const codeLensProvider = new ConversionCodeLensProvider(client);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { pattern: '**/*.cmp' },
        { pattern: '**/*.page' },
      ],
      codeLensProvider
    )
  );

  // Watch for file changes to invalidate cache
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{cmp,page}');
  fileWatcher.onDidChange((uri) => {
    client.invalidateCache(uri.fsPath);
    codeLensProvider.invalidateFile(uri.fsPath);
  });
  fileWatcher.onDidDelete((uri) => {
    client.invalidateCache(uri.fsPath);
    codeLensProvider.invalidateFile(uri.fsPath);
    componentTreeProvider.refresh();
  });
  fileWatcher.onDidCreate(() => {
    componentTreeProvider.refresh();
  });
  context.subscriptions.push(fileWatcher);

  // Auto-grade on file open if enabled
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      const config = vscode.workspace.getConfiguration('lwcConvert');
      if (!config.get('autoGradeOnOpen', false)) {
        return;
      }

      const filePath = document.uri.fsPath;
      if (filePath.endsWith('.cmp') || filePath.endsWith('.page')) {
        await client.gradeComponent(filePath);
        codeLensProvider.refresh();
      }
    })
  );

  outputChannel.appendLine('LWC Convert extension activated successfully!');
  outputChannel.appendLine(`Workspace folders: ${vscode.workspace.workspaceFolders?.map(f => f.name).join(', ') || 'None'}`);
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  if (outputChannel) {
    outputChannel.appendLine('LWC Convert extension deactivated');
    outputChannel.dispose();
  }
}

/**
 * Simple grading summary provider (placeholder)
 */
class GradingSummaryProvider implements vscode.TreeDataProvider<GradingSummaryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GradingSummaryItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private summary: GradingSummary = {
    total: 0,
    gradeA: 0,
    gradeB: 0,
    gradeC: 0,
    gradeD: 0,
    gradeF: 0,
    averageScore: 0,
  };

  getTreeItem(element: GradingSummaryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): GradingSummaryItem[] {
    if (this.summary.total === 0) {
      return [
        new GradingSummaryItem(
          'No components graded yet',
          'Run "Grade All Components" to analyze',
          'info'
        ),
      ];
    }

    return [
      new GradingSummaryItem(
        'Total Components',
        this.summary.total.toString(),
        'total'
      ),
      new GradingSummaryItem(
        'Average Score',
        `${this.summary.averageScore}/100`,
        'average'
      ),
      new GradingSummaryItem(
        'Grade A (Easy)',
        this.summary.gradeA.toString(),
        'gradeA'
      ),
      new GradingSummaryItem(
        'Grade B',
        this.summary.gradeB.toString(),
        'gradeB'
      ),
      new GradingSummaryItem(
        'Grade C',
        this.summary.gradeC.toString(),
        'gradeC'
      ),
      new GradingSummaryItem(
        'Grade D',
        this.summary.gradeD.toString(),
        'gradeD'
      ),
      new GradingSummaryItem(
        'Grade F (Complex)',
        this.summary.gradeF.toString(),
        'gradeF'
      ),
    ];
  }

  updateSummary(summary: GradingSummary): void {
    this.summary = summary;
    this._onDidChangeTreeData.fire();
  }
}

interface GradingSummary {
  total: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  gradeD: number;
  gradeF: number;
  averageScore: number;
}

class GradingSummaryItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    type: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = type;

    // Set icon based on type
    switch (type) {
      case 'gradeA':
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        break;
      case 'gradeB':
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.blue'));
        break;
      case 'gradeC':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        break;
      case 'gradeD':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
        break;
      case 'gradeF':
        this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        break;
      case 'total':
        this.iconPath = new vscode.ThemeIcon('list-tree');
        break;
      case 'average':
        this.iconPath = new vscode.ThemeIcon('graph');
        break;
      default:
        this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}
