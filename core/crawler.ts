import robotsParser from 'robots-parser';
import { db, generateId } from './db';
import { scanPassiveSecurity } from './securityScanner';
import {
  calculateStateScore,
  calculateSeparatedScores,
  extractWcagCriterion,
  makeFingerprint,
  normaliseSiteUrl,
} from './scoring';
import type {
  AxeViolationItem,
  FindingNode,
  FindingRecord,
  PageStateRecord,
  SecurityFindingItem,
} from './types';

export interface ScanOptions {
  interactive?: boolean;
  maxPages?: number;
  maxDepth?: number;
  onProgress?: (progress: {
    pagesScanned: number;
    currentUrl: string;
    status: string;
    totalFindings: number;
  }) => void;
}

export function isRestrictedUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    // Only http and https protocols are eligible for audit
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    return (
      trimmed.startsWith('chrome://') ||
      trimmed.startsWith('chrome-extension://') ||
      trimmed.startsWith('edge://') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('view-source:') ||
      trimmed.startsWith('chrome-search://')
    );
  } catch {
    // Malformed URL or non-standard scheme (e.g. javascript:, data:)
    return true;
  }
}

async function getRobots(origin: string) {
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetch(robotsUrl, { redirect: 'follow' });
    if (!res.ok) return null;
    const txt = await res.text();
    return robotsParser(robotsUrl, txt);
  } catch {
    return null;
  }
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    // Try pinging content script
    await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_HIGHLIGHT' });
  } catch {
    // Not injected yet, inject content script files
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      // Small pause to allow content script initialization
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.warn('Script injection failed or already present:', e);
    }
  }
}

export async function persistPageScan(
  scanRunId: string,
  url: string,
  statesData: Array<{
    label: string;
    triggerType?: string | null;
    triggerSelector?: string | null;
    status: string;
    violations: AxeViolationItem[];
    incomplete?: AxeViolationItem[];
    securityFindings?: SecurityFindingItem[];
  }>
): Promise<{ pageResultId: string; pageScore: number; findingsCount: number }> {
  let pageMinScore = 100;
  let totalFindingsCount = 0;

  const pageResultId = generateId();
  await db.pageResults.add({
    id: pageResultId,
    scanRunId,
    url,
    score: 100,
    status: 'completed',
  });

  for (const state of statesData) {
    const pageStateId = generateId();
    const findingRecords: FindingRecord[] = [];

    // 1. Definite violations from axe-core
    for (const violation of state.violations) {
      const wcagCriterion = extractWcagCriterion(violation.tags);
      const impact = violation.impact || 'minor';

      for (const node of violation.nodes as FindingNode[]) {
        const selector = node.target ? node.target.join(', ') : '';
        const fingerprint = await makeFingerprint(
          url,
          state.label,
          violation.id,
          selector
        );

        findingRecords.push({
          id: generateId(),
          pageStateId,
          type: 'a11y',
          source: 'axe-core',
          ruleId: violation.id,
          category: wcagCriterion,
          impact,
          confidence: 'certain',
          engineVersion: 'axe-core 4.10.2',
          selector,
          html: node.html || '',
          description: violation.description || violation.help,
          helpUrl: violation.helpUrl || null,
          screenshotUrl: node.screenshotData || null,
          fingerprint,
          createdAt: new Date(),
        });
      }
    }

    // 2. Incomplete / needs-review items from axe-core
    if (state.incomplete) {
      for (const item of state.incomplete) {
        const wcagCriterion = extractWcagCriterion(item.tags);
        const impact = item.impact || 'minor';

        for (const node of item.nodes as FindingNode[]) {
          const selector = node.target ? node.target.join(', ') : '';
          const fingerprint = await makeFingerprint(
            url,
            state.label,
            item.id,
            selector
          );

          findingRecords.push({
            id: generateId(),
            pageStateId,
            type: 'a11y',
            source: 'axe-core',
            ruleId: item.id,
            category: wcagCriterion,
            impact,
            confidence: 'needs-review',
            engineVersion: 'axe-core 4.10.2',
            selector,
            html: node.html || '',
            description: `[Needs Review] ${item.description || item.help}`,
            helpUrl: item.helpUrl || null,
            screenshotUrl: node.screenshotData || null,
            fingerprint,
            createdAt: new Date(),
          });
        }
      }
    }

    // 3. Security findings
    if (state.securityFindings) {
      for (const sec of state.securityFindings) {
        const fingerprint = await makeFingerprint(
          url,
          state.label,
          sec.ruleId,
          'security'
        );

        findingRecords.push({
          id: generateId(),
          pageStateId,
          type: 'security',
          source: sec.source,
          ruleId: sec.ruleId,
          category: sec.category,
          impact: sec.impact,
          confidence: 'certain',
          cweId: sec.cweId,
          description: sec.description,
          helpUrl: sec.helpUrl,
          requestHeaders: sec.requestHeaders,
          responseHeaders: sec.responseHeaders,
          fingerprint,
          createdAt: new Date(),
        });
      }
    }

    const stateScore = calculateStateScore(findingRecords);
    if (stateScore < pageMinScore) {
      pageMinScore = stateScore;
    }
    totalFindingsCount += findingRecords.length;

    await db.pageStates.add({
      id: pageStateId,
      pageResultId,
      label: state.label,
      triggerType: state.triggerType || null,
      triggerSelector: state.triggerSelector || null,
      status: state.status,
      score: stateScore,
      createdAt: new Date(),
    });

    if (findingRecords.length > 0) {
      await db.findings.bulkAdd(findingRecords);
    }
  }

  // Update PageResult with minimum state score
  await db.pageResults.update(pageResultId, { score: pageMinScore });

  return { pageResultId, pageScore: pageMinScore, findingsCount: totalFindingsCount };
}

