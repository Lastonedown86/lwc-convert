import { useState, useEffect } from 'react';

export interface TerminalSize {
  columns: number;
  rows: number;
  contentRows: number;
}

const HEADER_ROWS = 2;
const FOOTER_ROWS = 2;

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
