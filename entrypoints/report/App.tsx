import React, { useEffect, useState } from 'react';
import { db } from '@/core/db';
import { Printer, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { SeverityBadge } from '@/components/SeverityBadge';
import type {
  ScanRunRecord,
  PageResultRecord,
  PageStateRecord,
  FindingRecord,
} from '@/core/types';

export default function ReportApp() {
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<ScanRunRecord | null>(null);
  const [pageResults, setPageResults] = useState<PageResultRecord[]>([]);
  const [pageStates, setPageStates] = useState<PageStateRecord[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      const params = new URLSearchParams(window.location.search);
      const runId = params.get('runId');
      if (!runId) {
        setLoading(false);
        return;
      }

      const r = await db.scanRuns.get(runId);
      if (!r) {
        setLoading(false);
        return;
      }

      const pResults = await db.pageResults.where('scanRunId').equals(runId).toArray();
      const pIds = pResults.map((p) => p.id!);

      const pStates = await db.pageStates.where('pageResultId').anyOf(pIds).toArray();
      const sIds = pStates.map((s) => s.id!);

      const fList = await db.findings.where('pageStateId').anyOf(sIds).toArray();

      setRun(r);
      setPageResults(pResults);
      setPageStates(pStates);
      setFindings(fList);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        Loading scan report...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">
        Scan run not found.
      </div>
    );
  }

  const counts = {
    critical: findings.filter((v) => v.impact === 'critical').length,
    serious: findings.filter((v) => v.impact === 'serious').length,
    moderate: findings.filter((v) => v.impact === 'moderate').length,
    minor: findings.filter((v) => v.impact === 'minor').length,
  };

  return (
    <div className="min-h-screen py-8 px-4 print:p-0 print:bg-white">
      {/* Floating Action Header (hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
        >
          <ArrowLeft size={14} />
          Close Report
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700 transition"
        >
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      {/* Main Printable Document */}
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white print:border print:border-gray-800">
              <ShieldCheck size={20} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Accessibility & Security Scan Report</h1>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Scan Run ID: <span className="font-mono text-gray-700">{run.id}</span></p>
            <p>Date: {new Date(run.startedAt).toLocaleString()}</p>
            <p>Pages Scanned: {pageResults.length}</p>
          </div>
        </div>

        {/* Severity Metrics Bar */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {(['critical', 'serious', 'moderate', 'minor'] as const).map((sev) => (
            <div key={sev} className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between">
              <SeverityBadge impact={sev} />
              <span className="text-lg font-bold text-gray-900">{counts[sev]}</span>
            </div>
          ))}
        </div>

        {/* Scanned Pages Breakdown */}
        <div className="space-y-8">
          {pageResults.map((page) => {
            const states = pageStates.filter((s) => s.pageResultId === page.id);
            const pageFindings = findings.filter((f) =>
              states.some((s) => s.id === f.pageStateId)
            );

            return (
              <section key={page.id} className="border border-gray-200 rounded-lg overflow-hidden break-inside-avoid">
                <div className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold font-mono text-blue-800 break-all">{page.url}</h2>
                    <span className="text-xs font-semibold text-gray-600 mt-1 inline-block">Score: {page.score}/100</span>
                  </div>
                  {pageFindings.length === 0 ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={16} /> 0 Issues
                    </span>
                  ) : (
                    <span className="text-xs font-bold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full">
                      {pageFindings.length} Issue(s)
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {states.map((state) => {
                    const stateFindings = pageFindings.filter((f) => f.pageStateId === state.id);
                    if (stateFindings.length === 0) return null;

                    return (
                      <div key={state.id} className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-700 border-b border-gray-100 pb-1 uppercase tracking-wide">
                          {state.label === 'default' ? 'Default State' : `Interactive: ${state.label}`}
                        </h3>

                        <div className="space-y-3">
                          {stateFindings.map((finding) => (
                            <div key={finding.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border bg-white text-gray-700">
                                  {finding.type}
                                </span>
                                <SeverityBadge impact={finding.impact} />
                                <span className="font-mono text-xs text-gray-500 font-semibold">{finding.ruleId}</span>
                                {finding.category && (
                                  <span className="font-mono text-xs text-gray-400">{finding.category}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-800 font-medium mb-2">{finding.description}</p>
                              {finding.html && (
                                <div className="overflow-x-auto bg-gray-900 text-green-300 font-mono text-[11px] p-2 rounded">
                                  <code>{finding.html}</code>
                                </div>
                              )}
                              {finding.aiSuggestedFix && (
                                <div className="mt-2 bg-purple-50 border border-purple-200 rounded p-2 text-xs font-mono text-purple-950">
                                  <strong>Remediation:</strong> {finding.aiSuggestedFix}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
