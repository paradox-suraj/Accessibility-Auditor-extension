import React, { useEffect, useState } from 'react';
import { db } from '@/core/db';
import { evaluateConformance, type ConformanceEvaluation } from '@/core/wcag';
import { evaluateOwaspConformance, type OwaspEvaluation } from '@/core/owasp';
import { Printer, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react';
import type { ScanRunRecord, PageResultRecord, FindingRecord } from '@/core/types';

export default function AcrApp() {
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<ScanRunRecord | null>(null);
  const [wcagEvaluations, setWcagEvaluations] = useState<ConformanceEvaluation[]>([]);
  const [owaspEvaluations, setOwaspEvaluations] = useState<OwaspEvaluation[]>([]);

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

      const pageResults = await db.pageResults.where('scanRunId').equals(runId).toArray();
      const pIds = pageResults.map((p) => p.id!);

      const pageStates = await db.pageStates.where('pageResultId').anyOf(pIds).toArray();
      const sIds = pageStates.map((s) => s.id!);

      const findings = await db.findings.where('pageStateId').anyOf(sIds).toArray();

      // Flatten a11y findings
      const a11yFindings = findings
        .filter((f) => f.type === 'a11y')
        .map((f) => ({
          wcagCriterion: f.category,
          ruleId: f.ruleId,
        }));

      // Flatten security findings
      const secFindings = findings
        .filter((f) => f.type === 'security')
        .map((f) => ({
          category: f.category,
          ruleId: f.ruleId,
          pageUrl: '',
        }));

      const wcag = evaluateConformance(a11yFindings, pageResults.length);
      const owasp = evaluateOwaspConformance(secFindings, pageResults.length);

      setRun(r);
      setWcagEvaluations(wcag);
      setOwaspEvaluations(owasp);
      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        Generating Conformance Report...
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

  return (
    <div className="min-h-screen py-8 px-4 print:p-0 print:bg-white text-gray-900">
      {/* Floating Action Header */}
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

      {/* Main Document */}
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none print:p-0 space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white print:border print:border-gray-800">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Accessibility & Security Conformance Report (ACR)</h1>
              <p className="text-xs text-gray-500">Automated Evaluation: WCAG 2.2 (Level A/AA) and OWASP Top 10</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-3 space-y-1">
            <p>Scan Run ID: <span className="font-mono text-gray-700">{run.id}</span></p>
            <p>Generated: {new Date(run.startedAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Evaluation Methodology Callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 space-y-2">
          <h2 className="font-bold text-sm text-amber-950">Evaluation Scope and Methods</h2>
          <ul className="list-disc list-inside space-y-1 text-amber-800">
            <li><strong>Accessibility Standard:</strong> WCAG 2.2 (Level A and Level AA). Evaluated via in-browser axe-core automation.</li>
            <li><strong>Security Standard:</strong> OWASP Top 10 (2021). Evaluated via passive security header inspection, cookie flag verification, and origin exposure probes.</li>
            <li><strong>Limitations:</strong> Automated testing covers ~30–40% of WCAG criteria. Items labeled <em>Not Evaluated</em> require manual keyboard or screen reader testing.</li>
          </ul>
        </div>

        {/* WCAG Table */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-1">
            WCAG 2.2 Conformance Matrix
          </h2>
          <table className="w-full text-left text-xs border border-gray-200 border-collapse">
            <thead className="bg-gray-100 font-semibold text-gray-700">
              <tr>
                <th className="border border-gray-200 p-2.5 w-1/3">Criterion</th>
                <th className="border border-gray-200 p-2.5 w-1/4">Status</th>
                <th className="border border-gray-200 p-2.5">Evaluation Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {wcagEvaluations.map((item) => (
                <tr key={item.criterion.id} className="hover:bg-gray-50/50">
                  <td className="border border-gray-200 p-2.5">
                    <strong>{item.criterion.id}</strong>: {item.criterion.name} (Level {item.criterion.level})
                  </td>
                  <td className="border border-gray-200 p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        item.status === 'Supports'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'Partially Supports'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'Does Not Support'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="border border-gray-200 p-2.5 text-gray-600">
                    {item.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* OWASP Table */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-1">
            OWASP Top 10 Security Posture Matrix
          </h2>
          <table className="w-full text-left text-xs border border-gray-200 border-collapse">
            <thead className="bg-gray-100 font-semibold text-gray-700">
              <tr>
                <th className="border border-gray-200 p-2.5 w-1/3">Category</th>
                <th className="border border-gray-200 p-2.5 w-1/4">Status</th>
                <th className="border border-gray-200 p-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {owaspEvaluations.map((item) => (
                <tr key={item.category.id} className="hover:bg-gray-50/50">
                  <td className="border border-gray-200 p-2.5">
                    <strong>{item.category.id}</strong>: {item.category.name}
                  </td>
                  <td className="border border-gray-200 p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        item.status === 'Supports'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'Partially Supports'
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'Does Not Support'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="border border-gray-200 p-2.5 text-gray-600">
                    {item.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
