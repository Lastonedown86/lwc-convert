/**
 * Mock for ink library
 */

import React from 'react';

// Mock Box component
export const Box = ({ children, ...props }: any) => {
  return React.createElement('ink-box', props, children);
};

// Mock Text component
export const Text = ({ children, ...props }: any) => {
  return React.createElement('ink-text', props, children);
};

// Mock render function
export const render = (element: React.ReactElement) => {
  let output = '';

  const extractText = (el: any): string => {
    if (typeof el === 'string') return el;
    if (typeof el === 'number') return String(el);
    if (!el) return '';

    if (el.props && el.props.children) {
      if (Array.isArray(el.props.children)) {
        return el.props.children.map(extractText).join('');
      }
      return extractText(el.props.children);
    }

    return '';
  };

  output = extractText(element);

  return {
    lastFrame: () => output,
    unmount: () => {},
    waitUntilExit: () => Promise.resolve(),
    rerender: () => {},
    stdin: { write: () => {} },
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  };
};

// Mock useInput hook
export const useInput = (handler: Function) => {
  // No-op in tests
};

// Mock useFocus hook
export const useFocus = () => ({
  isFocused: false,
});

// Mock useFocusManager hook
export const useFocusManager = () => ({
  focusNext: () => {},
  focusPrevious: () => {},
  focus: () => {},
});

// Mock useStdin hook
export const useStdin = () => ({
  stdin: process.stdin,
  setRawMode: () => {},
  isRawModeSupported: true,
});

// Mock useStdout hook
export const useStdout = () => ({
  stdout: process.stdout,
  write: () => {},
});

// Mock useApp hook
export const useApp = () => ({
  exit: () => {},
});

// Mock Key type
export interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;
}

// Mock Static component
export const Static = ({ children }: any) => {
  return React.createElement('ink-static', {}, children);
};

// Mock Newline component
export const Newline = () => {
  return React.createElement('ink-newline');
};

// Mock Spacer component
export const Spacer = () => {
  return React.createElement('ink-spacer');
};

// Mock Transform component
export const Transform = ({ children }: any) => {
  return React.createElement('ink-transform', {}, children);
};
