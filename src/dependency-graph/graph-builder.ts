/**
 * Graph Builder
 * Constructs a dependency graph from component analysis results
 * Calculates metrics, detects circular dependencies, and identifies orphans/leaves
 */

import {
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  GraphStats,
  ComponentAnalysisResult,
  ComponentType,
} from './types';

/**
 * Build a dependency graph from analysis results
 */
export function buildGraph(
  analysisResults: ComponentAnalysisResult[],
  includeBaseComponents: boolean = false
): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];

  // First pass: create nodes for all analyzed components
  for (const result of analysisResults) {
    if (!nodes.has(result.id)) {
      nodes.set(result.id, createNode(result.id, result.name, result.type, result.filePath));
    }
  }

  // Second pass: create edges and potentially discover new nodes from dependencies
  for (const result of analysisResults) {
    for (const dep of result.dependencies) {
      // Skip base components unless explicitly included
      if (dep.type === 'baseComponent' && !includeBaseComponents) {
        continue;
      }

      // Create node for dependency target if it doesn't exist
      if (!nodes.has(dep.target)) {
        const nodeType = inferNodeType(dep.target);
        const nodeName = extractName(dep.target);
        nodes.set(dep.target, createNode(dep.target, nodeName, nodeType, ''));
      }

      // Create edge
      edges.push({
        from: result.id,
        to: dep.target,
        type: dep.type,
        metadata: {
          lineNumber: dep.lineNumber,
          expression: dep.expression,
        },
      });
    }
  }

  // Calculate in-degree and out-degree for each node
  for (const node of nodes.values()) {
    node.outDegree = edges.filter((e) => e.from === node.id).length;
    node.inDegree = edges.filter((e) => e.to === node.id).length;
  }

  // Detect circular dependencies
  const circularGroups = detectCircularDependencies(nodes, edges);

  // Mark nodes that are part of circular dependencies
  for (const group of circularGroups) {
    for (const nodeId of group) {
      const node = nodes.get(nodeId);
      if (node) {
        node.isCircular = true;
        node.circularGroup = group;
      }
    }
  }

  // Identify leaves, roots, and orphans
  const roots: string[] = [];
  const leaves: string[] = [];
  const orphans: string[] = [];

  for (const [id, node] of nodes) {
    // Root: has no incoming dependencies (nothing depends on it)
    if (node.inDegree === 0 && node.outDegree > 0) {
      roots.push(id);
    }

    // Leaf: has no outgoing dependencies (doesn't depend on anything in the graph)
    if (node.outDegree === 0 && node.inDegree > 0) {
      leaves.push(id);
      node.isLeaf = true;
    }

    // Orphan: completely isolated
    if (node.inDegree === 0 && node.outDegree === 0) {
      orphans.push(id);
      node.isOrphan = true;
    }
  }

  // Calculate depth for each node (longest path from a root)
  calculateDepths(nodes, edges, roots);

  // Calculate statistics
  const stats = calculateStats(nodes, edges, circularGroups, orphans);

  return {
    nodes,
    edges,
    roots,
    leaves,
    orphans,
    circularGroups,
    stats,
  };
}

/**
 * Create a new dependency node
 */
function createNode(
  id: string,
  name: string,
  type: ComponentType,
  filePath: string
): DependencyNode {
  return {
    id,
    name,
    type,
    filePath,
    inDegree: 0,
    outDegree: 0,
    depth: 0,
    isOrphan: false,
    isLeaf: false,
    isCircular: false,
  };
}

/**
 * Infer node type from its ID prefix
 */
function inferNodeType(id: string): ComponentType {
  if (id.startsWith('c:')) return 'aura';
  if (id.startsWith('vf:')) return 'vf';
  if (id.startsWith('apex:')) return 'apex';
  if (id.startsWith('lightning:') || id.startsWith('ui:') || id.startsWith('force:')) {
    return 'lwc'; // Base components treated as LWC
  }
  return 'aura'; // Default
}

/**
 * Extract readable name from node ID
 */
