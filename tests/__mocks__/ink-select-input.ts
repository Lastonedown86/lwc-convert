/**
 * Mock for ink-select-input
 */

import React from 'react';

interface Item<V> {
  label: string;
  value: V;
}

interface SelectInputProps<V> {
  items: Item<V>[];
  initialIndex?: number;
  isFocused?: boolean;
  indicatorComponent?: React.ComponentType<{ isSelected?: boolean }>;
  itemComponent?: React.ComponentType<{ isSelected?: boolean; label: string }>;
  limit?: number;
  onSelect?: (item: Item<V>) => void;
  onHighlight?: (item: Item<V>) => void;
}

function SelectInput<V>({ items, initialIndex = 0 }: SelectInputProps<V>) {
  const selectedItem = items[initialIndex] || items[0];
  return React.createElement(
    'ink-select-input',
    {},
    items.map((item, index) =>
      React.createElement(
        'ink-select-item',
        { key: index, selected: index === initialIndex },
        item.label
      )
    )
  );
}

export default SelectInput;
