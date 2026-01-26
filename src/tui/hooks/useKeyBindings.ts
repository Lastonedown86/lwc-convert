import { useInput, Key } from 'ink';
import { useRef, useEffect } from 'react';
import type { KeyBinding } from '../types.js';

export interface UseKeyBindingsOptions {
  isActive?: boolean;
}

export function useKeyBindings(
  bindings: KeyBinding[],
  options: UseKeyBindingsOptions = {}
): void {
  const { isActive = true } = options;

  // Use ref to always have access to latest bindings without causing re-renders
  const bindingsRef = useRef(bindings);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useInput((input: string, key: Key) => {
    if (!isActiveRef.current) return;

    for (const binding of bindingsRef.current) {
      // Handle Ctrl+letter combinations - Ctrl produces control characters
      // Ctrl+A = 1, Ctrl+B = 2, ..., Ctrl+K = 11, etc.
      let matchesKey = false;
      
      if (binding.ctrl && binding.key.length === 1) {
        // For Ctrl+letter, check if input is the corresponding control character
        const letterCode = binding.key.toLowerCase().charCodeAt(0) - 96; // a=1, b=2, etc.
        const inputCode = input.charCodeAt(0);
        matchesKey = inputCode === letterCode;
      } else {
        matchesKey =
          binding.key.toLowerCase() === input.toLowerCase() ||
          (binding.key === 'escape' && key.escape) ||
          (binding.key === 'return' && key.return) ||
          (binding.key === 'tab' && key.tab) ||
          (binding.key === 'backspace' && key.backspace) ||
          (binding.key === 'delete' && key.delete) ||
          (binding.key === 'up' && key.upArrow) ||
          (binding.key === 'down' && key.downArrow) ||
          (binding.key === 'left' && key.leftArrow) ||
          (binding.key === 'right' && key.rightArrow) ||
          (binding.key === 'pageup' && key.pageUp) ||
          (binding.key === 'pagedown' && key.pageDown);
      }

      // For special keys (non-character), skip modifier check unless explicitly set
      const isSpecialKey = ['escape', 'return', 'tab', 'backspace', 'delete', 'up', 'down', 'left', 'right', 'pageup', 'pagedown'].includes(binding.key);
      
      // For Ctrl+letter, we've already matched the ctrl in the key matching above
      const matchesModifiers = binding.ctrl && binding.key.length === 1
        ? (binding.shift ? key.shift : true) && (binding.meta ? key.meta : true)
        : isSpecialKey
          ? (binding.ctrl ? key.ctrl : true) &&
            (binding.shift ? key.shift : true) &&
            (binding.meta ? key.meta : true)
          : (binding.ctrl ?? false) === (key.ctrl ?? false) &&
            (binding.shift ?? false) === (key.shift ?? false) &&
            (binding.meta ?? false) === (key.meta ?? false);

      if (matchesKey && matchesModifiers) {
        binding.action();
        return;
      }
    }
  });
}

export function formatKeyBinding(binding: KeyBinding): string {
  const parts: string[] = [];

  if (binding.ctrl) parts.push('Ctrl');
  if (binding.shift) parts.push('Shift');
  if (binding.meta) parts.push('Cmd');

  // Format the key nicely
  let keyDisplay = binding.key;
  switch (binding.key.toLowerCase()) {
    case 'escape':
      keyDisplay = 'Esc';
      break;
    case 'return':
      keyDisplay = 'Enter';
      break;
    case 'up':
      keyDisplay = '↑';
      break;
    case 'down':
      keyDisplay = '↓';
      break;
    case 'left':
      keyDisplay = '←';
      break;
    case 'right':
      keyDisplay = '→';
      break;
    case 'pageup':
      keyDisplay = 'PgUp';
      break;
    case 'pagedown':
      keyDisplay = 'PgDn';
      break;
    default:
      keyDisplay = binding.key.toUpperCase();
  }

  parts.push(keyDisplay);
  return parts.join('+');
}
