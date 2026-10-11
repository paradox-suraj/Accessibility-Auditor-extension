import type { FindingRecord, FindingImpact } from './types';

export async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash if subtle crypto is not available
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function makeFingerprint(
  pageUrl: string,
  stateLabel: string,
  ruleId: string,
  selector: string
): Promise<string> {
  return sha256Hex(`${pageUrl}::${stateLabel}::${ruleId}::${selector}`);
}

/**
 * Generates a URL-independent component fingerprint for cross-page grouping
 * and root-cause analysis (e.g., finding the same broken nav link across 50 pages).
 */
export async function makeComponentFingerprint(
  ruleId: string,
  selector: string
): Promise<string> {
  return sha256Hex(`component::${ruleId}::${selector.trim().toLowerCase()}`);
}

/**
 * Extracts specific WCAG criterion tag (e.g. "wcag143", "wcag111", "wcag1410")
 * Distinguishes from level tags like "wcag2a", "wcag2aa", "wcag21aa".
 */
export function extractWcagCriterion(tags: string[]): string {
  // Prefer tags that have 3 or more digits without trailing letters (e.g. wcag143, wcag1410)
  const criterionTag = tags.find((t) => /^wcag\d{3,}$/i.test(t));
  if (criterionTag) return criterionTag.toLowerCase();

  // Fallback to any wcag tag
  const anyWcag = tags.find((t) => /^wcag\d+/i.test(t));
  return anyWcag ? anyWcag.toLowerCase() : 'unknown';
}

export function normaliseSiteUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return rawUrl;
  }
}

export function calculateStateScore(findings: Array<{ impact: FindingImpact | string; confidence?: string }>): number {
  let critical = 0;
  let serious = 0;
  let moderate = 0;
  let minor = 0;

  for (const item of findings) {
    // Axe-core incomplete items require human judgment and do not deduct automated penalties
    if (item.confidence === 'needs-review') {
      continue;
    }

    const impact = item.impact ?? 'minor';
    if (impact === 'critical') critical++;
    else if (impact === 'serious' || impact === 'high') serious++;
    else if (impact === 'moderate' || impact === 'medium') moderate++;
    else minor++;
  }

  return Math.max(0, 100 - (critical * 10 + serious * 5 + moderate * 2 + minor * 1));
}

/**
 * Computes independent scores for accessibility and security findings.
 */
export function calculateSeparatedScores(findings: Array<{ type: 'a11y' | 'security'; impact: FindingImpact | string }>): {
  a11yScore: number;
  securityScore: number;
} {
  const a11yFindings = findings.filter((f) => f.type === 'a11y');
  const secFindings = findings.filter((f) => f.type === 'security');

  return {
    a11yScore: calculateStateScore(a11yFindings),
    securityScore: calculateStateScore(secFindings),
  };
}
