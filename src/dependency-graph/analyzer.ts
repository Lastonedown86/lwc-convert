/**
 * Dependency Graph Analyzer
 * Main orchestrator that coordinates scanning, analysis, and graph building
 */

import * as path from 'path';
import { logger } from '../utils/logger';
import {
  DependencyGraph,
  DependencyAnalysisOptions,
  ComponentAnalysisResult,
} from './types';
import { scanAuraComponents, analyzeAuraComponent } from './aura-dependency-analyzer';
import { scanVfPages, analyzeVfPage } from './vf-dependency-analyzer';
import { buildGraph, filterGraphByFocus } from './graph-builder';

/**
 * Main analyzer class for dependency graph analysis
 */
export class DependencyAnalyzer {
  /**
   * Analyze dependencies based on provided options
   */
  async analyze(options: DependencyAnalysisOptions): Promise<DependencyGraph> {
    const analysisResults: ComponentAnalysisResult[] = [];

    const targetPath = options.targetPath || process.cwd();

    logger.debug(`Analyzing dependencies at: ${targetPath}`);
    logger.debug(`Type filter: ${options.type}`);
    logger.debug(`Include base components: ${options.includeBaseComponents}`);

    // Scan for components based on type
    if (options.type === 'aura' || options.type === 'both') {
      logger.debug('Scanning for Aura components...');
      const auraResults = await scanAuraComponents(targetPath, options.includeBaseComponents);
      logger.debug(`Found ${auraResults.length} Aura components`);
      analysisResults.push(...auraResults);
    }

    if (options.type === 'vf' || options.type === 'both') {
      logger.debug('Scanning for Visualforce pages...');
      const vfResults = await scanVfPages(targetPath);
      logger.debug(`Found ${vfResults.length} VF pages`);
      analysisResults.push(...vfResults);
    }

    if (analysisResults.length === 0) {
      logger.debug('No components found to analyze');
      return createEmptyGraph();
    }

    // Build the dependency graph
    logger.debug('Building dependency graph...');
    let graph = buildGraph(analysisResults, options.includeBaseComponents);

    // Filter by focus component if specified
    if (options.focusComponent) {
      logger.debug(`Filtering graph to focus on: ${options.focusComponent}`);
      graph = filterGraphByFocus(graph, options.focusComponent, options.maxDepth);
    }

    // Filter to show only circular dependencies if requested
    if (options.circularOnly) {
      graph = filterToCircularOnly(graph);
    }

    // Filter out orphans if not requested
    if (!options.showOrphans) {
      graph = filterOutOrphans(graph);
    }

    logger.debug(`Graph built: ${graph.stats.totalNodes} nodes, ${graph.stats.totalEdges} edges`);

    return graph;
  }

  /**
   * Analyze a single component
   */
  async analyzeComponent(
    componentPath: string,
    type: 'aura' | 'vf'
  ): Promise<ComponentAnalysisResult | null> {
    if (type === 'aura') {
      return analyzeAuraComponent(componentPath, false);
    } else {
      return analyzeVfPage(componentPath);
    }
  }
}

/**
 * Create an empty graph structure
 */
function createEmptyGraph(): DependencyGraph {
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

/**
 * Filter graph to only show components involved in circular dependencies
 */
function filterToCircularOnly(graph: DependencyGraph): DependencyGraph {
  if (graph.circularGroups.length === 0) {
    return createEmptyGraph();
  }

  const circularNodeIds = new Set<string>();
  for (const group of graph.circularGroups) {
    for (const nodeId of group) {
      circularNodeIds.add(nodeId);
    }
  }

  const filteredNodes = new Map(
    Array.from(graph.nodes.entries()).filter(([id]) => circularNodeIds.has(id))
  );

  const filteredEdges = graph.edges.filter(
    (e) => circularNodeIds.has(e.from) && circularNodeIds.has(e.to)
  );

  return {
    ...graph,
    nodes: filteredNodes,
    edges: filteredEdges,
    roots: [],
    leaves: [],
    orphans: [],
    stats: {
      ...graph.stats,
      totalNodes: filteredNodes.size,
      totalEdges: filteredEdges.length,
      orphanedComponents: 0,
    },
  };
}

/**
 * Filter out orphaned components from the graph
 */
function filterOutOrphans(graph: DependencyGraph): DependencyGraph {
  const filteredNodes = new Map(
    Array.from(graph.nodes.entries()).filter(([_, node]) => !node.isOrphan)
  );

  // Edges shouldn't change since orphans have no connections
  return {
    ...graph,
    nodes: filteredNodes,
    orphans: [],
    stats: {
      ...graph.stats,
      totalNodes: filteredNodes.size,
      orphanedComponents: 0,
    },
  };
}

// Export singleton instance for convenience
export const dependencyAnalyzer = new DependencyAnalyzer();
