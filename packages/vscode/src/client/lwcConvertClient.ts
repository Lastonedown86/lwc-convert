/**
 * LWC Convert Client
 * Wrapper around the lwc-convert CLI tool that provides grading,
 * conversion, and dependency analysis functionality.
 */

import * as path from 'path';
import { spawn } from 'child_process';
import {
  ComponentInfo,
  GradeInfo,
  ConversionResult,
  ConversionOptions,
  LetterGrade,
  ComponentType,
} from '../types';

export class LwcConvertClient {
  private gradeCache: Map<string, GradeInfo> = new Map();

  /**
   * Grade a single component's conversion complexity
   */
  async gradeComponent(filePath: string): Promise<GradeInfo | null> {
    // Check cache first
    const cached = this.gradeCache.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.runCliCommand('grade', [filePath, '--format', 'json', '--detailed']);
      const parsed = JSON.parse(result);

      if (parsed.components && parsed.components.length > 0) {
        const component = parsed.components[0];
        const gradeInfo: GradeInfo = {
          letterGrade: component.letterGrade as LetterGrade,
          score: component.score,
          categories: component.categories || [],
          effort: component.effort || { minHours: 0, maxHours: 0, description: 'Unknown' },
        };

        this.gradeCache.set(filePath, gradeInfo);
        return gradeInfo;
      }

      return null;
    } catch (error) {
      console.error('Failed to grade component:', error);
      return null;
    }
  }

  /**
   * Grade all components in a workspace
   */
  async gradeWorkspace(workspacePath: string): Promise<ComponentInfo[]> {
    try {
      const result = await this.runCliCommand('grade', [workspacePath, '--format', 'json', '--detailed']);
      const parsed = JSON.parse(result);

      if (parsed.components) {
        return parsed.components.map((comp: any) => ({
          name: comp.name,
          type: comp.type as ComponentType,
          filePath: comp.filePath,
          grade: {
            letterGrade: comp.letterGrade as LetterGrade,
            score: comp.score,
            categories: comp.categories || [],
            effort: comp.effort || { minHours: 0, maxHours: 0, description: 'Unknown' },
          },
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to grade workspace:', error);
      return [];
    }
  }

  /**
   * Convert a component to LWC
   */
  async convertComponent(
    filePath: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    try {
      const args = [filePath, '-o', options.outputDirectory];

      if (options.mode === 'full') {
        args.push('--full');
      }

      if (options.dryRun) {
        args.push('--dry-run');
      }

      // Determine if this is Aura or VF based on file extension
      const ext = path.extname(filePath);
      const command = ext === '.page' ? 'vf' : 'aura';

      const result = await this.runCliCommand(command, args);

      return {
        success: true,
        outputPath: options.outputDirectory,
        notes: [],
        warnings: [],
        errors: [],
      };
    } catch (error: any) {
      return {
        success: false,
        notes: [],
        warnings: [],
        errors: [error.message || 'Conversion failed'],
      };
    }
  }

  /**
   * Analyze dependencies in a workspace
   */
  async analyzeDependencies(workspacePath: string): Promise<any> {
    try {
      const result = await this.runCliCommand('deps', [workspacePath, '--format', 'json', '--conversion-order']);
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to analyze dependencies:', error);
      return null;
    }
  }

  /**
   * Clear the grade cache
   */
  clearCache(): void {
    this.gradeCache.clear();
  }

  /**
   * Clear cache for a specific file
   */
  invalidateCache(filePath: string): void {
    this.gradeCache.delete(filePath);
  }

  /**
   * Run an lwc-convert CLI command
   */
  private runCliCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // Try to use the locally installed lwc-convert or fall back to npx
      const cliCommand = 'npx';
      const cliArgs = ['lwc-convert', command, ...args];

      const proc = spawn(cliCommand, cliArgs, {
        shell: true,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

// Export singleton instance
export const lwcConvertClient = new LwcConvertClient();
