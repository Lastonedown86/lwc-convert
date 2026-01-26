import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import { Screen } from '../components/layout/Screen.js';
import { Tree } from '../components/data/Tree.js';
import { SearchInput } from '../components/forms/TextInput.js';
import { useStore } from '../store/index.js';
import { getTheme, getGradeColor } from '../themes/index.js';
import { useKeyBindings } from '../hooks/useKeyBindings.js';
import { useVisibleRows } from '../hooks/useTerminalSize.js';
import type { KeyBinding, TreeNode, ComponentInfo } from '../types.js';

export function ComponentBrowser(): React.ReactElement {
  const preferences = useStore((state) => state.preferences);
  const navigate = useStore((state) => state.navigate);
  const goBack = useStore((state) => state.goBack);
  const projectPath = useStore((state) => state.projectPath);
  const auraComponents = useStore((state) => state.auraComponents);
  const vfComponents = useStore((state) => state.vfComponents);
  const browser = useStore((state) => state.browser);
  const updateBrowserState = useStore((state) => state.updateBrowserState);
  const toggleNodeExpanded = useStore((state) => state.toggleNodeExpanded);
  const updateWizardState = useStore((state) => state.updateWizardState);

  const theme = getTheme(preferences.theme);
  const visibleRows = useVisibleRows(preferences.visibleRows);

  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Convert components to tree structure
  const treeData = useMemo((): TreeNode[] => {
    const searchQuery = browser.searchQuery.toLowerCase();

    const filterComponents = (components: ComponentInfo[]): ComponentInfo[] => {
      if (!searchQuery) return components;
      return components.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery) ||
          c.type.toLowerCase().includes(searchQuery)
      );
    };

    const filteredAura = filterComponents(auraComponents);
    const filteredVf = filterComponents(vfComponents);

    // Apply type filter
    const showAura = browser.filterType === 'all' || browser.filterType === 'aura';
    const showVf = browser.filterType === 'all' || browser.filterType === 'vf';

    const nodes: TreeNode[] = [];

    if (showAura && filteredAura.length > 0) {
      nodes.push({
        id: 'aura-root',
        label: `AURA COMPONENTS (${filteredAura.length})`,
        icon: '📦',
        children: filteredAura.map((component) => ({
          id: `aura-${component.id}`,
          label: component.name,
          icon: '⚡',
          metadata: {
            score: component.score,
            grade: component.grade,
            path: component.path,
            type: 'aura',
          },
          children: component.files.map((file) => ({
            id: `aura-${component.id}-${file}`,
            label: file,
            icon: getFileIcon(file),
          })),
        })),
      });
    }

    if (showVf && filteredVf.length > 0) {
      nodes.push({
        id: 'vf-root',
        label: `VISUALFORCE PAGES (${filteredVf.length})`,
        icon: '📄',
        children: filteredVf.map((component) => ({
          id: `vf-${component.id}`,
          label: component.name,
          icon: '📄',
          metadata: {
            score: component.score,
            grade: component.grade,
            path: component.path,
            type: 'vf',
          },
          children: component.files.map((file) => ({
            id: `vf-${component.id}-${file}`,
            label: file,
            icon: getFileIcon(file),
          })),
        })),
      });
    }

    return nodes;
  }, [auraComponents, vfComponents, browser.searchQuery, browser.filterType]);

  // Get flat list for navigation
  const flatNodes = useMemo(() => {
    const flat: TreeNode[] = [];
    const flatten = (nodes: TreeNode[], depth = 0): void => {
      for (const node of nodes) {
        flat.push(node);
        if (node.children && browser.expandedNodes.has(node.id)) {
          flatten(node.children, depth + 1);
        }
      }
    };
    flatten(treeData);
    return flat;
  }, [treeData, browser.expandedNodes]);

  const selectedIndex = flatNodes.findIndex((n) => n.id === selectedId);

  const footerBindings: KeyBinding[] = [
    { key: 'escape', action: () => isSearching ? setIsSearching(false) : goBack(), description: 'Back' },
    { key: '/', action: () => setIsSearching(true), description: 'Search' },
    {
      key: 'f',
      action: () => {
        const types = ['all', 'aura', 'vf'] as const;
        const currentIndex = types.indexOf(browser.filterType);
        updateBrowserState({ filterType: types[(currentIndex + 1) % types.length] });
      },
      description: 'Filter',
    },
    {
      key: 'return',
      action: () => {
        const node = flatNodes.find((n) => n.id === selectedId);
        if (node?.children) {
          toggleNodeExpanded(node.id);
        } else if (node?.metadata?.type) {
          // Open conversion wizard with this component
          updateWizardState({
            sourceType: node.metadata.type as 'aura' | 'vf',
            sourcePath: node.metadata.path as string,
          });
          navigate('wizard');
        }
      },
      description: 'Open/Convert',
    },
    {
      key: 'up',
      action: () => {
        const newIndex = Math.max(0, selectedIndex - 1);
        setSelectedId(flatNodes[newIndex]?.id || null);
      },
      description: 'Up',
    },
    {
      key: 'down',
      action: () => {
        const newIndex = Math.min(flatNodes.length - 1, selectedIndex + 1);
        setSelectedId(flatNodes[newIndex]?.id || null);
      },
      description: 'Down',
    },
  ];

  useKeyBindings(footerBindings, { isActive: !isSearching });

  // Initialize selected if null
  if (!selectedId && flatNodes.length > 0) {
    setSelectedId(flatNodes[0].id);
  }

  return (
    <Screen title="Component Browser" footerBindings={footerBindings}>
      <Box flexDirection="column" paddingY={1}>
        {/* Path and controls */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color={theme.textMuted}>
            Path: {projectPath}
          </Text>
          <Box gap={2}>
            <Text color={theme.textMuted}>
              Filter: <Text color={theme.accent}>{browser.filterType.toUpperCase()}</Text>
            </Text>
          </Box>
        </Box>

        {/* Search bar */}
        {isSearching && (
          <Box marginBottom={1}>
            <SearchInput
              value={browser.searchQuery}
              onChange={(value) => updateBrowserState({ searchQuery: value })}
              focus
            />
          </Box>
        )}

        {/* Tree view */}
        <Box
          borderStyle="single"
          borderColor={theme.border}
          flexDirection="column"
          paddingX={1}
        >
          {treeData.length === 0 ? (
            <Box paddingY={1}>
              <Text color={theme.textMuted}>
                {browser.searchQuery
                  ? 'No components match your search'
                  : 'No components found in this project'}
              </Text>
            </Box>
          ) : (
            <Tree
              data={treeData}
              expandedIds={browser.expandedNodes}
              selectedId={selectedId || undefined}
              maxRows={visibleRows}
              scrollOffset={browser.scrollOffset}
            />
          )}
        </Box>

        {/* Selected component info */}
        {selectedId && (
          <Box marginTop={1}>
            <Text color={theme.textMuted}>
              Selected: <Text color={theme.text}>{selectedId}</Text>
            </Text>
          </Box>
        )}
      </Box>
    </Screen>
  );
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'cmp':
    case 'html':
      return '🔷';
    case 'js':
      return '📜';
    case 'css':
      return '🎨';
    case 'page':
      return '📄';
    case 'cls':
      return '⚙️';
    default:
      return '📎';
  }
}
