/**
 * JSON Formatter
 * Formats dependency graph as JSON for export or programmatic consumption
 */

import { DependencyGraph, DependencyNode, DependencyEdge, ConversionOrderResult } from '../types';
import { CLI_VERSION } from '../../cli/options';

export interface JsonGraphOutput {
  generatedAt: string;
  version: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    auraComponents: number;
    vfPages: number;
    apexControllers: number;
    maxDepth: number;
    circularDependencies: number;
    orphanedComponents: number;
  };
  nodes: JsonNode[];
  edges: JsonEdge[];
  circularGroups: string[][];
  conversionOrder?: {
    waves: Array<{
      wave: number;
      components: string[];
      blockedBy: string[];
      effort: { estimated: number; components: number };
    }>;
    recommendations: string[];
    totalComponents: number;
    estimatedWaves: number;
  };
}

interface JsonNode {
  id: string;
  name: string;
  type: string;
  filePath: string;
  inDegree: number;
  outDegree: number;
  depth: number;
  isLeaf: boolean;
  isOrphan: boolean;
  isCircular: boolean;
  circularGroup?: string[];
  conversionGrade?: string;
  conversionScore?: number;
}

interface JsonEdge {
  from: string;
  to: string;
  type: string;
  metadata: {
    lineNumber?: number;
    expression?: string;
    bidirectional?: boolean;
  };
}

/**
 * Format the dependency graph as a JSON object
 */
export function formatJsonOutput(
  graph: DependencyGraph,
  conversionOrder?: ConversionOrderResult
): JsonGraphOutput {
  // Convert Map to array for JSON serialization
  const nodes: JsonNode[] = Array.from(graph.nodes.values()).map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    filePath: node.filePath,
    inDegree: node.inDegree,
    outDegree: node.outDegree,
    depth: node.depth,
    isLeaf: node.isLeaf,
    isOrphan: node.isOrphan,
    isCircular: node.isCircular,
    circularGroup: node.circularGroup,
    conversionGrade: node.conversionGrade,
    conversionScore: node.conversionScore,
  }));

  // Sort nodes for consistent output
  nodes.sort((a, b) => {
    // Sort by type first, then by name
    if (a.type !== b.type) {
      const typeOrder = { aura: 0, vf: 1, apex: 2, lwc: 3 };
      return (typeOrder[a.type as keyof typeof typeOrder] || 4) -
        (typeOrder[b.type as keyof typeof typeOrder] || 4);
    }
    return a.name.localeCompare(b.name);
  });

  const edges: JsonEdge[] = graph.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    type: edge.type,
    metadata: edge.metadata,
  }));

  const output: JsonGraphOutput = {
    generatedAt: new Date().toISOString(),
    version: CLI_VERSION,
    stats: {
      totalNodes: graph.stats.totalNodes,
      totalEdges: graph.stats.totalEdges,
      auraComponents: graph.stats.auraComponents,
      vfPages: graph.stats.vfPages,
      apexControllers: graph.stats.apexControllers,
      maxDepth: graph.stats.maxDepth,
      circularDependencies: graph.stats.circularDependencies,
      orphanedComponents: graph.stats.orphanedComponents,
    },
    nodes,
    edges,
    circularGroups: graph.circularGroups,
  };

  if (conversionOrder) {
    output.conversionOrder = {
      waves: conversionOrder.waves,
      recommendations: conversionOrder.recommendations,
      totalComponents: conversionOrder.totalComponents,
      estimatedWaves: conversionOrder.estimatedWaves,
    };
  }

  return output;
}

/**
 * Serialize the JSON output to a string
 */
export function serializeJson(output: JsonGraphOutput, pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(output, null, 2);
  }
  return JSON.stringify(output);
}
