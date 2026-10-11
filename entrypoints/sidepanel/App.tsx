import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Globe,
  Play,
  RotateCcw,
  Settings,
  History,
  Layers,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/core/db';
import {
  startSinglePageScan,
  startCrawlScan,
  isRestrictedUrl,
  cleanupStaleScanRuns,
} from '@/core/crawler';
import { TrendChart, type TrendDataPoint } from '@/components/TrendChart';
import { ScanRunResults } from '@/components/ScanRunResults';
import type {
  ScanRunRecord,
  PageResultRecord,
  PageStateRecord,
  FindingRecord,
  SiteRecord,
} from '@/core/types';
import { normaliseSiteUrl } from '@/core/scoring';

type TabView = 'audit' | 'crawl' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabView>('audit');
  const [currentTabInfo, setCurrentTabInfo] = useState<{ id: number; url: string; title: string } | null>(null);

  // Scan parameters
  const [interactive, setInteractive] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [maxDepth, setMaxDepth] = useState(1);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [crawlController, setCrawlController] = useState<AbortController | null>(null);

  // Active run data
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<{
    run: ScanRunRecord;
    pageResults: PageResultRecord[];
    pageStates: PageStateRecord[];
    findings: FindingRecord[];
  } | null>(null);

  // History & Trends
  const [historicalRuns, setHistoricalRuns] = useState<ScanRunRecord[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  // Fetch active browser tab on load
  useEffect(() => {
    async function getActiveTab() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id && tab.url) {
          setCurrentTabInfo({
            id: tab.id,
            url: tab.url,
            title: tab.title || tab.url,
          });
          setCrawlUrl(tab.url);
          loadSiteHistory(tab.url);
        }
      } catch (err) {
        console.error('Failed to get active tab:', err);
      }
    }

    getActiveTab();

    // Recover from previous crash / abrupt tab close
    cleanupStaleScanRuns().catch((err) => console.warn('Failed to clean up stale runs:', err));

    // Listen for tab changes
    const onTabActivated = () => getActiveTab();
    chrome.tabs.onActivated.addListener(onTabActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(onTabActivated);
    };
  }, []);

  async function loadSiteHistory(url: string) {
    try {
      const siteUrl = normaliseSiteUrl(url);
      const site = await db.sites.where('url').equals(siteUrl).first();
      if (!site?.id) {
        setHistoricalRuns([]);
        setTrendData([]);
        return;
      }

      const runs = await db.scanRuns
        .where('siteId')
        .equals(site.id)
        .reverse()
        .sortBy('startedAt');

      setHistoricalRuns(runs);

      // Compute trends
      const points: TrendDataPoint[] = [];
      for (const r of runs.slice().reverse()) {
        const pages = await db.pageResults.where('scanRunId').equals(r.id!).toArray();
        if (pages.length > 0) {
          const avg = Math.round(
            pages.reduce((acc, p) => acc + p.score, 0) / pages.length
          );
          points.push({
            date: new Date(r.startedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            }),
            score: avg,
          });
        }
      }
      setTrendData(points);

      // Automatically select latest run if not already viewing one
      if (runs.length > 0 && !selectedRunId) {
        loadRunDetails(runs[0].id!);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  async function loadRunDetails(runId: string) {
    setSelectedRunId(runId);
    try {
      const run = await db.scanRuns.get(runId);
      if (!run) return;

      const pageResults = await db.pageResults
        .where('scanRunId')
        .equals(runId)
        .toArray();
      const pageResultIds = pageResults.map((p) => p.id!);

      const pageStates = await db.pageStates
        .where('pageResultId')
        .anyOf(pageResultIds)
        .toArray();
      const pageStateIds = pageStates.map((s) => s.id!);

      const findings = await db.findings
        .where('pageStateId')
        .anyOf(pageStateIds)
        .toArray();

      setRunData({ run, pageResults, pageStates, findings });
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
  }

  async function handleSingleAudit() {
    if (!currentTabInfo) return;
    if (isRestrictedUrl(currentTabInfo.url)) {
      setScanError('Cannot audit browser internal or unsupported scheme (e.g. chrome://, about:). Please navigate to an http:// or https:// page.');
      return;
    }
    setIsScanning(true);
    setScanStatus('Scanning current page...');
    setScanError(null);

    try {
      const runId = await startSinglePageScan(
        currentTabInfo.id,
        currentTabInfo.url,
        interactive
      );
      await loadRunDetails(runId);
      await loadSiteHistory(currentTabInfo.url);
    } catch (err: any) {
      setScanError(err?.message || 'Scan failed.');
    } finally {
      setIsScanning(false);
      setScanStatus('');
    }
  }

  function handleCancelCrawl() {
    if (crawlController) {
      crawlController.abort();
      setScanStatus('Cancelling crawl...');
    }
  }

  async function handleCrawlAudit() {
    const targetUrl = crawlUrl.trim();
    if (!targetUrl) {
      setScanError('Please enter a target URL to crawl.');
      return;
    }
    if (isRestrictedUrl(targetUrl)) {
      setScanError('Only standard web URLs (http:// and https://) can be audited. Browser internal pages and non-web protocols are blocked.');
      return;
    }
    setIsScanning(true);
    setScanStatus('Initializing crawl...');
    setScanError(null);

    const controller = new AbortController();
    setCrawlController(controller);

    try {
      const runId = await startCrawlScan(
        targetUrl,
        {
          maxPages,
          maxDepth,
          interactive,
          onProgress: (p) => {
            setScanStatus(`${p.status} (${p.pagesScanned} pages scanned)`);
          },
        },
        controller.signal
      );
      await loadRunDetails(runId);
      await loadSiteHistory(targetUrl);
    } catch (err: any) {
      setScanError(err?.message || 'Crawl failed.');
    } finally {
      setIsScanning(false);
      setScanStatus('');
      setCrawlController(null);
    }
  }

  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 text-sm">
      {/* Top Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-gray-900">
              Accessibility Auditor
            </h1>
            <p className="text-[11px] text-gray-500">WCAG 2.2 & OWASP Security</p>
          </div>
        </div>

        <button
          type="button"
          onClick={openOptions}
          title="Settings & Options"
          aria-label="Settings and Options"
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 transition"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Current URL Bar */}
      {currentTabInfo && (
        <div className="bg-blue-50/60 border-b border-blue-100 px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate text-blue-900">
            <Globe size={13} className="shrink-0 text-blue-600" />
            <span className="truncate font-mono">{currentTabInfo.url}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav role="tablist" aria-label="Audit modes" className="flex border-b border-gray-200 bg-white px-2">
        <button
          type="button"
          role="tab"
          id="tab-audit"
          aria-selected={activeTab === 'audit'}
          aria-controls="panel-audit"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 py-2.5 px-3 font-semibold text-xs border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Search size={14} />
          Active Tab
        </button>
        <button
          type="button"
          role="tab"
          id="tab-crawl"
          aria-selected={activeTab === 'crawl'}
          aria-controls="panel-crawl"
          onClick={() => setActiveTab('crawl')}
          className={`flex items-center gap-1.5 py-2.5 px-3 font-semibold text-xs border-b-2 transition ${
            activeTab === 'crawl'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Layers size={14} />
          Site Crawl
        </button>
        <button
          type="button"
          role="tab"
          id="tab-history"
          aria-selected={activeTab === 'history'}
          aria-controls="panel-history"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 py-2.5 px-3 font-semibold text-xs border-b-2 transition ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <History size={14} />
          Trends ({historicalRuns.length})
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 space-y-4">
        {/* Tab 1: Active Tab Audit */}
        {activeTab === 'audit' && (
          <div
            role="tabpanel"
            id="panel-audit"
            aria-labelledby="tab-audit"
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3"
          >
            <h2 className="font-semibold text-xs text-gray-800 uppercase tracking-wide">
              Instant Page Audit
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Audits the current tab natively in your browser session. Scans all frames,
              evaluates WCAG 2.2 rules, tests cookie flags, and inspects headers.
            </p>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={interactive}
                onChange={(e) => setInteractive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Test interactive states (accordions, tabs, popups)
            </label>

            <button
              type="button"
              disabled={isScanning || !currentTabInfo}
              onClick={handleSingleAudit}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                  Auditing Active Page...
                </>
              ) : (
                <>
                  <Play size={15} />
                  Audit Active Tab
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Site Crawl */}
        {activeTab === 'crawl' && (
          <div
            role="tabpanel"
            id="panel-crawl"
            aria-labelledby="tab-crawl"
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3"
          >
            <h2 className="font-semibold text-xs text-gray-800 uppercase tracking-wide">
              Multi-Page BFS Crawler
            </h2>
            <div className="space-y-2">
              <div>
                <label htmlFor="crawlStartUrl" className="block text-[11px] font-medium text-gray-700 mb-1">
                  Start URL
                </label>
                <input
                  id="crawlStartUrl"
                  type="url"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="crawlMaxPages" className="block text-[11px] font-medium text-gray-700 mb-1">
                    Max Pages
                  </label>
                  <input
                    id="crawlMaxPages"
                    type="number"
                    min="1"
                    max="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="crawlMaxDepth" className="block text-[11px] font-medium text-gray-700 mb-1">
                    Max Depth
                  </label>
                  <input
                    id="crawlMaxDepth"
                    type="number"
                    min="0"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={interactive}
                  onChange={(e) => setInteractive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Test interactive states on crawled pages
              </label>
            </div>

            <button
              type="button"
              disabled={isScanning || !crawlUrl.trim()}
              onClick={handleCrawlAudit}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
                  Crawling Site...
                </>
              ) : (
                <>
                  <Play size={15} />
                  Start Site Crawl
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 3: History & Trend Chart */}
        {activeTab === 'history' && (
          <div
            role="tabpanel"
            id="panel-history"
            aria-labelledby="tab-history"
            className="space-y-4"
          >
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-xs text-gray-800 uppercase tracking-wide mb-2">
                Score History
              </h2>
              <TrendChart data={trendData} />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-2">
              <h3 className="font-semibold text-xs text-gray-700">Past Runs</h3>
              {historicalRuns.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">
                  No historical scans yet for this site.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {historicalRuns.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => loadRunDetails(r.id!)}
                      className={`w-full py-2 px-2 flex items-center justify-between text-left text-xs hover:bg-gray-50 rounded transition ${
                        selectedRunId === r.id ? 'bg-blue-50/70 font-semibold text-blue-700' : ''
                      }`}
                    >
                      <span>{new Date(r.startedAt).toLocaleString()}</span>
                      <span className="font-mono text-[11px] text-gray-500">
                        {r.pageCount} page(s)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan Status Banner */}
        {isScanning && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none shrink-0 text-blue-600" />
              <span className="truncate">{scanStatus}</span>
            </div>
            {crawlController && (
              <button
                type="button"
                onClick={handleCancelCrawl}
                className="shrink-0 px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
              >
                Cancel Crawl
              </button>
            )}
          </div>
        )}

        {/* Error Banner */}
        {scanError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            <AlertTriangle size={16} className="shrink-0 text-red-600 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        {/* Results View */}
        {runData && (
          <div className="mt-4">
            <ScanRunResults
              run={runData.run}
              pageResults={runData.pageResults}
              pageStates={runData.pageStates}
              findings={runData.findings}
              activeTabId={currentTabInfo?.id}
            />
          </div>
        )}
      </main>
    </div>
  );
}
