/**
 * Type declarations for ink-testing-library mock
 */

import React from 'react';

export interface Instance {
  lastFrame(): string;
  frames: string[];
  unmount(): void;
  rerender(element: React.ReactElement): string;
  stdin: {
    write(data: string): void;
  };
  stdout: {
    lastFrame(): string;
  };
}

export function render(element: React.ReactElement): Instance;
export function cleanup(): void;
