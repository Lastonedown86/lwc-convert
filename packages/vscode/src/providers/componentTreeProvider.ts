/**
 * Component Tree Provider
 * Provides the tree view for the Component Explorer sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ComponentInfo, ComponentType, LetterGrade } from '../types';

type TreeItemType = 'category' | 'component';

export class ComponentTreeProvider implements vscode.TreeDataProvider<ComponentTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ComponentTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private components: ComponentInfo[] = [];

  constructor() {
    this.scanWorkspace();
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this.scanWorkspace();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update components with grading info
   */
  updateComponents(components: ComponentInfo[]): void {
    this.components = components;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for an element
   */
  getTreeItem(element: ComponentTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of an element
   */
  getChildren(element?: ComponentTreeItem): Thenable<ComponentTreeItem[]> {
    if (!element) {
      // Root level - return categories
      return Promise.resolve(this.getRootItems());
    }

    if (element.itemType === 'category') {
      // Return components of this type
      return Promise.resolve(this.getComponentsOfType(element.componentType!));
    }

    // Components have no children
    return Promise.resolve([]);
  }

  /**
   * Get root category items
   */
  private getRootItems(): ComponentTreeItem[] {
    const auraCount = this.components.filter(c => c.type === 'aura').length;
    const vfCount = this.components.filter(c => c.type === 'vf').length;

    const items: ComponentTreeItem[] = [];

    if (auraCount > 0) {
      items.push(new ComponentTreeItem(
        `Aura Components (${auraCount})`,
        'category',
        vscode.TreeItemCollapsibleState.Expanded,
        'aura'
      ));
    }

    if (vfCount > 0) {
      items.push(new ComponentTreeItem(
        `Visualforce Pages (${vfCount})`,
        'category',
        vscode.TreeItemCollapsibleState.Expanded,
        'vf'
      ));
    }

    if (items.length === 0) {
      items.push(new ComponentTreeItem(
        'No components found',
        'category',
        vscode.TreeItemCollapsibleState.None
      ));
    }

    return items;
  }

  /**
   * Get components of a specific type
   */
  private getComponentsOfType(type: ComponentType): ComponentTreeItem[] {
    return this.components
      .filter(c => c.type === type)
      .sort((a, b) => {
        // Sort by grade (worst first), then by name
        if (a.grade && b.grade) {
          const gradeOrder: Record<LetterGrade, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };
          const gradeCompare = gradeOrder[a.grade.letterGrade] - gradeOrder[b.grade.letterGrade];
          if (gradeCompare !== 0) {
            return gradeCompare;
          }
        }
        return a.name.localeCompare(b.name);
      })
      .map(comp => new ComponentTreeItem(
        comp.name,
        'component',
        vscode.TreeItemCollapsibleState.None,
        comp.type,
        comp.filePath,
        comp.grade?.letterGrade
      ));
  }

  /**
   * Scan workspace for Aura and VF components
   */
  private scanWorkspace(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.components = [];
      return;
    }

    const components: ComponentInfo[] = [];

    for (const folder of workspaceFolders) {
      // Scan for Aura components
      const auraPaths = [
        path.join(folder.uri.fsPath, 'force-app/main/default/aura'),
        path.join(folder.uri.fsPath, 'src/aura'),
        path.join(folder.uri.fsPath, 'aura'),
      ];

      for (const auraPath of auraPaths) {
        if (fs.existsSync(auraPath)) {
          const auraComponents = this.scanAuraDirectory(auraPath);
          components.push(...auraComponents);
        }
      }

      // Scan for VF pages
      const vfPaths = [
        path.join(folder.uri.fsPath, 'force-app/main/default/pages'),
        path.join(folder.uri.fsPath, 'src/pages'),
        path.join(folder.uri.fsPath, 'pages'),
      ];

      for (const vfPath of vfPaths) {
        if (fs.existsSync(vfPath)) {
          const vfPages = this.scanVfDirectory(vfPath);
          components.push(...vfPages);
        }
      }
    }

    this.components = components;
  }

  /**
   * Scan directory for Aura components
   */
  private scanAuraDirectory(dirPath: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Check if it's an Aura component bundle (has .cmp file)
          const files = fs.readdirSync(itemPath);
          const hasCmp = files.some(f => f.endsWith('.cmp'));

          if (hasCmp) {
            components.push({
              name: item,
              type: 'aura',
              filePath: itemPath,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning Aura directory ${dirPath}:`, error);
    }

    return components;
  }

  /**
   * Scan directory for VF pages
   */
  private scanVfDirectory(dirPath: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        if (item.endsWith('.page')) {
          const itemPath = path.join(dirPath, item);
          components.push({
            name: item.replace('.page', ''),
            type: 'vf',
            filePath: itemPath,
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning VF directory ${dirPath}:`, error);
    }

    return components;
  }
}

/**
 * Tree item for component explorer
 */
export class ComponentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: TreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly componentType?: ComponentType,
    public readonly filePath?: string,
    public readonly grade?: LetterGrade
  ) {
    super(label, collapsibleState);

    this.contextValue = componentType || itemType;

    if (itemType === 'component' && filePath) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Component',
        arguments: [vscode.Uri.file(this.getMainFile(filePath, componentType!))],
      };

      // Set description to show grade
      if (grade) {
        this.description = `[${grade}]`;
      }

      // Set icon based on grade
      this.iconPath = this.getIcon(componentType!, grade);
    } else if (itemType === 'category') {
      this.iconPath = this.getCategoryIcon(componentType);
    }
  }

  /**
   * Get the main file for a component
   */
  private getMainFile(filePath: string, type: ComponentType): string {
    if (type === 'vf') {
      return filePath;
    }

    // For Aura, return the .cmp file
    const componentName = path.basename(filePath);
    return path.join(filePath, `${componentName}.cmp`);
  }

  /**
   * Get icon for component based on type and grade
   */
  private getIcon(type: ComponentType, grade?: LetterGrade): vscode.ThemeIcon {
    if (grade) {
      const gradeColors: Record<LetterGrade, string> = {
        A: 'charts.green',
        B: 'charts.blue',
        C: 'charts.yellow',
        D: 'charts.orange',
        F: 'charts.red',
      };

      return new vscode.ThemeIcon(
        type === 'aura' ? 'zap' : 'file-code',
        new vscode.ThemeColor(gradeColors[grade] || 'foreground')
      );
    }

    return new vscode.ThemeIcon(type === 'aura' ? 'zap' : 'file-code');
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(type?: ComponentType): vscode.ThemeIcon {
    if (type === 'aura') {
      return new vscode.ThemeIcon('zap');
    } else if (type === 'vf') {
      return new vscode.ThemeIcon('file-code');
    }
    return new vscode.ThemeIcon('folder');
  }
}
