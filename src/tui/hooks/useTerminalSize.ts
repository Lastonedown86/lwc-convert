import { useState, useEffect } from 'react';

export interface TerminalSize {
  columns: number;
  rows: number;
  contentRows: number;
}

const HEADER_ROWS = 2;
const FOOTER_ROWS = 2;

/**
 * Get the initial terminal size (captured once on mount).
 * Does NOT react to resize events - use this for stable layout calculations.
 */
function getInitialTerminalSize(): TerminalSize {
  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return {
    columns,
    rows,
    contentRows: rows - HEADER_ROWS - FOOTER_ROWS,
  };
}

/**
 * Get terminal size captured once on mount.
 * Components using this will NOT re-render when terminal is resized.
 * Use this for stable visible row calculations.
 */
export function useInitialTerminalSize(): TerminalSize {
  const [size] = useState<TerminalSize>(getInitialTerminalSize);
  return size;
}

/**
 * Get terminal size and react to resize events.
 * When terminal is resized, the size updates which allows
 * components to adjust their scroll position accordingly.
 */
export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(getInitialTerminalSize);

  useEffect(() => {
    const handleResize = (): void => {
      setSize(getInitialTerminalSize());
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

/**
 * Get the number of visible rows for scrollable content.
 * Uses initial terminal size so components don't resize when terminal changes.
 */
export function useVisibleRows(
  preferredRows: number | 'auto',
  minRows: number = 5,
  maxRows: number = 20
): number {
  // Use initial size so visible rows stay constant during resize
  const { contentRows } = useInitialTerminalSize();

  if (preferredRows === 'auto') {
    // Reserve space for header, summary, grade distribution, filter/sort bar, scroll indicator
    const available = Math.max(contentRows - 12, minRows);
    return Math.min(available, maxRows);
  }

  return Math.min(preferredRows, Math.max(contentRows - 12, minRows), maxRows);
}
