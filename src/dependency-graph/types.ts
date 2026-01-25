/**
 * Type definitions for the Dependency Graph Visualizer feature
 */

export type ComponentType = 'aura' | 'vf' | 'lwc' | 'apex';

export type DependencyType =
  | 'component'       // c:childComponent
  | 'event'           // Application/component events
  | 'controller'      // Apex controller binding
  | 'extension'       // VF controller extension
  | 'interface'       // implements="..."
  | 'extends'         // extends="..."
  | 'include'         // apex:include
  | 'lms'             // Lightning Message Service
  | 'staticResource'  // $Resource references
  | 'label'           // $Label references
  | 'baseComponent';  // lightning:*, ui:*, force:*

export interface DependencyNode {
  id: string;                     // Unique identifier (e.g., "c:AccountCard")
  name: string;                   // Component name
  type: ComponentType;            // aura, vf, lwc, apex
  filePath: string;               // Path to source file

  // Metrics
  inDegree: number;               // Number of components that depend on this
  outDegree: number;              // Number of components this depends on
  depth: number;                  // Depth in dependency tree

  // Analysis metadata
  isOrphan: boolean;              // Has no incoming or outgoing dependencies
  isLeaf: boolean;                // Has no outgoing dependencies (safe to convert first)
  isCircular: boolean;            // Part of a circular dependency
  circularGroup?: string[];       // Other nodes in the circular chain

  // Optional grading integration
  conversionGrade?: string;       // From grading system if available
  conversionScore?: number;
}

export interface DependencyEdge {
  from: string;                   // Source node ID
  to: string;                     // Target node ID
  type: DependencyType;           // Type of dependency
  metadata: {
    lineNumber?: number;          // Where in source file
    expression?: string;          // The actual code/markup
    bidirectional?: boolean;      // If both components reference each other
  };
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  auraComponents: number;
  vfPages: number;
  apexControllers: number;
  maxDepth: number;
  averageConnections: number;
  circularDependencies: number;
  orphanedComponents: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];

  // Computed properties
  roots: string[];                // Components with no incoming deps
  leaves: string[];               // Components with no outgoing deps
  orphans: string[];              // Isolated components
  circularGroups: string[][];     // Groups of circular dependencies

  // Summary statistics
  stats: GraphStats;
}

export interface ConversionWave {
  wave: number;                   // Order in conversion sequence
  components: string[];           // Components to convert in this wave
  blockedBy: string[];            // What must be converted first
  effort: {
    estimated: number;            // Estimated hours (if grading integrated)
    components: number;
  };
}

export interface ConversionOrderResult {
  waves: ConversionWave[];
  circularDependencies: string[][]; // Must be handled specially
  recommendations: string[];
  totalComponents: number;
  estimatedWaves: number;
}

export interface DependencyAnalysisOptions {
  type: 'aura' | 'vf' | 'both';
  scope: 'project' | 'folder' | 'component';
  targetPath?: string;
  focusComponent?: string;        // Analyze deps of specific component
  maxDepth: number;               // 0 = unlimited
  includeBaseComponents: boolean;
  showOrphans: boolean;
  circularOnly: boolean;
  format: 'console' | 'json' | 'html' | 'mermaid' | 'dot';
  outputPath?: string;
  showConversionOrder: boolean;
  verbose: boolean;
}

// Raw dependency extracted from parsing
export interface RawDependency {
  target: string;                 // The dependency target (e.g., "c:AccountCard")
  type: DependencyType;
  lineNumber?: number;
  expression?: string;            // The source expression/markup
}

// Result from analyzing a single component
export interface ComponentAnalysisResult {
  id: string;
  name: string;
  type: ComponentType;
  filePath: string;
  dependencies: RawDependency[];
}
