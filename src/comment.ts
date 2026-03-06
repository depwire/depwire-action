import { DependencyDiff, ImpactAnalysis } from './types';

function formatDelta(delta: number): string {
  if (delta > 0) return `↑ +${delta}`;
  if (delta < 0) return `↓ ${delta}`;
  return '→ 0';
}

function getRiskEmoji(type: 'high-risk' | 'medium-risk' | 'low-risk'): string {
  switch (type) {
    case 'high-risk':
      return '⚠️ High';
    case 'medium-risk':
      return '⚡ Medium';
    case 'low-risk':
      return '✅ Low';
  }
}

export function buildComment(
  diff: DependencyDiff,
  impact: ImpactAnalysis,
  header: string
): string {
  const lines: string[] = [];
  
  lines.push(header);
  lines.push('');
  
  lines.push('### Summary');
  lines.push('| Metric | Base | PR | Delta |');
  lines.push('|--------|------|-----|-------|');
  lines.push(`| Files | ${diff.healthDelta.before.projectStats.files} | ${diff.healthDelta.after.projectStats.files} | ${formatDelta(diff.healthDelta.after.projectStats.files - diff.healthDelta.before.projectStats.files)} |`);
  lines.push(`| Symbols | ${diff.healthDelta.before.projectStats.symbols} | ${diff.healthDelta.after.projectStats.symbols} | ${formatDelta(diff.healthDelta.after.projectStats.symbols - diff.healthDelta.before.projectStats.symbols)} |`);
  lines.push(`| Edges | ${diff.healthDelta.before.projectStats.edges} | ${diff.healthDelta.after.projectStats.edges} | ${formatDelta(diff.healthDelta.after.projectStats.edges - diff.healthDelta.before.projectStats.edges)} |`);
  lines.push(`| Health Score | ${diff.healthDelta.before.overall}/100 (${diff.healthDelta.before.grade}) | ${diff.healthDelta.after.overall}/100 (${diff.healthDelta.after.grade}) | ${formatDelta(diff.healthDelta.overallDelta)} |`);
  lines.push('');
  
  lines.push('### Health Score Breakdown');
  lines.push('| Dimension | Base | PR | Delta |');
  lines.push('|-----------|------|-----|-------|');
  
  for (const dim of diff.healthDelta.dimensionDeltas) {
    const baseDim = diff.healthDelta.before.dimensions.find(d => d.name === dim.name);
    const prDim = diff.healthDelta.after.dimensions.find(d => d.name === dim.name);
    const baseGrade = baseDim?.grade || '-';
    const prGrade = prDim?.grade || '-';
    
    lines.push(`| ${dim.name} | ${dim.before} (${baseGrade}) | ${dim.after} (${prGrade}) | ${formatDelta(dim.delta)} |`);
  }
  lines.push('');
  
  lines.push('### Files Changed');
  
  if (diff.files.added.length > 0) {
    lines.push(`**Added (${diff.files.added.length}):**`);
    
    const filesToShow = diff.files.added.slice(0, 10);
    for (const file of filesToShow) {
      const symbolCount = diff.symbols.added.filter(s => s.filePath === file).length;
      const edgeCount = diff.edges.added.filter(e => {
        const sourceFile = e.source.split('::')[0];
        return sourceFile === file;
      }).length;
      
      lines.push(`- \`${file}\` — ${symbolCount} symbols, ${edgeCount} connections`);
    }
    
    if (diff.files.added.length > 10) {
      lines.push(`- _...and ${diff.files.added.length - 10} more files_`);
    }
    lines.push('');
  } else {
    lines.push('**Added:** None');
    lines.push('');
  }
  
  if (diff.files.removed.length > 0) {
    lines.push(`**Removed (${diff.files.removed.length}):**`);
    const filesToShow = diff.files.removed.slice(0, 10);
    for (const file of filesToShow) {
      lines.push(`- \`${file}\``);
    }
    
    if (diff.files.removed.length > 10) {
      lines.push(`- _...and ${diff.files.removed.length - 10} more files_`);
    }
    lines.push('');
  } else {
    lines.push('**Removed:** None');
    lines.push('');
  }
  
  if (diff.files.modified.length > 0) {
    lines.push(`**Modified (${diff.files.modified.length}):**`);
    const filesToShow = diff.files.modified.slice(0, 10);
    for (const file of filesToShow) {
      const addedSymbols = diff.symbols.added.filter(s => s.filePath === file).length;
      const removedSymbols = diff.symbols.removed.filter(s => s.filePath === file).length;
      
      const details: string[] = [];
      if (addedSymbols > 0) details.push(`+${addedSymbols} symbols`);
      if (removedSymbols > 0) details.push(`-${removedSymbols} symbols`);
      
      const detailsStr = details.length > 0 ? ` — ${details.join(', ')}` : '';
      lines.push(`- \`${file}\`${detailsStr}`);
    }
    
    if (diff.files.modified.length > 10) {
      lines.push(`- _...and ${diff.files.modified.length - 10} more files_`);
    }
    lines.push('');
  } else {
    lines.push('**Modified:** None');
    lines.push('');
  }
  
  lines.push('### Impact Analysis');
  
  if (impact.items.length === 0) {
    lines.push('No significant impact detected.');
  } else {
    lines.push('| File | Risk | Connections | Reason |');
    lines.push('|------|------|-------------|--------|');
    
    const itemsToShow = impact.items.slice(0, 15);
    for (const item of itemsToShow) {
      lines.push(`| \`${item.file}\` | ${getRiskEmoji(item.type)} | ${item.connections} | ${item.reason} |`);
    }
    
    if (impact.items.length > 15) {
      lines.push(`| ... | | | _${impact.items.length - 15} more files not shown_ |`);
    }
  }
  
  lines.push('');
  
  if (diff.edges.added.length > 0) {
    lines.push('### New Dependencies');
    lines.push('```');
    
    const edgesToShow = diff.edges.added.slice(0, 20);
    for (const edge of edgesToShow) {
      lines.push(`${edge.source} → ${edge.target} (${edge.kind})`);
    }
    
    if (diff.edges.added.length > 20) {
      lines.push(`...and ${diff.edges.added.length - 20} more edges`);
    }
    
    lines.push('```');
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('<sub>Powered by [Depwire](https://depwire.dev) — Dependency intelligence for AI coding tools</sub>');
  
  return lines.join('\n');
}