export async function scanTab(
  tabId: number,
  url: string,
  scanRunId: string,
  interactive: boolean = false
): Promise<{ pageResultId: string; pageScore: number; findingsCount: number }> {
  await ensureContentScriptInjected(tabId);

  // Retrieve user-configured tags and active checks preferences
  let axeTags: string[] | undefined;
  let allowActiveChecks = false;
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(['axeTags', 'allowActiveChecks']);
      if (stored.axeTags && Array.isArray(stored.axeTags) && stored.axeTags.length > 0) {
        axeTags = stored.axeTags;
      }
      if (stored.allowActiveChecks === true) {
        allowActiveChecks = true;
      }
    } catch {}
  }

  // 1. Run baseline axe scan on the tab
  const a11yResponse = await chrome.tabs.sendMessage(tabId, { type: 'RUN_AXE_SCAN', tags: axeTags });
  const violations: AxeViolationItem[] = a11yResponse?.violations || [];
  const incomplete: AxeViolationItem[] = a11yResponse?.incomplete || [];

  // 2. Run security scan (passive by default; active path checks if opted-in)
  const securityFindings = await scanPassiveSecurity(url, { allowActiveChecks });

  const statesData: Array<{
    label: string;
    triggerType?: string | null;
    triggerSelector?: string | null;
    status: string;
    violations: AxeViolationItem[];
    incomplete?: AxeViolationItem[];
    securityFindings?: SecurityFindingItem[];
  }> = [
    {
      label: 'default',
      status: 'completed',
      violations,
      incomplete,
      securityFindings,
    },
  ];

  // 3. Scan interactive states if enabled
  if (interactive) {
    try {
      const triggersRes = await chrome.tabs.sendMessage(tabId, {
        type: 'DISCOVER_TRIGGERS',
        limit: 5,
      });

      if (triggersRes?.success && Array.isArray(triggersRes.triggers)) {
        for (const trigger of triggersRes.triggers) {
          const testRes = await chrome.tabs.sendMessage(tabId, {
            type: 'TEST_TRIGGER',
            trigger,
            tags: axeTags,
          });

          statesData.push({
            label: trigger.label,
            triggerType: trigger.type,
            triggerSelector: trigger.selector,
            status: testRes?.success ? 'completed' : 'failed',
            violations: testRes?.violations || [],
          });
        }
      }
    } catch (e) {
      console.warn('Interactive state testing failed:', e);
    }
  }

  return persistPageScan(scanRunId, url, statesData);
}

