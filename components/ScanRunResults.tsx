import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ListOrdered,
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { ViolationCard } from './ViolationCard';
import { clusterFindings } from '@/core/clustering';
import type {
  ScanRunRecord,
  PageResultRecord,
  PageStateRecord,
  FindingRecord,
} from '@/core/types';

interface ScanRunResultsProps {
  run: ScanRunRecord;
  pageResults: PageResultRecord[];
  pageStates: PageStateRecord[];
  findings: FindingRecord[];
  activeTabId?: number | null;
}

export function ScanRunResults({
  run,
  pageResults,
  pageStates,
  findings,
  activeTabId,
}: ScanRunResultsProps) {
  const [viewMode, setViewMode] = useState<'pages' | 'clusters'>('pages');
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({
    [pageResults[0]?.id || '']: true,
  });

  const clusters = useMemo(
    () => clusterFindings(findings, pageStates, pageResults),
    [findings, pageStates, pageResults]
  );

  const counts = {
    critical: findings.filter((v) => v.impact === 'critical').length,
    serious: findings.filter((v) => v.impact === 'serious').length,
    moderate: findings.filter((v) => v.impact === 'moderate').length,
    minor: findings.filter((v) => v.impact === 'minor').length,
  };

  const togglePage = (id: string) => {
    setExpandedPages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openReport = (type: 'report' | 'acr') => {
    const url = chrome.runtime.getURL(`${type}.html?runId=${run.id}`);
    chrome.tabs.create({ url });
  };

  return (
    <div className="space-y-4">
      {/* Overview & Action Bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Scan Run
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  run.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(run.startedAt).toLocaleString()} • {pageResults.length} page(s)
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {run.a11yScore !== undefined && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  A11y Score: {run.a11yScore}/100
                </span>
              )}
              {run.securityScore !== undefined && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                  Security: {run.securityScore}/100
                </span>
              )}
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openReport('report')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
            >
              <FileText size={13} />
              PDF Report
            </button>
            <button
              type="button"
              onClick={() => openReport('acr')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
            >
              <FileCheck size={13} />
              ACR Report
            </button>
          </div>
        </div>

        {/* Severity Count Chips */}
        <div className="grid grid-cols-4 gap-2 pt-3">
          {(['critical', 'serious', 'moderate', 'minor'] as const).map((impact) => (
            <div
              key={impact}
              className="flex flex-col items-center justify-center p-2 rounded bg-gray-50 border border-gray-100 text-center"
            >
              <span className="text-base font-bold text-gray-900">
                {counts[impact]}
              </span>
              <SeverityBadge impact={impact} className="mt-1" />
            </div>
          ))}
        </div>

        {/* View Mode Segmented Control */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Group Findings:
          </span>
          <div
            role="group"
            aria-label="Findings grouping options"
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setViewMode('pages')}
              aria-pressed={viewMode === 'pages'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                viewMode === 'pages'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <ListOrdered size={13} />
              By Page ({pageResults.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clusters')}
              aria-pressed={viewMode === 'clusters'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                viewMode === 'clusters'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers size={13} />
              Top Fixes ({Math.min(10, clusters.length)})
            </button>
          </div>
        </div>
      </div>

      {/* View 1: Top Fixes Component Clustering */}
      {viewMode === 'clusters' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
            <strong>Root-Cause Analysis:</strong> Identified <strong>{clusters.length}</strong> unique component defect pattern{clusters.length !== 1 ? 's' : ''} across {pageResults.length} page{pageResults.length !== 1 ? 's' : ''}. Fixing high-recurrence components (like shared navbars, headers, or footers) eliminates multiple defects at once.
          </div>

          {clusters.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-xs text-gray-500">
              <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-1" />
              Zero component violations detected!
            </div>
          ) : (
            clusters.slice(0, 10).map((cluster, idx) => (
              <div
                key={cluster.clusterKey}
                className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <SeverityBadge impact={cluster.impact} />
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {cluster.ruleId}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {cluster.instanceCount} defect{cluster.instanceCount !== 1 ? 's' : ''} across {cluster.affectedPagesCount} page{cluster.affectedPagesCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {cluster.selector && (
                  <div className="text-[11px] font-mono text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100 truncate">
                    Selector: <code className="text-gray-900 font-semibold">{cluster.selector}</code>
                  </div>
                )}

                <ViolationCard
                  finding={cluster.sampleFinding}
                  activeTabId={activeTabId}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* View 2: By Pages and States */}
      {viewMode === 'pages' && (
        <div className="space-y-3">
          {pageResults.map((page) => {
            const isExpanded = !!expandedPages[page.id!];
            const states = pageStates.filter((s) => s.pageResultId === page.id);
            const pageFindings = findings.filter((f) =>
              states.some((s) => s.id === f.pageStateId)
            );

            const scoreColor =
              page.score >= 90
                ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
                : page.score >= 70
                ? 'text-amber-700 bg-amber-50 border-amber-300'
                : 'text-red-700 bg-red-50 border-red-300';

            return (
              <div
                key={page.id}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => togglePage(page.id!)}
                  aria-expanded={isExpanded}
                  aria-controls={`page-panel-${page.id}`}
                  className="flex w-full items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 transition text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    )}
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${scoreColor}`}
                    >
                      {page.score}
                    </div>
                    <span className="text-xs font-mono text-blue-700 truncate font-medium">
                      {page.url}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {pageFindings.length === 0 ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={14} /> 0 Issues
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        {pageFindings.length} Issue{pageFindings.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div id={`page-panel-${page.id}`} className="p-3.5 space-y-4 border-t border-gray-100">
                    {states.map((state) => {
                      const stateFindings = findings.filter(
                        (f) => f.pageStateId === state.id
                      );

                      return (
                        <div key={state.id} className="space-y-2">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                              {state.label === 'default'
                                ? 'Default State (On Load)'
                                : `Interactive State: ${state.label}`}
                            </h4>
                            <span className="text-[11px] text-gray-500 font-mono">
                              Score: {state.score}
                            </span>
                          </div>

                          {stateFindings.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-1">
                              No violations found in this state.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {stateFindings.map((finding) => (
                                <ViolationCard
                                  key={finding.id}
                                  finding={finding}
                                  activeTabId={activeTabId}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
