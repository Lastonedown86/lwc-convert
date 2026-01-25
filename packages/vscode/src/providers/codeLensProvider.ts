/**
 * CodeLens Provider
 * Provides inline actionable links above component declarations
 */

import * as vscode from 'vscode';
import { LwcConvertClient } from '../client/lwcConvertClient';

export class ConversionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private gradeCache = new Map<string, { grade: string; score: number }>();

  constructor(private client: LwcConvertClient) {}

  /**
   * Refresh code lenses
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Provide code lenses for a document
   */
  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('lwcConvert');
    if (!config.get('showCodeLens', true)) {
      return [];
    }

    const filePath = document.uri.fsPath;
    const isAura = filePath.endsWith('.cmp');
    const isVf = filePath.endsWith('.page');

    if (!isAura && !isVf) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();

    // Find the component declaration line
    const declarationPattern = isAura
      ? /<aura:component/i
      : /<apex:page/i;

    const match = declarationPattern.exec(text);
    if (!match) {
      return [];
    }

    const position = document.positionAt(match.index);
    const range = new vscode.Range(position, position);

    // Add "Convert to LWC" lens
    lenses.push(
      new vscode.CodeLens(range, {
        title: '$(arrow-swap) Convert to LWC',
        command: 'lwcConvert.convertWithPreview',
        arguments: [document.uri],
        tooltip: 'Convert this component to Lightning Web Component',
      })
    );

    // Add grade lens (async)
    const cached = this.gradeCache.get(filePath);
    if (cached) {
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(pulse) Grade: ${cached.grade} (${cached.score}/100)`,
          command: 'lwcConvert.gradeComponent',
          arguments: [document.uri],
          tooltip: 'View detailed grade breakdown',
        })
      );
    } else {
      // Add placeholder and fetch grade in background
      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(pulse) Grade: Click to analyze',
          command: 'lwcConvert.gradeComponent',
          arguments: [document.uri],
          tooltip: 'Analyze conversion complexity',
        })
      );

      // Fetch grade in background
      this.fetchGradeInBackground(filePath);
    }

    // Add dependencies lens
    lenses.push(
      new vscode.CodeLens(range, {
        title: '$(git-branch) View Dependencies',
        command: 'lwcConvert.showDependencyGraph',
        arguments: [document.uri],
        tooltip: 'Show component dependencies',
      })
    );

    return lenses;
  }

  /**
   * Fetch grade in background and update cache
   */
  private async fetchGradeInBackground(filePath: string): Promise<void> {
    try {
      const grade = await this.client.gradeComponent(filePath);
      if (grade) {
        this.gradeCache.set(filePath, {
          grade: grade.letterGrade,
          score: grade.score,
        });
        this._onDidChangeCodeLenses.fire();
      }
    } catch (error) {
      console.error('Failed to fetch grade:', error);
    }
  }

  /**
   * Clear the grade cache
   */
  clearCache(): void {
    this.gradeCache.clear();
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    this.gradeCache.delete(filePath);
    this._onDidChangeCodeLenses.fire();
  }
}