export async function startSinglePageScan(
  tabId: number,
  url: string,
  interactive: boolean = false
): Promise<string> {
  if (isRestrictedUrl(url)) {
    throw new Error('Cannot audit restricted browser pages (chrome://, about:, extensions).');
  }

  const siteUrl = normaliseSiteUrl(url);

  // Upsert Site
  let site = await db.sites.where('url').equals(siteUrl).first();
  if (!site) {
    const siteId = generateId();
    site = { id: siteId, url: siteUrl, createdAt: new Date() };
    await db.sites.add(site);
  }

  // Create ScanRun
  const scanRunId = generateId();
  await db.scanRuns.add({
    id: scanRunId,
    siteId: site.id!,
    startedAt: new Date(),
    finishedAt: null,
    status: 'running',
    pageCount: 0,
    isAuthenticated: false,
    engineVersion: '1.0.0',
  });

  try {
    await scanTab(tabId, url, scanRunId, interactive);

    // Compute separate scores
    const pageResults = await db.pageResults.where('scanRunId').equals(scanRunId).toArray();
    const pIds = pageResults.map((p) => p.id!);
    const pageStates = await db.pageStates.where('pageResultId').anyOf(pIds).toArray();
    const sIds = pageStates.map((s) => s.id!);
    const allFindings = await db.findings.where('pageStateId').anyOf(sIds).toArray();
    const { a11yScore, securityScore } = calculateSeparatedScores(allFindings);

    await db.scanRuns.update(scanRunId, {
      finishedAt: new Date(),
      status: 'completed',
      pageCount: 1,
      a11yScore,
      securityScore,
    });

    return scanRunId;
  } catch (err) {
    await db.scanRuns.update(scanRunId, {
      finishedAt: new Date(),
      status: 'failed',
      pageCount: 0,
    });
    throw err;
  }
}

