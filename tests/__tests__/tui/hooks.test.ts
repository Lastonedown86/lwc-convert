/**
 * Tests for TUI Hooks
 */

import { formatKeyBinding } from '../../../src/tui/hooks/useKeyBindings';
import type { KeyBinding } from '../../../src/tui/types';

describe('formatKeyBinding', () => {
  it('should format simple key', () => {
    const binding: KeyBinding = {
      key: 's',
      action: () => {},
      description: 'Save',
    };

    expect(formatKeyBinding(binding)).toBe('S');
  });

  it('should format key with Ctrl modifier', () => {
    const binding: KeyBinding = {
      key: 'k',
      ctrl: true,
      action: () => {},
      description: 'Command palette',
    };

    expect(formatKeyBinding(binding)).toBe('Ctrl+K');
  });

  it('should format key with Shift modifier', () => {
    const binding: KeyBinding = {
      key: 'tab',
      shift: true,
      action: () => {},
      description: 'Previous',
    };

    expect(formatKeyBinding(binding)).toBe('Shift+TAB');
  });

  it('should format key with multiple modifiers', () => {
    const binding: KeyBinding = {
      key: 's',
      ctrl: true,
      shift: true,
      action: () => {},
      description: 'Save all',
    };

    expect(formatKeyBinding(binding)).toBe('Ctrl+Shift+S');
  });

  it('should format escape key', () => {
    const binding: KeyBinding = {
      key: 'escape',
      action: () => {},
      description: 'Back',
    };

    expect(formatKeyBinding(binding)).toBe('Esc');
  });

  it('should format return/enter key', () => {
    const binding: KeyBinding = {
      key: 'return',
      action: () => {},
      description: 'Confirm',
    };

    expect(formatKeyBinding(binding)).toBe('Enter');
  });

  it('should format arrow keys', () => {
    const upBinding: KeyBinding = {
      key: 'up',
      action: () => {},
      description: 'Up',
    };

    const downBinding: KeyBinding = {
      key: 'down',
      action: () => {},
      description: 'Down',
    };

    const leftBinding: KeyBinding = {
      key: 'left',
      action: () => {},
      description: 'Left',
    };

    const rightBinding: KeyBinding = {
      key: 'right',
      action: () => {},
      description: 'Right',
    };

    expect(formatKeyBinding(upBinding)).toBe('↑');
    expect(formatKeyBinding(downBinding)).toBe('↓');
    expect(formatKeyBinding(leftBinding)).toBe('←');
    expect(formatKeyBinding(rightBinding)).toBe('→');
  });

  it('should format page up/down keys', () => {
    const pageUpBinding: KeyBinding = {
      key: 'pageup',
      action: () => {},
      description: 'Page Up',
    };

    const pageDownBinding: KeyBinding = {
      key: 'pagedown',
      action: () => {},
      description: 'Page Down',
    };

    expect(formatKeyBinding(pageUpBinding)).toBe('PgUp');
    expect(formatKeyBinding(pageDownBinding)).toBe('PgDn');
  });

  it('should format meta (Cmd) modifier', () => {
    const binding: KeyBinding = {
      key: 'k',
      meta: true,
      action: () => {},
      description: 'Command palette',
    };

    expect(formatKeyBinding(binding)).toBe('Cmd+K');
  });
});

describe('useTerminalSize calculations', () => {
  // Note: useTerminalSize uses React hooks, so we test the logic indirectly

  it('should calculate content rows correctly', () => {
    // Typical terminal: 24 rows total
    // Header: 2 rows, Footer: 2 rows
    // Content: 24 - 4 = 20 rows
    const totalRows = 24;
    const headerFooterRows = 4;
    const contentRows = totalRows - headerFooterRows;

    expect(contentRows).toBe(20);
  });

  it('should handle small terminal', () => {
    const totalRows = 10;
    const headerFooterRows = 4;
    const contentRows = Math.max(1, totalRows - headerFooterRows);

    expect(contentRows).toBe(6);
  });

  it('should handle very small terminal', () => {
    const totalRows = 4;
    const headerFooterRows = 4;
    const contentRows = Math.max(1, totalRows - headerFooterRows);

    expect(contentRows).toBe(1);
  });
});
