import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { checkForUpdates, formatUpdateMessage } from '../utils/update-checker.js';

// Start update check early (non-blocking)
const updateCheckPromise = checkForUpdates();

export function startTui(): void {
  // Clear screen and enter alternate buffer before rendering
  process.stdout.write('\x1b[?1049h'); // Enter alternate screen buffer
  process.stdout.write('\x1b[H\x1b[2J'); // Clear screen and move cursor home
  process.stdout.write('\x1b[?25l'); // Hide cursor

  const { waitUntilExit, rerender, unmount, clear } = render(<App />, {
    exitOnCtrlC: false, // We handle quit ourselves with 'q'
  });

  waitUntilExit().then(async () => {
    // Show cursor
    process.stdout.write('\x1b[?25h');
    // Exit alternate screen buffer
    process.stdout.write('\x1b[?1049l');

    // Show update notification if a newer version is available
    try {
      const updateInfo = await updateCheckPromise;
      if (updateInfo.hasUpdate && updateInfo.latestVersion) {
        console.log('');
        console.log(formatUpdateMessage(updateInfo.latestVersion, updateInfo.currentVersion));
      }
    } catch {
      // Silently ignore update check errors
    }

    process.exit(0);
  });
}

export { App } from './App.js';
export { useStore } from './store/index.js';
export * from './types.js';