function extractName(id: string): string {
  // Remove prefixes like "c:", "vf:", "apex:"
  const prefixMatch = id.match(/^(?:c:|vf:|apex:|lightning:|ui:|force:|sobject:|resource:|label:)(.+)$/);
  if (prefixMatch) {
    return prefixMatch[1];
  }
  return id;
}

/**
 * Detect circular dependencies using Tarjan's algorithm for strongly connected components
 */
function detectCircularDependencies(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[]
): string[][] {
  const circularGroups: string[][] = [];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const node of nodes.keys()) {
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from);
    if (neighbors) {
      neighbors.push(edge.to);
    }
  }

  // Tarjan's algorithm
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();

  function strongConnect(nodeId: string): void {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(neighbor)!));
      }
    }

    // If this is a root node of an SCC
    if (lowLinks.get(nodeId) === indices.get(nodeId)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== nodeId);

      // Only include SCCs with more than one node (actual cycles)
      if (component.length > 1) {
        circularGroups.push(component);
      }
    }
  }

  for (const nodeId of nodes.keys()) {
    if (!indices.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return circularGroups;
}

/**
 * Calculate depth for each node using BFS from roots
 */
function calculateDepths(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  roots: string[]
): void {
  // Build adjacency list for traversal
  const adjacency = new Map<string, string[]>();
  for (const node of nodes.keys()) {
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.from);
    if (neighbors) {
      neighbors.push(edge.to);
    }
  }

  // BFS from each root
  const maxDepths = new Map<string, number>();

  function bfs(startId: string): void {
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      // Update max depth for this node
      const currentMax = maxDepths.get(id) || 0;
      maxDepths.set(id, Math.max(currentMax, depth));

      // Avoid infinite loops in circular deps
      const visitKey = `${id}:${depth}`;
      if (visited.has(visitKey) || depth > 100) continue;
      visited.add(visitKey);

      const neighbors = adjacency.get(id) || [];
      for (const neighbor of neighbors) {
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }
  }

  // Start BFS from roots, or from all nodes if no roots
  const startNodes = roots.length > 0 ? roots : Array.from(nodes.keys());
  for (const startId of startNodes) {
    bfs(startId);
  }

  // Apply depths to nodes
  for (const [id, depth] of maxDepths) {
    const node = nodes.get(id);
    if (node) {
      node.depth = depth;
    }
  }
}

/**
 * Calculate graph statistics
 */
function calculateStats(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  circularGroups: string[][],
  orphans: string[]
): GraphStats {
  let auraCount = 0;
  let vfCount = 0;
  let apexCount = 0;
  let maxDepth = 0;
  let totalConnections = 0;

  for (const node of nodes.values()) {
    if (node.type === 'aura') auraCount++;
    if (node.type === 'vf') vfCount++;
    if (node.type === 'apex') apexCount++;
    if (node.depth > maxDepth) maxDepth = node.depth;
    totalConnections += node.inDegree + node.outDegree;
  }

  return {
    totalNodes: nodes.size,
    totalEdges: edges.length,
    auraComponents: auraCount,
    vfPages: vfCount,
    apexControllers: apexCount,
    maxDepth,
    averageConnections: nodes.size > 0 ? totalConnections / nodes.size : 0,
    circularDependencies: circularGroups.length,
    orphanedComponents: orphans.length,
  };
}

/**
 * Filter graph to focus on a specific component and its dependencies
 */
