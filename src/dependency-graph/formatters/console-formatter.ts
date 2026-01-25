/**
 * Console Formatter
 * Formats dependency graph for terminal output with ASCII tree visualization
 */

import { DependencyGraph, DependencyNode, ConversionOrderResult } from '../types';
import { logger } from '../../utils/logger';

/**
 * Format and print the dependency graph to console
 */
export function formatConsoleOutput(
  graph: DependencyGraph,
  conversionOrder?: ConversionOrderResult,
  showOrphans: boolean = false
): void {
  logger.banner();
  logger.header('Dependency Graph Analysis');

  // Summary section
  printSummary(graph);

  // Dependency tree section
  if (graph.stats.totalNodes > 0) {
    printDependencyTree(graph);
  }

  // Circular dependencies section
  if (graph.circularGroups.length > 0) {
    printCircularDependencies(graph);
  }

  // Orphaned components section
  if (showOrphans && graph.orphans.length > 0) {
    printOrphans(graph);
  }

  // Conversion order section
  if (conversionOrder && conversionOrder.waves.length > 0) {
    printConversionOrder(conversionOrder);
  }
}

/**
 * Print summary statistics
 */
function printSummary(graph: DependencyGraph): void {
  const stats = graph.stats;

  const componentBreakdown: string[] = [];
  if (stats.auraComponents > 0) componentBreakdown.push(`${stats.auraComponents} Aura`);
  if (stats.vfPages > 0) componentBreakdown.push(`${stats.vfPages} VF`);

  const summaryItems: Array<{ label: string; value: string; type?: 'success' | 'warn' | 'info' }> = [
    {
      label: 'Components',
      value: `${stats.totalNodes}${componentBreakdown.length > 0 ? ` (${componentBreakdown.join(', ')})` : ''}`,
      type: 'info',
    },
    { label: 'Dependencies', value: stats.totalEdges.toString(), type: 'info' },
    { label: 'Max Depth', value: stats.maxDepth.toString(), type: 'info' },
  ];

  if (stats.circularDependencies > 0) {
    summaryItems.push({
      label: 'Circular Groups',
      value: `${stats.circularDependencies}`,
      type: 'warn',
    });
  }

  if (stats.orphanedComponents > 0) {
    summaryItems.push({
      label: 'Orphans',
      value: stats.orphanedComponents.toString(),
      type: 'info',
    });
  }

  if (stats.apexControllers > 0) {
    summaryItems.push({
      label: 'Apex Controllers',
      value: stats.apexControllers.toString(),
      type: 'info',
    });
  }

  logger.summaryBox('Summary', summaryItems);
}

/**
 * Print dependency tree visualization
 */
function printDependencyTree(graph: DependencyGraph): void {
  logger.subheader('Dependency Tree');

  // Build adjacency list
  const children = new Map<string, string[]>();
  for (const node of graph.nodes.keys()) {
    children.set(node, []);
  }
  for (const edge of graph.edges) {
    const deps = children.get(edge.from);
    if (deps) {
      deps.push(edge.to);
    }
  }

  // Start from roots (components that nothing depends on)
  const rootNodes = graph.roots.length > 0 ? graph.roots : findTopLevelNodes(graph);

  // Limit display for large graphs
  const maxRoots = 10;
  const displayRoots = rootNodes.slice(0, maxRoots);

  for (const rootId of displayRoots) {
    printNode(rootId, graph, children, '', true, new Set());
  }

  if (rootNodes.length > maxRoots) {
    console.log(`  ... and ${rootNodes.length - maxRoots} more root components`);
  }

  logger.blank();
}

/**
 * Find top-level nodes for display when there are no clear roots
 */
function findTopLevelNodes(graph: DependencyGraph): string[] {
  // Prioritize: roots, then nodes with highest out-degree, then by name
  const sorted = Array.from(graph.nodes.values())
    .filter((n) => n.type === 'aura' || n.type === 'vf')
    .sort((a, b) => {
      // First by in-degree (lower = more like a root)
      if (a.inDegree !== b.inDegree) return a.inDegree - b.inDegree;
      // Then by out-degree (higher = more dependencies to show)
      if (a.outDegree !== b.outDegree) return b.outDegree - a.outDegree;
      // Finally by name
      return a.name.localeCompare(b.name);
    });

  return sorted.map((n) => n.id);
}

