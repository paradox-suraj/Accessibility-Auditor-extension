import type { FindingRecord } from './types';

export interface DiffResult {
  previousRunId: string | null;
  new: FindingRecord[];
  resolved: FindingRecord[];
  unchanged: FindingRecord[];
  changed: Array<{ previous: FindingRecord; current: FindingRecord }>;
}

export function computeFindingsDiff(
  currentFindings: FindingRecord[],
  previousFindings: FindingRecord[],
  previousRunId: string | null
): DiffResult {
  const prevMap = new Map(previousFindings.map((v) => [v.fingerprint, v]));
  const currMap = new Map(currentFindings.map((v) => [v.fingerprint, v]));

  const newVs: FindingRecord[] = [];
  const resolvedVs: FindingRecord[] = [];
  const unchangedVs: FindingRecord[] = [];
  const changedVs: Array<{ previous: FindingRecord; current: FindingRecord }> = [];

  for (const curr of currentFindings) {
    const prev = prevMap.get(curr.fingerprint);
    if (!prev) {
      newVs.push(curr);
    } else if (prev.impact !== curr.impact) {
      changedVs.push({ previous: prev, current: curr });
    } else {
      unchangedVs.push(curr);
    }
  }

  for (const prev of previousFindings) {
    if (!currMap.has(prev.fingerprint)) {
      resolvedVs.push(prev);
    }
  }

  return {
    previousRunId,
    new: newVs,
    resolved: resolvedVs,
    unchanged: unchangedVs,
    changed: changedVs,
  };
}
