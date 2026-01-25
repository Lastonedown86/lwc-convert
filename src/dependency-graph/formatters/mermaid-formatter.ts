/**
 * Mermaid Formatter
 * Formats dependency graph as Mermaid diagram syntax
 */

import { DependencyGraph, DependencyNode, DependencyEdge } from '../types';

/**
 * Format the dependency graph as a Mermaid flowchart
 */
export function formatMermaidOutput(graph: DependencyGraph): string {
  const lines: string[] = [];

  lines.push('```mermaid');
  lines.push('graph TD');

  // Group nodes by type for subgraphs
  const auraNodes: DependencyNode[] = [];
  const vfNodes: DependencyNode[] = [];
  const apexNodes: DependencyNode[] = [];
  const otherNodes: DependencyNode[] = [];

  for (const node of graph.nodes.values()) {
    switch (node.type) {
      case 'aura':
        auraNodes.push(node);
        break;
      case 'vf':
        vfNodes.push(node);
        break;
      case 'apex':
        apexNodes.push(node);
        break;
      default:
        otherNodes.push(node);
    }
  }

  // Add Aura components subgraph
  if (auraNodes.length > 0) {
    lines.push('    subgraph Aura["Aura Components"]');
    for (const node of auraNodes) {
      const nodeId = sanitizeId(node.id);
      const label = node.name;
      lines.push(`        ${nodeId}[${label}]`);
    }
    lines.push('    end');
  }

  // Add VF pages subgraph
  if (vfNodes.length > 0) {
    lines.push('    subgraph VF["Visualforce Pages"]');
    for (const node of vfNodes) {
      const nodeId = sanitizeId(node.id);
      const label = node.name;
      lines.push(`        ${nodeId}{{${label}}}`);
    }
    lines.push('    end');
  }

  // Add Apex controllers subgraph
  if (apexNodes.length > 0) {
    lines.push('    subgraph Apex["Apex Controllers"]');
    for (const node of apexNodes) {
      const nodeId = sanitizeId(node.id);
      const label = node.name;
      lines.push(`        ${nodeId}[(${label})]`);
    }
    lines.push('    end');
  }

  // Add other nodes (base components, etc.)
  if (otherNodes.length > 0) {
    lines.push('    subgraph Other["Other Dependencies"]');
    for (const node of otherNodes) {
      const nodeId = sanitizeId(node.id);
      const label = node.name;
      lines.push(`        ${nodeId}(${label})`);
    }
    lines.push('    end');
  }

  lines.push('');

  // Add edges
  for (const edge of graph.edges) {
    const fromId = sanitizeId(edge.from);
    const toId = sanitizeId(edge.to);
    const arrow = getArrowStyle(edge);
    lines.push(`    ${fromId} ${arrow} ${toId}`);
  }

  lines.push('');

  // Add styling classes
  lines.push('    classDef aura fill:#1589FF,color:#fff,stroke:#0070d2');
  lines.push('    classDef vf fill:#FF6B35,color:#fff,stroke:#e65100');
  lines.push('    classDef apex fill:#00A1E0,color:#fff,stroke:#0070d2');
  lines.push('    classDef circular fill:#FF5252,color:#fff,stroke:#d32f2f');

  // Apply classes to nodes
  if (auraNodes.length > 0) {
    const auraIds = auraNodes.map((n) => sanitizeId(n.id)).join(',');
    lines.push(`    class ${auraIds} aura`);
  }

  if (vfNodes.length > 0) {
    const vfIds = vfNodes.map((n) => sanitizeId(n.id)).join(',');
    lines.push(`    class ${vfIds} vf`);
  }

  if (apexNodes.length > 0) {
    const apexIds = apexNodes.map((n) => sanitizeId(n.id)).join(',');
    lines.push(`    class ${apexIds} apex`);
  }

  // Mark circular nodes
  const circularNodes = Array.from(graph.nodes.values()).filter((n) => n.isCircular);
  if (circularNodes.length > 0) {
    const circularIds = circularNodes.map((n) => sanitizeId(n.id)).join(',');
    lines.push(`    class ${circularIds} circular`);
  }

  lines.push('```');

  return lines.join('\n');
}

/**
 * Sanitize node ID for Mermaid (remove special characters)
 */
function sanitizeId(id: string): string {
  // Replace colons and other special chars with underscores
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Get arrow style based on edge type
 */
function getArrowStyle(edge: DependencyEdge): string {
  switch (edge.type) {
    case 'component':
      return '-->';  // Solid arrow for component references
    case 'controller':
    case 'extension':
      return '-.->';  // Dotted arrow for Apex relationships
    case 'event':
      return '==>';  // Thick arrow for events
    case 'interface':
    case 'extends':
      return '-.->'; // Dotted for inheritance
    case 'include':
      return '-->';  // Solid for includes
    default:
      return '-->';
  }
}

/**
 * Format a simplified Mermaid diagram (for large graphs)
 */
export function formatSimpleMermaidOutput(
  graph: DependencyGraph,
  maxNodes: number = 30
): string {
  // For large graphs, only show the most connected nodes
  const sortedNodes = Array.from(graph.nodes.values())
    .filter((n) => n.type === 'aura' || n.type === 'vf')
    .sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree))
    .slice(0, maxNodes);

  const nodeIds = new Set(sortedNodes.map((n) => n.id));

  // Build a filtered graph
  const filteredGraph: DependencyGraph = {
    ...graph,
    nodes: new Map(sortedNodes.map((n) => [n.id, n])),
    edges: graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
  };

  return formatMermaidOutput(filteredGraph);
}
