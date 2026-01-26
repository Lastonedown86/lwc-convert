/**
 * Mock for ink-testing-library
 *
 * This provides a simplified render function for testing Ink components.
 * Uses react-test-renderer to properly support React hooks.
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

// Recursively extract text content from a test renderer instance
const extractTextFromInstance = (instance: TestRenderer.ReactTestInstance | null): string => {
  if (!instance) return '';

  let text = '';

  // Check for text children (strings/numbers)
  if (instance.children) {
    for (const child of instance.children) {
      if (typeof child === 'string') {
        text += child;
      } else if (typeof child === 'number') {
        text += String(child);
      } else if (typeof child === 'object' && child !== null) {
        // Recursively extract from child instances
        text += extractTextFromInstance(child as TestRenderer.ReactTestInstance);
      }
    }
  }

  // Also check props for label/value (common in ink components)
  if (instance.props) {
    if (typeof instance.props.label === 'string' && !text) {
      text += instance.props.label;
    }
    if (typeof instance.props.value === 'string' && !text) {
      text += instance.props.value;
    }
  }

  return text;
};

// Extract all text from a rendered tree
const extractText = (renderer: TestRenderer.ReactTestRenderer): string => {
  const root = renderer.root;
  return extractTextFromInstance(root);
};

export const render = (element: React.ReactElement) => {
  let renderer: TestRenderer.ReactTestRenderer;

  // Use act to properly handle React updates
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });

  return {
    lastFrame: () => {
      try {
        return extractText(renderer!);
      } catch {
        return '';
      }
    },
    frames: [],
    unmount: () => {
      TestRenderer.act(() => {
        renderer?.unmount();
      });
    },
    rerender: (el: React.ReactElement) => {
      TestRenderer.act(() => {
        renderer?.update(el);
      });
      try {
        return extractText(renderer!);
      } catch {
        return '';
      }
    },
    stdin: {
      write: () => {},
    },
    stdout: {
      lastFrame: () => {
        try {
          return extractText(renderer!);
        } catch {
          return '';
        }
      },
    },
  };
};

export const cleanup = () => {};
