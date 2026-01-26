/**
 * Mock for ink-testing-library
 *
 * This provides a simplified render function for testing Ink components.
 * It extracts text content from React elements for assertions.
 */

import React from 'react';

// Recursively extract text content from React elements
const extractText = (el: unknown): string => {
  if (typeof el === 'string') return el;
  if (typeof el === 'number') return String(el);
  if (el === null || el === undefined || el === false) return '';

  if (Array.isArray(el)) {
    return el.map(extractText).join('');
  }

  // Handle React elements (including those with custom type strings like 'ink-box')
  if (React.isValidElement(el)) {
    const props = el.props as Record<string, unknown>;
    let text = '';

    // Extract text from children - this is the main source of text
    if (props.children !== undefined) {
      text += extractText(props.children);
    }

    // If no children text found, check for text-like props
    if (!text) {
      if (typeof props.label === 'string') {
        text += props.label;
      }
      if (typeof props.value === 'string') {
        text += props.value;
      }
    }

    return text;
  }

  // Handle plain objects with children property
  if (typeof el === 'object' && el !== null) {
    const obj = el as { props?: { children?: unknown }; children?: unknown; type?: unknown };

    // Handle objects that look like React elements but aren't detected as such
    if (obj.props?.children !== undefined) {
      return extractText(obj.props.children);
    }
    if (obj.children !== undefined) {
      return extractText(obj.children);
    }
  }

  return '';
};

// Recursively render a React element to get its output
const renderElement = (el: unknown): unknown => {
  if (typeof el === 'string' || typeof el === 'number' || el === null || el === undefined || el === false) {
    return el;
  }

  if (Array.isArray(el)) {
    return el.map(renderElement);
  }

  if (React.isValidElement(el)) {
    const element = el as React.ReactElement<any>;
    const { type, props } = element;

    // If it's a function component, call it to get the rendered output
    if (typeof type === 'function') {
      try {
        const Component = type as React.FC<any>;
        const rendered = Component(props);
        return renderElement(rendered);
      } catch {
        // If the component throws, just return what we can extract from props
        return renderElement(props.children);
      }
    }

    // For intrinsic elements (like 'ink-box', 'ink-text', or 'div'), render children
    if (props.children !== undefined) {
      return {
        ...element,
        props: {
          ...props,
          children: renderElement(props.children),
        },
      };
    }
  }

  return el;
};

export const render = (element: React.ReactElement) => {
  // First render the element tree to resolve function components
  const rendered = renderElement(element);
  // Then extract text from the rendered tree
  const output = extractText(rendered);

  return {
    lastFrame: () => output,
    frames: [output],
    unmount: () => {},
    rerender: (el: React.ReactElement) => extractText(renderElement(el)),
    stdin: {
      write: () => {},
    },
    stdout: {
      lastFrame: () => output,
    },
  };
};

export const cleanup = () => {};
