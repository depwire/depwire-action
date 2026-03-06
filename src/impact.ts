import { DependencyDiff, ParseResult, ImpactAnalysis, ImpactItem } from './types';

export function analyzeImpact(
  diff: DependencyDiff,
  prParse: ParseResult
): ImpactAnalysis {
  const items: ImpactItem[] = [];
  
  const fileConnections = new Map<string, number>();
  
  for (const edge of prParse.edges) {
    const sourceFile = edge.filePath;
    fileConnections.set(sourceFile, (fileConnections.get(sourceFile) || 0) + 1);
  }
  
  for (const node of prParse.nodes) {
    const file = node.filePath;
    const outbound = prParse.edges.filter(e => e.source === node.id).length;
    const inbound = prParse.edges.filter(e => e.target === node.id).length;
    const connections = outbound + inbound;
    
    const current = fileConnections.get(file) || 0;
    if (connections > current) {
      fileConnections.set(file, connections);
    }
  }
  
  const changedFiles = [
    ...diff.files.added,
    ...diff.files.modified
  ];
  
  for (const file of changedFiles) {
    const connections = fileConnections.get(file) || 0;
    const isNew = diff.files.added.includes(file);
    
    let type: 'high-risk' | 'medium-risk' | 'low-risk';
    let reason: string;
    
    if (connections >= 20) {
      type = 'high-risk';
      reason = isNew
        ? `New high-connectivity file — ${connections} connections`
        : `Hub file modified — changes affect ${connections} connected symbols`;
    } else if (connections >= 5) {
      type = 'medium-risk';
      reason = isNew
        ? `New file with moderate connectivity — ${connections} connections`
        : `Moderately connected file modified — ${connections} connections`;
    } else {
      type = 'low-risk';
      reason = isNew
        ? 'New file, no existing dependents'
        : `Low-connectivity file modified — ${connections} connections`;
    }
    
    const affectedFiles = new Set<string>();
    
    for (const edge of prParse.edges) {
      prParse.nodes.forEach(node => {
        if (node.filePath === file) {
          const outEdges = prParse.edges.filter(e => e.source === node.id);
          const inEdges = prParse.edges.filter(e => e.target === node.id);
          
          outEdges.forEach(e => {
            const targetNode = prParse.nodes.find(n => n.id === e.target);
            if (targetNode && targetNode.filePath !== file) {
              affectedFiles.add(targetNode.filePath);
            }
          });
          
          inEdges.forEach(e => {
            const sourceNode = prParse.nodes.find(n => n.id === e.source);
            if (sourceNode && sourceNode.filePath !== file) {
              affectedFiles.add(sourceNode.filePath);
            }
          });
        }
      });
    }
    
    items.push({
      file,
      type,
      reason,
      affectedFiles: affectedFiles.size,
      connections
    });
  }
  
  items.sort((a, b) => {
    const typeOrder = { 'high-risk': 0, 'medium-risk': 1, 'low-risk': 2 };
    const typeComparison = typeOrder[a.type] - typeOrder[b.type];
    if (typeComparison !== 0) return typeComparison;
    return b.connections - a.connections;
  });
  
  const highRiskCount = items.filter(i => i.type === 'high-risk').length;
  const mediumRiskCount = items.filter(i => i.type === 'medium-risk').length;
  
  let totalRisk: 'high' | 'medium' | 'low';
  if (highRiskCount > 0) {
    totalRisk = 'high';
  } else if (mediumRiskCount > 0) {
    totalRisk = 'medium';
  } else {
    totalRisk = 'low';
  }
  
  return {
    items,
    totalRisk
  };
}
