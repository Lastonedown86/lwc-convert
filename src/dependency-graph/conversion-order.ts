/**
 * Conversion Order Calculator
 * Uses topological sorting to determine optimal conversion order
 * Components with no dependencies (leaves) should be converted first
 */

import {
  DependencyGraph,
  DependencyNode,
  ConversionWave,
  ConversionOrderResult,
} from './types';

/**
 * Calculate the recommended conversion order using reverse topological sort
 * Leaf nodes (components that don't depend on other custom components) are converted first
 */
export function calculateConversionOrder(graph: DependencyGraph): ConversionOrderResult {
  const waves: ConversionWave[] = [];
  const recommendations: string[] = [];

  // Filter to only include Aura and VF components (not Apex, base components, etc.)
  const convertibleNodes = new Map<string, DependencyNode>();
  for (const [id, node] of graph.nodes) {
    if (node.type === 'aura' || node.type === 'vf') {
      convertibleNodes.set(id, node);
    }
  }

  if (convertibleNodes.size === 0) {
    return {
      waves: [],
      circularDependencies: graph.circularGroups,
      recommendations: ['No Aura or Visualforce components found to convert.'],
      totalComponents: 0,
      estimatedWaves: 0,
    };
  }

  // Build adjacency list for dependencies (only between convertible components)
  const dependsOn = new Map<string, Set<string>>();
  const dependedOnBy = new Map<string, Set<string>>();

  for (const id of convertibleNodes.keys()) {
    dependsOn.set(id, new Set());
    dependedOnBy.set(id, new Set());
  }

  for (const edge of graph.edges) {
    // Only count edges between convertible components
    if (convertibleNodes.has(edge.from) && convertibleNodes.has(edge.to)) {
      // edge.from depends on edge.to
      dependsOn.get(edge.from)?.add(edge.to);
      dependedOnBy.get(edge.to)?.add(edge.from);
    }
  }

  // Track converted components
  const converted = new Set<string>();
  const inCircularDep = new Set<string>();

  // Mark components in circular dependencies
  for (const group of graph.circularGroups) {
    for (const nodeId of group) {
      if (convertibleNodes.has(nodeId)) {
        inCircularDep.add(nodeId);
      }
    }
  }

  let waveNumber = 1;

  // Process waves until all components are converted
  while (converted.size < convertibleNodes.size) {
    const waveComponents: string[] = [];

    // Find components that can be converted in this wave
    // A component can be converted if all its dependencies have been converted
    // (excluding circular dependencies which are handled separately)
    for (const [id, node] of convertibleNodes) {
      if (converted.has(id)) continue;

      const deps = dependsOn.get(id) || new Set();
      const unconvertedDeps = Array.from(deps).filter(
        (depId) => !converted.has(depId) && convertibleNodes.has(depId)
      );

      // Check if all non-circular dependencies are satisfied
      const nonCircularUnconverted = unconvertedDeps.filter((d) => !inCircularDep.has(d));

      if (nonCircularUnconverted.length === 0) {
        // This component can be converted (or is part of a circular group)
        waveComponents.push(id);
      }
    }

    if (waveComponents.length === 0) {
      // We're stuck - remaining components are in circular dependencies
      // Add all remaining circular dependency components to the final wave
      const remaining = Array.from(convertibleNodes.keys()).filter(
        (id) => !converted.has(id)
      );

      if (remaining.length > 0) {
        const circularWave: ConversionWave = {
          wave: waveNumber,
          components: remaining,
          blockedBy: [], // Self-blocking due to circular deps
          effort: {
            estimated: remaining.length * 4, // Higher estimate for circular deps
            components: remaining.length,
          },
        };
        waves.push(circularWave);

        for (const id of remaining) {
          converted.add(id);
        }

        recommendations.push(
          `Wave ${waveNumber} contains circular dependencies that require coordinated conversion.`
        );
      }
      break;
    }

    // Sort wave components for consistent output
    waveComponents.sort((a, b) => {
      const nodeA = convertibleNodes.get(a)!;
      const nodeB = convertibleNodes.get(b)!;
      // Sort by type first (aura before vf), then by name
      if (nodeA.type !== nodeB.type) {
        return nodeA.type === 'aura' ? -1 : 1;
      }
      return nodeA.name.localeCompare(nodeB.name);
    });

    // Calculate what this wave was blocked by
    const blockedBy = new Set<string>();
    for (const compId of waveComponents) {
      const deps = dependsOn.get(compId) || new Set();
      for (const dep of deps) {
        if (converted.has(dep)) {
          blockedBy.add(dep);
        }
      }
    }

    const wave: ConversionWave = {
      wave: waveNumber,
      components: waveComponents,
      blockedBy: Array.from(blockedBy),
      effort: {
        estimated: waveComponents.length * 2, // Base estimate: 2 hours per component
        components: waveComponents.length,
      },
    };

    waves.push(wave);

    // Mark as converted
    for (const id of waveComponents) {
      converted.add(id);
    }

    waveNumber++;
  }

  // Generate recommendations
  if (waves.length > 0) {
    const firstWave = waves[0];
    if (firstWave.components.length > 0) {
      recommendations.push(
        `Start with Wave 1 (${firstWave.components.length} components) - these have no dependencies on other custom components.`
      );
    }
  }

  if (graph.circularGroups.length > 0) {
    recommendations.push(
      `${graph.circularGroups.length} circular dependency group(s) detected. These components should be converted together.`
    );

    for (let i = 0; i < graph.circularGroups.length; i++) {
      const group = graph.circularGroups[i];
      const names = group
        .filter((id) => convertibleNodes.has(id))
        .map((id) => convertibleNodes.get(id)!.name)
        .join(', ');
      if (names) {
        recommendations.push(`  Circular group ${i + 1}: ${names}`);
      }
    }
  }

  if (graph.stats.apexControllers > 0) {
    recommendations.push(
      `${graph.stats.apexControllers} Apex controllers detected. Consider refactoring to use @AuraEnabled methods or LWC wire adapters.`
    );
  }

  return {
    waves,
    circularDependencies: graph.circularGroups,
    recommendations,
    totalComponents: convertibleNodes.size,
    estimatedWaves: waves.length,
  };
}

/**
 * Get a simple ordered list of components (flattened waves)
 */
export function getOrderedComponentList(graph: DependencyGraph): string[] {
  const result = calculateConversionOrder(graph);
  const ordered: string[] = [];

  for (const wave of result.waves) {
    ordered.push(...wave.components);
  }

  return ordered;
}

/**
 * Check if a component can be safely converted given the current conversion state
 */
export function canConvertComponent(
  componentId: string,
  graph: DependencyGraph,
  alreadyConverted: Set<string>
): { canConvert: boolean; blockedBy: string[] } {
  const node = graph.nodes.get(componentId);
  if (!node) {
    return { canConvert: false, blockedBy: [] };
  }

  // Get dependencies of this component
  const dependencies = graph.edges
    .filter((e) => e.from === componentId)
    .map((e) => e.to)
    .filter((id) => {
      const depNode = graph.nodes.get(id);
      return depNode && (depNode.type === 'aura' || depNode.type === 'vf');
    });

  // Check which dependencies haven't been converted yet
  const blockedBy = dependencies.filter((id) => !alreadyConverted.has(id));

  return {
    canConvert: blockedBy.length === 0,
    blockedBy,
  };
}
