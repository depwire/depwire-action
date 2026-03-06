import { ParseResult, HealthReport, DependencyDiff } from './types';

export function computeDiff(
  baseParse: ParseResult,
  prParse: ParseResult,
  baseHealth: HealthReport,
  prHealth: HealthReport
): DependencyDiff {
  const baseFiles = new Set(baseParse.files);
  const prFiles = new Set(prParse.files);
  
  const addedFiles = prParse.files.filter(f => !baseFiles.has(f));
  const removedFiles = baseParse.files.filter(f => !prFiles.has(f));
  
  const baseSymbolsByFile = new Map<string, Set<string>>();
  baseParse.nodes.forEach(node => {
    if (!baseSymbolsByFile.has(node.filePath)) {
      baseSymbolsByFile.set(node.filePath, new Set());
    }
    baseSymbolsByFile.get(node.filePath)!.add(node.id);
  });
  
  const prSymbolsByFile = new Map<string, Set<string>>();
  prParse.nodes.forEach(node => {
    if (!prSymbolsByFile.has(node.filePath)) {
      prSymbolsByFile.set(node.filePath, new Set());
    }
    prSymbolsByFile.get(node.filePath)!.add(node.id);
  });
  
  const modifiedFiles: string[] = [];
  const commonFiles = prParse.files.filter(f => baseFiles.has(f) && prFiles.has(f));
  
  for (const file of commonFiles) {
    const baseSymbols = baseSymbolsByFile.get(file) || new Set();
    const prSymbols = prSymbolsByFile.get(file) || new Set();
    
    const symbolsChanged = baseSymbols.size !== prSymbols.size ||
      ![...baseSymbols].every(id => prSymbols.has(id));
    
    if (symbolsChanged) {
      modifiedFiles.push(file);
    }
  }
  
  const baseSymbolsMap = new Map(baseParse.nodes.map(n => [n.id, n]));
  const prSymbolsMap = new Map(prParse.nodes.map(n => [n.id, n]));
  
  const addedSymbols = prParse.nodes
    .filter(node => !baseSymbolsMap.has(node.id))
    .map(node => ({
      name: node.name,
      kind: node.kind,
      filePath: node.filePath
    }));
  
  const removedSymbols = baseParse.nodes
    .filter(node => !prSymbolsMap.has(node.id))
    .map(node => ({
      name: node.name,
      kind: node.kind,
      filePath: node.filePath
    }));
  
  const baseEdgesSet = new Set(
    baseParse.edges.map(e => `${e.source}|${e.target}|${e.kind}`)
  );
  const prEdgesSet = new Set(
    prParse.edges.map(e => `${e.source}|${e.target}|${e.kind}`)
  );
  
  const addedEdges = prParse.edges
    .filter(edge => !baseEdgesSet.has(`${edge.source}|${edge.target}|${edge.kind}`))
    .map(edge => ({
      source: edge.source,
      target: edge.target,
      kind: edge.kind
    }));
  
  const removedEdges = baseParse.edges
    .filter(edge => !prEdgesSet.has(`${edge.source}|${edge.target}|${edge.kind}`))
    .map(edge => ({
      source: edge.source,
      target: edge.target,
      kind: edge.kind
    }));
  
  const dimensionDeltas = prHealth.dimensions.map(prDim => {
    const baseDim = baseHealth.dimensions.find(d => d.name === prDim.name);
    const baseScore = baseDim?.score ?? 0;
    
    return {
      name: prDim.name,
      before: baseScore,
      after: prDim.score,
      delta: prDim.score - baseScore
    };
  });
  
  return {
    files: {
      added: addedFiles,
      removed: removedFiles,
      modified: modifiedFiles
    },
    symbols: {
      added: addedSymbols,
      removed: removedSymbols
    },
    edges: {
      added: addedEdges,
      removed: removedEdges
    },
    healthDelta: {
      before: baseHealth,
      after: prHealth,
      overallDelta: prHealth.overall - baseHealth.overall,
      dimensionDeltas
    }
  };
}
