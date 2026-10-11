import type { FindingRecord, FindingImpact, PageResultRecord, PageStateRecord } from './types';

export interface ComponentCluster {
  clusterKey: string;
  ruleId: string;
  selector: string;
  impact: FindingImpact;
  type: 'a11y' | 'security';
  description: string;
  instanceCount: number;
  affectedPagesCount: number;
  affectedUrls: string[];
  sampleFinding: FindingRecord;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

/**
 * Groups findings by component/template pattern (type + ruleId + selector)
 * to highlight high-impact shared components (navbars, footers, modal templates)
 * across multi-page crawls.
 */
export function clusterFindings(
  findings: FindingRecord[],
  pageStates: PageStateRecord[],
  pageResults: PageResultRecord[]
): ComponentCluster[] {
  // Build lookup maps from pageStateId -> pageResultId -> url
  const stateToPageResult = new Map<string, string>();
  for (const s of pageStates) {
    if (s.id && s.pageResultId) {
      stateToPageResult.set(s.id, s.pageResultId);
    }
  }

  const pageResultToUrl = new Map<string, string>();
  for (const p of pageResults) {
    if (p.id) {
      pageResultToUrl.set(p.id, p.url);
    }
  }

  const clusters = new Map<string, {
    ruleId: string;
    selector: string;
    impact: FindingImpact;
    type: 'a11y' | 'security';
    description: string;
    instanceCount: number;
    affectedUrls: Set<string>;
    sampleFinding: FindingRecord;
  }>();

  for (const f of findings) {
    const normSelector = (f.selector || '').trim().toLowerCase();
    const clusterKey = `${f.type}::${f.ruleId}::${normSelector}`;

    const pageResultId = stateToPageResult.get(f.pageStateId);
    const url = pageResultId ? pageResultToUrl.get(pageResultId) : undefined;

    const existing = clusters.get(clusterKey);
    if (!existing) {
      const urls = new Set<string>();
      if (url) urls.add(url);
      clusters.set(clusterKey, {
        ruleId: f.ruleId,
        selector: f.selector || '',
        impact: f.impact,
        type: f.type,
        description: f.description,
        instanceCount: 1,
        affectedUrls: urls,
        sampleFinding: f,
      });
    } else {
      existing.instanceCount++;
      if (url) existing.affectedUrls.add(url);
      // If current finding has more detail or higher severity, update sample
      if (SEVERITY_WEIGHT[f.impact] > SEVERITY_WEIGHT[existing.impact]) {
        existing.impact = f.impact;
        existing.sampleFinding = f;
      }
    }
  }

  const result: ComponentCluster[] = Array.from(clusters.entries()).map(([clusterKey, data]) => ({
    clusterKey,
    ruleId: data.ruleId,
    selector: data.selector,
    impact: data.impact,
    type: data.type,
    description: data.description,
    instanceCount: data.instanceCount,
    affectedPagesCount: data.affectedUrls.size,
    affectedUrls: Array.from(data.affectedUrls),
    sampleFinding: data.sampleFinding,
  }));

  // Sort clusters: Highest severity first, then highest instance count
  return result.sort((a, b) => {
    const weightDiff = (SEVERITY_WEIGHT[b.impact] || 0) - (SEVERITY_WEIGHT[a.impact] || 0);
    if (weightDiff !== 0) return weightDiff;
    return b.instanceCount - a.instanceCount;
  });
}