export function filterGraphByFocus(
  graph: DependencyGraph,
  focusComponent: string,
  maxDepth: number = 0
): DependencyGraph {
  const focusId = normalizeFocusId(focusComponent, graph.nodes);

  if (!focusId || !graph.nodes.has(focusId)) {
    // Return empty graph if focus not found
    return {
      nodes: new Map(),
      edges: [],
      roots: [],
      leaves: [],
      orphans: [],
      circularGroups: [],
      stats: {
        totalNodes: 0,
        totalEdges: 0,
        auraComponents: 0,
        vfPages: 0,
        apexControllers: 0,
        maxDepth: 0,
        averageConnections: 0,
        circularDependencies: 0,
        orphanedComponents: 0,
      },
    };
  }

  // Collect all related nodes (both upstream and downstream)
  const relatedNodes = new Set<string>();
  relatedNodes.add(focusId);

  // BFS to find all connected nodes
  const queue: Array<{ id: string; depth: number }> = [{ id: focusId, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (visited.has(id)) continue;
    visited.add(id);

    if (maxDepth > 0 && depth > maxDepth) continue;

    relatedNodes.add(id);

    // Find outgoing edges (dependencies)
    for (const edge of graph.edges) {
      if (edge.from === id && !visited.has(edge.to)) {
        queue.push({ id: edge.to, depth: depth + 1 });
      }
    }

    // Find incoming edges (dependents)
    for (const edge of graph.edges) {
      if (edge.to === id && !visited.has(edge.from)) {
        queue.push({ id: edge.from, depth: depth + 1 });
      }
    }
  }

  // Build filtered graph
  const filteredNodes = new Map<string, DependencyNode>();
  for (const nodeId of relatedNodes) {
    const node = graph.nodes.get(nodeId);
    if (node) {
      filteredNodes.set(nodeId, { ...node });
    }
  }

  const filteredEdges = graph.edges.filter(
    (e) => relatedNodes.has(e.from) && relatedNodes.has(e.to)
  );

  // Recalculate metrics for filtered graph
  return buildGraphFromNodesAndEdges(filteredNodes, filteredEdges);
}

/**
 * Normalize focus component ID (handle various input formats)
 */
function normalizeFocusId(
  focusComponent: string,
  nodes: Map<string, DependencyNode>
): string | null {
  // Try exact match
  if (nodes.has(focusComponent)) {
    return focusComponent;
  }

  // Try with c: prefix
  if (nodes.has(`c:${focusComponent}`)) {
    return `c:${focusComponent}`;
  }

  // Try with vf: prefix
  if (nodes.has(`vf:${focusComponent}`)) {
    return `vf:${focusComponent}`;
  }

  // Try case-insensitive match
  const lowerFocus = focusComponent.toLowerCase();
  for (const id of nodes.keys()) {
    if (id.toLowerCase() === lowerFocus || id.toLowerCase().endsWith(`:${lowerFocus}`)) {
      return id;
    }
  }

  return null;
}

/**
 * Rebuild graph from filtered nodes and edges
 */
function buildGraphFromNodesAndEdges(
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[]
): DependencyGraph {
  // Recalculate degrees
  for (const node of nodes.values()) {
    node.outDegree = edges.filter((e) => e.from === node.id).length;
    node.inDegree = edges.filter((e) => e.to === node.id).length;
  }

  // Recalculate circular dependencies
  const circularGroups = detectCircularDependencies(nodes, edges);

  for (const node of nodes.values()) {
    node.isCircular = false;
    node.circularGroup = undefined;
  }

  for (const group of circularGroups) {
    for (const nodeId of group) {
      const node = nodes.get(nodeId);
      if (node) {
        node.isCircular = true;
        node.circularGroup = group;
      }
    }
  }

  // Recalculate roots, leaves, orphans
  const roots: string[] = [];
  const leaves: string[] = [];
  const orphans: string[] = [];

  for (const [id, node] of nodes) {
    node.isLeaf = false;
    node.isOrphan = false;

    if (node.inDegree === 0 && node.outDegree > 0) {
      roots.push(id);
    }

    if (node.outDegree === 0 && node.inDegree > 0) {
      leaves.push(id);
      node.isLeaf = true;
    }

    if (node.inDegree === 0 && node.outDegree === 0) {
      orphans.push(id);
      node.isOrphan = true;
    }
  }

  // Recalculate depths
  calculateDepths(nodes, edges, roots);

  // Recalculate stats
  const stats = calculateStats(nodes, edges, circularGroups, orphans);

  return {
    nodes,
    edges,
    roots,
    leaves,
    orphans,
    circularGroups,
    stats,
  };
}
