import { useInput, Key } from 'ink';
import { useCallback } from 'react';
import type { KeyBinding } from '../types.js';

export interface UseKeyBindingsOptions {
  isActive?: boolean;
}

export function useKeyBindings(
  bindings: KeyBinding[],
  options: UseKeyBindingsOptions = {}
): void {
  const { isActive = true } = options;

  useInput(
    useCallback(
      (input: string, key: Key) => {
        if (!isActive) return;

        for (const binding of bindings) {
          const matchesKey =
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

          const matchesModifiers =
            (binding.ctrl ?? false) === (key.ctrl ?? false) &&
            (binding.shift ?? false) === (key.shift ?? false) &&
            (binding.meta ?? false) === (key.meta ?? false);

          if (matchesKey && matchesModifiers) {
            binding.action();
            return;
          }
        }
      },
      [bindings, isActive]
    )
  );
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
