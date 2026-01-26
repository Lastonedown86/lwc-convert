import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../store/index.js';
import { getTheme } from '../../themes/index.js';
import type { TreeNode } from '../../types.js';

export interface TreeProps {
  data: TreeNode[];
  expandedIds?: Set<string>;
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  onToggle?: (node: TreeNode) => void;
  maxRows?: number;
  scrollOffset?: number;
  indentSize?: number;
  showGuides?: boolean;
}

interface FlatNode {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

export function Tree({
  data,
  expandedIds = new Set(),
  selectedId,
  maxRows,
  scrollOffset = 0,
  indentSize = 2,
  showGuides = true,
}: TreeProps): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const theme = getTheme(preferences.theme);

  // Flatten tree for rendering
  const flatNodes: FlatNode[] = [];
  const flattenTree = (
    nodes: TreeNode[],
    depth: number = 0,
    parentIsLast: boolean[] = []
  ): void => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      flatNodes.push({ node, depth, isLast, parentIsLast: [...parentIsLast] });

      if (node.children && expandedIds.has(node.id)) {
        flattenTree(node.children, depth + 1, [...parentIsLast, isLast]);
      }
    });
  };

  flattenTree(data);

  if (flatNodes.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={theme.textMuted}>No items</Text>
      </Box>
    );
  }

  // Get visible nodes
  const visibleNodes = maxRows
    ? flatNodes.slice(scrollOffset, scrollOffset + maxRows)
    : flatNodes;

  return (
    <Box flexDirection="column">
      {visibleNodes.map(({ node, depth, isLast, parentIsLast }) => {
        const isSelected = node.id === selectedId;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);

        // Build the tree guide prefix
        let prefix = '';
        if (showGuides && depth > 0) {
          for (let i = 0; i < depth - 1; i++) {
            prefix += parentIsLast[i] ? '   ' : '│  ';
          }
          prefix += isLast ? '└──' : '├──';
        } else {
          prefix = ' '.repeat(depth * indentSize);
        }

        return (
          <Box
            key={node.id}
          >
            {/* Selection indicator */}
            <Text color={isSelected ? theme.accent : theme.text}>
              {isSelected ? '▶' : ' '}
            </Text>

            {/* Tree guides */}
            <Text color={theme.textMuted}>{prefix}</Text>

            {/* Expand/collapse indicator for folders */}
            {hasChildren ? (
              <Text color={theme.primary}>{isExpanded ? '▼ ' : '▶ '}</Text>
            ) : (
              <Text color={theme.textMuted}>  </Text>
            )}

            {/* Icon */}
            {node.icon && (
              <Text color={theme.text}>{node.icon} </Text>
            )}

            {/* Label */}
            <Text color={isSelected ? theme.text : theme.text} bold={hasChildren}>
              {node.label}
            </Text>

            {/* Metadata (e.g., score, grade) */}
            {node.metadata && (
              <Box marginLeft={2}>
                {node.metadata.score !== undefined && (
                  <Text color={theme.textMuted}>{node.metadata.score as number}</Text>
                )}
                {node.metadata.grade !== undefined && (
                  <Text color={theme.textMuted}> ({node.metadata.grade as string})</Text>
                )}
              </Box>
            )}
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {maxRows && flatNodes.length > maxRows && (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxRows, flatNodes.length)} of{' '}
            {flatNodes.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
