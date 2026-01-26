import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

export function startTui(): void {
  const { waitUntilExit } = render(<App />);

  waitUntilExit().then(() => {
    process.exit(0);
  });
}

export { App } from './App.js';
export { useStore } from './store/index.js';
export * from './types.js';
