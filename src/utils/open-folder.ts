/**
 * Cross-platform utility to open a folder in the system file explorer
 */

import { execFile, spawn } from 'child_process';
import * as os from 'os';
import { logger } from './logger';

/**
 * Opens the specified folder in the system's file explorer.
 * Works on Windows, macOS, and Linux.
 * Uses execFile/spawn with argument arrays to prevent command injection.
 */
export function openFolder(folderPath: string): Promise<void> {
  return new Promise((resolve) => {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        // Windows: use 'explorer' with the path as an argument
        execFile('explorer', [folderPath], (error) => {
          if (error) {
            logger.warn(`Could not open folder: ${error.message}`);
          }
          resolve();
        });
      } else if (platform === 'darwin') {
        // macOS: use 'open' with the path as an argument
        execFile('open', [folderPath], (error) => {
          if (error) {
            logger.warn(`Could not open folder: ${error.message}`);
          }
          resolve();
        });
      } else {
        // Linux: use 'xdg-open' with the path as an argument
        const child = spawn('xdg-open', [folderPath], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        resolve();
      }
    } catch (error: any) {
      logger.warn(`Could not open folder: ${error.message}`);
      resolve();
    }
  });
}
