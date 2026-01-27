import { useState, useEffect, useCallback } from 'react';

export interface TerminalSize {
  columns: number;
  rows: number;
  contentRows: number;
}

const HEADER_ROWS = 2;
const FOOTER_ROWS = 2;

/**
 * Get terminal size and react to resize events.
 * When terminal is resized, the size updates which allows
 * components to adjust their scroll position accordingly.
 */
export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(() => {
    const columns = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    return {
      columns,
      rows,
      contentRows: rows - HEADER_ROWS - FOOTER_ROWS,
    };
  });

  useEffect(() => {
    const handleResize = (): void => {
      const columns = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;
      setSize({
        columns,
        rows,
        contentRows: rows - HEADER_ROWS - FOOTER_ROWS,
      });
    };

    process.stdout.on('resize', handleResize);

    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  return size;
}

/**
 * Hook to keep a selected index visible when visible rows change.
 * Returns an adjusted scroll offset that ensures the selected item is visible.
 */
export function useScrollAdjustment(
  selectedIndex: number,
  scrollOffset: number,
  visibleRows: number,
  totalItems: number,
  onScrollChange: (newOffset: number) => void
): void {
  useEffect(() => {
    if (totalItems === 0) return;

    // Ensure selected index is within bounds
    const clampedIndex = Math.min(selectedIndex, totalItems - 1);

    // If selected item is above the visible area, scroll up
    if (clampedIndex < scrollOffset) {
      onScrollChange(clampedIndex);
      return;
    }

    // If selected item is below the visible area, scroll down
    if (clampedIndex >= scrollOffset + visibleRows) {
      onScrollChange(Math.max(0, clampedIndex - visibleRows + 1));
      return;
    }

    // If scroll offset would leave empty space at bottom, adjust
    const maxOffset = Math.max(0, totalItems - visibleRows);
    if (scrollOffset > maxOffset) {
      onScrollChange(maxOffset);
    }
  }, [selectedIndex, scrollOffset, visibleRows, totalItems, onScrollChange]);
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