export async function startCrawlScan(
  startUrl: string,
  options: ScanOptions = {},
  abortSignal?: AbortSignal
): Promise<string> {
  if (isRestrictedUrl(startUrl)) {
    throw new Error('Cannot crawl restricted browser pages.');
  }

  const siteUrl = normaliseSiteUrl(startUrl);
  const maxPages = options.maxPages || 5;
  const maxDepth = options.maxDepth ?? 1;
  const interactive = options.interactive || false;

  // Upsert Site
  let site = await db.sites.where('url').equals(siteUrl).first();
  if (!site) {
    const siteId = generateId();
    site = { id: siteId, url: siteUrl, createdAt: new Date() };
    await db.sites.add(site);
  }

  const scanRunId = generateId();
  await db.scanRuns.add({
    id: scanRunId,
    siteId: site.id!,
    startedAt: new Date(),
    finishedAt: null,
    status: 'running',
    pageCount: 0,
    isAuthenticated: false,
    engineVersion: '1.0.0',
  });

  const origin = new URL(startUrl).origin;
  const robots = await getRobots(origin);

  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  let pagesScanned = 0;
  let totalFindings = 0;

  try {
    while (queue.length > 0 && pagesScanned < maxPages) {
      if (abortSignal?.aborted) {
        break;
      }

      const { url, depth } = queue.shift()!;
      if (visited.has(url)) continue;

      if (robots && robots.isDisallowed(url, '*')) {
        console.log(`[Crawler] robots.txt blocked: ${url}`);
        continue;
      }

      visited.add(url);

      const statusMsg = `Auditing ${url} (depth ${depth})...`;
      options.onProgress?.({
        pagesScanned,
        currentUrl: url,
        status: statusMsg,
        totalFindings,
      });

      // Persist progress to session storage
      await persistCrawlSession({
        scanRunId,
        startUrl,
        pagesScanned,
        maxPages,
        status: statusMsg,
      });

      // Open background tab to scan this URL
      let bgTab: chrome.tabs.Tab | null = null;
      try {
        bgTab = await chrome.tabs.create({ url, active: false });

        // Wait for tab to complete loading (avoid race condition if completed immediately)
        if (bgTab?.id && bgTab.status !== 'complete') {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(); // proceed even on timeout
            }, 20000);

            const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
              if (tabId === bgTab?.id && changeInfo.status === 'complete') {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };

            chrome.tabs.onUpdated.addListener(listener);

            // Double check in case status turned complete immediately after create
            if (bgTab?.id) {
              chrome.tabs.get(bgTab.id).then((freshTab) => {
                if (freshTab?.status === 'complete') {
                  clearTimeout(timeout);
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              }).catch(() => {});
            }
          });
        }

        if (bgTab?.id) {
          const res = await scanTab(bgTab.id, url, scanRunId, interactive);
          pagesScanned++;
          totalFindings += res.findingsCount;

          // Extract links if within depth limit
          if (depth < maxDepth && pagesScanned < maxPages) {
            try {
              const linksRes = await chrome.tabs.sendMessage(bgTab.id, {
                type: 'EXTRACT_LINKS',
              });

              if (linksRes?.success && Array.isArray(linksRes.links)) {
                for (const link of linksRes.links) {
                  if (!visited.has(link) && !queue.some((q) => q.url === link)) {
                    queue.push({ url: link, depth: depth + 1 });
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to extract links:', err);
            }
          }
        }
      } catch (err) {
        console.error(`Failed crawling page ${url}:`, err);
      } finally {
        if (bgTab?.id) {
          try {
            await chrome.tabs.remove(bgTab.id);
          } catch {}
        }
      }
    }

    // Compute separate scores
    const pageResults = await db.pageResults.where('scanRunId').equals(scanRunId).toArray();
    const pIds = pageResults.map((p) => p.id!);
    const pageStates = await db.pageStates.where('pageResultId').anyOf(pIds).toArray();
    const sIds = pageStates.map((s) => s.id!);
    const allFindings = await db.findings.where('pageStateId').anyOf(sIds).toArray();
    const { a11yScore, securityScore } = calculateSeparatedScores(allFindings);

    await db.scanRuns.update(scanRunId, {
      finishedAt: new Date(),
      status: abortSignal?.aborted ? 'failed' : 'completed',
      pageCount: pagesScanned,
      a11yScore,
      securityScore,
    });

    await clearCrawlSession();
    return scanRunId;
  } catch (err) {
    await db.scanRuns.update(scanRunId, {
      finishedAt: new Date(),
      status: 'failed',
      pageCount: pagesScanned,
    });
    await clearCrawlSession();
    throw err;
  }
}

// ── Session & Stale Run Recovery Helpers ─────────────────────────────────────

export async function persistCrawlSession(sessionData: {
  scanRunId: string;
  startUrl: string;
  pagesScanned: number;
  maxPages: number;
  status: string;
}): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      await chrome.storage.session.set({ activeCrawl: sessionData });
    } catch {}
  }
}

export async function clearCrawlSession(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      await chrome.storage.session.remove('activeCrawl');
    } catch {}
  }
}

export async function getActiveCrawlSession(): Promise<any> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      const res = await chrome.storage.session.get('activeCrawl');
      return res.activeCrawl || null;
    } catch {}
  }
  return null;
}

/**
 * Marks any scan run left in 'running' status (e.g. from browser crash or abrupt panel close)
 * as 'failed'.
 */
export async function cleanupStaleScanRuns(): Promise<number> {
  const staleRuns = await db.scanRuns.where('status').equals('running').toArray();
  for (const r of staleRuns) {
    if (r.id) {
      await db.scanRuns.update(r.id, {
        status: 'failed',
        finishedAt: new Date(),
      });
    }
  }
  await clearCrawlSession();
  return staleRuns.length;
}
