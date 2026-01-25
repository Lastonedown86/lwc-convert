/**
 * Cross-platform utility to open a folder in the system file explorer
 */

import { exec } from 'child_process';
import * as os from 'os';
import { logger } from './logger';

/**
 * Opens the specified folder in the system's file explorer.
 * Works on Windows, macOS, and Linux.
 */
export function openFolder(folderPath: string): Promise<void> {
  return new Promise((resolve, _reject) => {
    const platform = os.platform();
    let command: string;

    switch (platform) {
      case 'win32':
        // Windows: use start command which handles paths better
        command = `start "" "${folderPath}"`;
        break;
      case 'darwin':
        // macOS: use open
        command = `open "${folderPath}"`;
        break;
      default:
        // Linux and others: use xdg-open
        command = `xdg-open "${folderPath}"`;
        break;
    }

    exec(command, (error) => {
      if (error) {
        // Don't fail the whole conversion if we can't open the folder
        logger.warn(`Could not open folder: ${error.message}`);
        resolve();
      } else {
        resolve();
      }
    });
  });
}