/**
 * Print a single node and its children recursively
 */
function printNode(
  nodeId: string,
  graph: DependencyGraph,
  children: Map<string, string[]>,
  prefix: string,
  isLast: boolean,
  visited: Set<string>
): void {
  const node = graph.nodes.get(nodeId);
  if (!node) return;

  // Prevent infinite recursion in circular deps
  if (visited.has(nodeId)) {
    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${formatNodeName(node)} (circular ref)`);
    return;
  }

  visited.add(nodeId);

  const connector = isLast ? '└── ' : '├── ';
  const nodeDisplay = formatNodeName(node);
  console.log(`${prefix}${connector}${nodeDisplay}`);

  const deps = children.get(nodeId) || [];
  const childPrefix = prefix + (isLast ? '    ' : '│   ');

  // Limit children displayed per node
  const maxChildren = 5;
  const displayDeps = deps.slice(0, maxChildren);

  displayDeps.forEach((depId, index) => {
    const isLastChild = index === displayDeps.length - 1 && deps.length <= maxChildren;
    printNode(depId, graph, children, childPrefix, isLastChild, new Set(visited));
  });

  if (deps.length > maxChildren) {
    console.log(`${childPrefix}└── ... and ${deps.length - maxChildren} more`);
  }
}

/**
 * Format node name for display
 */
function formatNodeName(node: DependencyNode): string {
  const typeLabel = node.type === 'aura' ? 'Aura' : node.type === 'vf' ? 'VF' : node.type;
  let display = `${node.name} (${typeLabel})`;

  if (node.isCircular) {
    display += ' [CIRCULAR]';
  }
  if (node.isLeaf) {
    display += ' [leaf]';
  }

  return display;
}

/**
 * Print circular dependencies section
 */
function printCircularDependencies(graph: DependencyGraph): void {
  logger.subheader('Circular Dependencies');
  logger.warn(`Found ${graph.circularGroups.length} circular dependency group(s):`);
  logger.blank();

  for (let i = 0; i < graph.circularGroups.length; i++) {
    const group = graph.circularGroups[i];
    const names = group.map((id) => {
      const node = graph.nodes.get(id);
      return node ? node.name : id;
    });

    console.log(`  Group ${i + 1}: ${names.join(' <-> ')}`);
  }

  logger.blank();
}

/**
 * Print orphaned components section
 */
function printOrphans(graph: DependencyGraph): void {
  logger.subheader('Orphaned Components');
  logger.info('These components have no dependencies and nothing depends on them:');
  logger.blank();

  for (const orphanId of graph.orphans) {
    const node = graph.nodes.get(orphanId);
    if (node) {
      console.log(`  - ${node.name} (${node.type})`);
    }
  }

  logger.blank();
}

/**
 * Print conversion order section
 */
function printConversionOrder(order: ConversionOrderResult): void {
  logger.subheader('Recommended Conversion Order');
  logger.info('Convert in this order (leaf components first):');
  logger.blank();

  for (const wave of order.waves) {
    const waveDesc =
      wave.wave === 1
        ? 'no dependencies'
        : `depends on Wave ${wave.wave - 1}`;

    console.log(`  Wave ${wave.wave} (${wave.components.length} components - ${waveDesc}):`);

    // Display up to 10 components per wave
    const displayComponents = wave.components.slice(0, 10);
    for (const compId of displayComponents) {
      // Extract just the name from the ID
      const name = compId.replace(/^(c:|vf:)/, '');
      console.log(`    - ${name}`);
    }

    if (wave.components.length > 10) {
      console.log(`    ... and ${wave.components.length - 10} more`);
    }

    logger.blank();
  }

  // Print recommendations
  if (order.recommendations.length > 0) {
    logger.subheader('Recommendations');
    for (const rec of order.recommendations) {
      console.log(`  ${rec}`);
    }
    logger.blank();
  }

  // Summary
  logger.info(
    `Total: ${order.totalComponents} components in ${order.estimatedWaves} waves`
  );
}
