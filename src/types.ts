export type SymbolKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'constant'
  | 'type_alias'
  | 'interface'
  | 'enum'
  | 'import'
  | 'export'
  | 'method'
  | 'property'
  | 'decorator'
  | 'module';

export type EdgeKind =
  | 'imports'
  | 'calls'
  | 'extends'
  | 'implements'
  | 'inherits'
  | 'decorates'
  | 'references'
  | 'type_references';

export interface SymbolNode {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  scope?: string;
}

export interface SymbolEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  filePath: string;
  line: number;
}

export interface ParseResult {
  projectRoot: string;
  files: string[];
  nodes: SymbolNode[];
  edges: SymbolEdge[];
  metadata: {
    parsedAt: string;
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface HealthDimension {
  name: string;
  score: number;
  weight: number;
  grade: string;
  details: string;
  metrics: Record<string, number | string>;
}

export interface HealthReport {
  overall: number;
  grade: string;
  dimensions: HealthDimension[];
  summary: string;
  recommendations: string[];
  projectStats: {
    files: number;
    symbols: number;
    edges: number;
    languages: Record<string, number>;
  };
  timestamp: string;
}

export interface DependencyDiff {
  files: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  symbols: {
    added: Array<{ name: string; kind: string; filePath: string }>;
    removed: Array<{ name: string; kind: string; filePath: string }>;
  };
  edges: {
    added: Array<{ source: string; target: string; kind: string }>;
    removed: Array<{ source: string; target: string; kind: string }>;
  };
  healthDelta: {
    before: HealthReport;
    after: HealthReport;
    overallDelta: number;
    dimensionDeltas: Array<{
      name: string;
      before: number;
      after: number;
      delta: number;
    }>;
  };
}

export interface ImpactItem {
  file: string;
  type: 'high-risk' | 'medium-risk' | 'low-risk';
  reason: string;
  affectedFiles: number;
  connections: number;
}

export interface ImpactAnalysis {
  items: ImpactItem[];
  totalRisk: 'high' | 'medium' | 'low';
}
