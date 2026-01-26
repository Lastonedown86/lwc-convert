import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export function startTui(): void {
  // Clear screen and enter alternate buffer before rendering
  process.stdout.write('\x1b[?1049h'); // Enter alternate screen buffer
  process.stdout.write('\x1b[H\x1b[2J'); // Clear screen and move cursor home
  process.stdout.write('\x1b[?25l'); // Hide cursor

  const { waitUntilExit, rerender, unmount, clear } = render(<App />, {
    exitOnCtrlC: false, // We handle quit ourselves with 'q'
  });

  waitUntilExit().then(() => {
    // Show cursor
    process.stdout.write('\x1b[?25h');
    // Exit alternate screen buffer
    process.stdout.write('\x1b[?1049l');
    process.exit(0);
  });
}

export { App } from './App.js';
export { useStore } from './store/index.js';
export * from './types.js';
