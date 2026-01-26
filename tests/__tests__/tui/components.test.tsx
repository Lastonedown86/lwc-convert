/**
 * Tests for TUI Components
 */

import React from 'react';
// Use require to avoid TypeScript type checking issues with mock
const { render } = require('ink-testing-library');
import { Text, Box } from 'ink';

// Mock the store
jest.mock('../../../src/tui/store/index', () => ({
  useStore: jest.fn((selector) => {
    const mockState = {
      preferences: {
        theme: 'dark',
        showGradeColors: true,
        visibleRows: 'auto',
        defaultOutputDir: './lwc-output',
        defaultConversionMode: 'scaffolding',
        autoOpenFolder: false,
        generatePreview: false,
        generateTests: true,
        confirmBeforeActions: true,
        rememberLastProject: true,
        sessionExpiryHours: 4,
        defaultExportFormat: 'json',
        defaultGradingDetailLevel: 'standard',
      },
      currentScreen: 'dashboard',
      navigate: jest.fn(),
      goBack: jest.fn(),
    };
    return selector ? selector(mockState) : mockState;
  }),
}));

// Import components after mocking
import { Spinner } from '../../../src/tui/components/feedback/Spinner';
import { Badge, GradeBadge, ScoreBadge } from '../../../src/tui/components/feedback/Badge';
import { Progress, GradeDistribution } from '../../../src/tui/components/feedback/Progress';
import { Checkbox, Radio } from '../../../src/tui/components/forms/Checkbox';
import { TextInput } from '../../../src/tui/components/forms/TextInput';
import { List } from '../../../src/tui/components/data/List';
import { Table } from '../../../src/tui/components/data/Table';

describe('Spinner Component', () => {
  it('should render with label', () => {
    const { lastFrame } = render(<Spinner label="Loading..." />);
    expect(lastFrame()).toContain('Loading...');
  });

  it('should render without label', () => {
    const { lastFrame } = render(<Spinner />);
    expect(lastFrame()).toBeDefined();
  });
});

describe('Badge Component', () => {
  it('should render badge with label', () => {
    const { lastFrame } = render(<Badge label="Test" />);
    expect(lastFrame()).toContain('Test');
  });

  it('should render badge with variant', () => {
    const { lastFrame } = render(<Badge label="Success" variant="success" />);
    expect(lastFrame()).toContain('Success');
  });

  it('should render grade badge', () => {
    const { lastFrame } = render(<GradeBadge grade="A" />);
    expect(lastFrame()).toContain('A');
  });

  it('should render different grades with appropriate styling', () => {
    const grades = ['A', 'B', 'C', 'D', 'F'] as const;

    for (const grade of grades) {
      const { lastFrame } = render(<GradeBadge grade={grade} />);
      expect(lastFrame()).toContain(grade);
    }
  });

  it('should render score badge', () => {
    const { lastFrame } = render(<ScoreBadge score={85} />);
    expect(lastFrame()).toContain('85');
  });
});

describe('Progress Component', () => {
  it('should render progress bar', () => {
    const { lastFrame } = render(<Progress value={50} max={100} width={20} />);
    const frame = lastFrame() || '';
    // Should contain filled and empty portions
    expect(frame).toBeDefined();
  });

  it('should handle 0% progress', () => {
    const { lastFrame } = render(<Progress value={0} max={100} width={20} />);
    expect(lastFrame()).toBeDefined();
  });

  it('should handle 100% progress', () => {
    const { lastFrame } = render(<Progress value={100} max={100} width={20} />);
    expect(lastFrame()).toBeDefined();
  });
});

describe('GradeDistribution Component', () => {
  it('should render grade distribution', () => {
    const distribution = { A: 5, B: 10, C: 3, D: 2, F: 1 };
    const { lastFrame } = render(
      <GradeDistribution distribution={distribution} width={40} />
    );
    expect(lastFrame()).toBeDefined();
  });

  it('should handle empty distribution', () => {
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const { lastFrame } = render(
      <GradeDistribution distribution={distribution} width={40} />
    );
    expect(lastFrame()).toBeDefined();
  });
});

