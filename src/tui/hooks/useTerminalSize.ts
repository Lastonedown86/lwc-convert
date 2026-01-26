import { useMemo } from 'react';

export interface TerminalSize {
  columns: number;
  rows: number;
  contentRows: number;
}

const HEADER_ROWS = 2;
const FOOTER_ROWS = 2;

/**
 * Get terminal size at component mount time.
 * Does NOT react to resize events - this is intentional to prevent
 * disorienting re-renders when the terminal is resized.
 */
export function useTerminalSize(): TerminalSize {
  // Capture size once at mount - don't react to resize
  const size = useMemo<TerminalSize>(() => {
    const columns = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    return {
      columns,
      rows,
      contentRows: rows - HEADER_ROWS - FOOTER_ROWS,
    };
  }, []); // Empty deps = only computed once

  return size;
}

export function useVisibleRows(
  preferredRows: number | 'auto',
  minRows: number = 5,
  maxRows: number = 20
): number {
  const { contentRows } = useTerminalSize();

  if (preferredRows === 'auto') {
    // Reserve space for header, summary, grade distribution, filter/sort bar, scroll indicator
    const available = Math.max(contentRows - 12, minRows);
    return Math.min(available, maxRows);
  }

  return Math.min(preferredRows, Math.max(contentRows - 12, minRows), maxRows);
}