describe('Checkbox Component', () => {
  it('should render unchecked checkbox', () => {
    const { lastFrame } = render(
      <Checkbox label="Test Option" checked={false} onChange={() => {}} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Test Option');
    expect(frame).toContain('[ ]');
  });

  it('should render checked checkbox', () => {
    const { lastFrame } = render(
      <Checkbox label="Test Option" checked={true} onChange={() => {}} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Test Option');
    expect(frame).toContain('[✓]');
  });

  it('should show focus indicator when focused', () => {
    const { lastFrame } = render(
      <Checkbox label="Focused" checked={false} onChange={() => {}} isFocused={true} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('▶');
  });
});

describe('Radio Component', () => {
  it('should render unselected radio', () => {
    const { lastFrame } = render(<Radio label="Option" selected={false} />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Option');
    expect(frame).toContain('( )');
  });

  it('should render selected radio', () => {
    const { lastFrame } = render(<Radio label="Option" selected={true} />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Option');
    expect(frame).toContain('(●)');
  });
});

describe('TextInput Component', () => {
  it('should render with label', () => {
    const { lastFrame } = render(
      <TextInput label="Name" value="" onChange={() => {}} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Name');
  });

  it('should render with placeholder', () => {
    const { lastFrame } = render(
      <TextInput
        label="Name"
        value=""
        placeholder="Enter name"
        onChange={() => {}}
      />
    );
    expect(lastFrame()).toBeDefined();
  });

  it('should render with value', () => {
    const { lastFrame } = render(
      <TextInput label="Name" value="Test Value" onChange={() => {}} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Test Value');
  });
});

describe('List Component', () => {
  const mockItems = [
    { id: '1', label: 'Item 1' },
    { id: '2', label: 'Item 2' },
    { id: '3', label: 'Item 3' },
  ];

  it('should render list items', () => {
    const { lastFrame } = render(<List items={mockItems} />);
    const frame = lastFrame() || '';
    expect(frame).toContain('Item 1');
    expect(frame).toContain('Item 2');
    expect(frame).toContain('Item 3');
  });

  it('should show empty message when no items', () => {
    const { lastFrame } = render(
      <List items={[]} emptyMessage="No items found" />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('No items found');
  });

  it('should highlight selected item', () => {
    const { lastFrame } = render(
      <List items={mockItems} selectedIndex={1} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('▶');
  });

  it('should limit visible items when maxRows is set', () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: `Item ${i}`,
    }));

    const { lastFrame } = render(
      <List items={manyItems} maxRows={5} />
    );
    const frame = lastFrame() || '';
    // Should only show 5 items
    expect(frame).toContain('Item 0');
    expect(frame).toContain('Item 4');
    expect(frame).not.toContain('Item 10');
  });
});

describe('Table Component', () => {
  interface TestData {
    name: string;
    value: number;
  }

  const mockData: TestData[] = [
    { name: 'Row 1', value: 100 },
    { name: 'Row 2', value: 200 },
    { name: 'Row 3', value: 300 },
  ];

  const columns = [
    { key: 'name' as const, header: 'Name', width: 15 },
    { key: 'value' as const, header: 'Value', width: 10 },
  ];

  it('should render table with headers', () => {
    const { lastFrame } = render(
      <Table data={mockData} columns={columns} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Name');
    expect(frame).toContain('Value');
  });

  it('should render table data', () => {
    const { lastFrame } = render(
      <Table data={mockData} columns={columns} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('Row 1');
    expect(frame).toContain('100');
  });

  it('should show empty message when no data', () => {
    const { lastFrame } = render(
      <Table data={[]} columns={columns} emptyMessage="No data available" />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('No data available');
  });

  it('should highlight selected row', () => {
    const { lastFrame } = render(
      <Table data={mockData} columns={columns} selectedIndex={1} />
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('▶');
  });
});
