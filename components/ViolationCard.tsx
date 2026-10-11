import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
  Code,
  FileText,
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { generateRemediation } from '@/core/remediate';
import type { FindingRecord } from '@/core/types';

/**
 * Security: Validate that a URL from page-derived data is safe to put in an
 * href/src attribute.  Only allows http:// and https:// schemes to prevent
 * javascript:, data:, and other dangerous protocols.
 */
function safeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

interface ViolationCardProps {
  finding: FindingRecord;
  activeTabId?: number | null;
}

export function ViolationCard({ finding, activeTabId }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [fix, setFix] = useState<string | null>(finding.aiSuggestedFix || null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<'md' | 'playwright' | 'jira' | null>(null);

  const isA11y = finding.type === 'a11y';

  async function copyToClipboard(text: string, format: 'md' | 'playwright' | 'jira') {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  }

  function handleCopyMarkdown() {
    const md = [
      `### [${finding.impact.toUpperCase()}] ${finding.ruleId}: ${finding.description}`,
      `- **Type**: ${finding.type === 'a11y' ? 'Accessibility (WCAG 2.2)' : 'Security (OWASP Top 10)'}`,
      `- **Category**: ${finding.category || 'General'}`,
      finding.selector ? `- **Selector**: \`${finding.selector}\`` : '',
      finding.cweId ? `- **CWE**: ${finding.cweId}` : '',
      finding.html ? `\n\`\`\`html\n${finding.html}\n\`\`\`` : '',
      finding.helpUrl ? `\n[Reference Documentation](${finding.helpUrl})` : '',
    ].filter(Boolean).join('\n');
    copyToClipboard(md, 'md');
  }

  function handleCopyPlaywright() {
    const selectorEscaped = (finding.selector || 'body').replace(/'/g, "\\'");
    const pw = [
      `import { test, expect } from '@playwright/test';`,
      ``,
      `test('a11y: ${finding.ruleId}', async ({ page }) => {`,
      `  // Verifies fix for: ${finding.description}`,
      `  const element = page.locator('${selectorEscaped}');`,
      `  await expect(element).toBeVisible();`,
      `});`,
    ].join('\n');
    copyToClipboard(pw, 'playwright');
  }

  function handleCopyJira() {
    const jira = [
      `h3. [${finding.impact.toUpperCase()}] ${finding.ruleId}: ${finding.description}`,
      ``,
      `*Type:* ${finding.type === 'a11y' ? 'Accessibility (WCAG 2.2)' : 'Security (OWASP Top 10)'}`,
      `*Category:* ${finding.category || 'General'}`,
      finding.selector ? `*Selector:* {{${finding.selector}}}` : '',
      finding.cweId ? `*CWE:* ${finding.cweId}` : '',
      finding.html ? `\nh4. Code Sample\n{code:html}\n${finding.html}\n{code}` : '',
      finding.helpUrl ? `\n*Documentation:* ${finding.helpUrl}` : '',
    ].filter(Boolean).join('\n');
    copyToClipboard(jira, 'jira');
  }

  async function handleHighlight() {
    if (!activeTabId || !finding.selector) return;

    try {
      if (isHighlighted) {
        await chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_HIGHLIGHT' });
        setIsHighlighted(false);
      } else {
        const res = await chrome.tabs.sendMessage(activeTabId, {
          type: 'HIGHLIGHT_ELEMENT',
          selector: finding.selector,
          ruleId: finding.ruleId,
          helpText: finding.description,
        });
        if (res?.success) {
          setIsHighlighted(true);
        }
      }
    } catch (err) {
      console.warn('Failed to communicate with tab content script:', err);
    }
  }

  async function handleGenerateFix() {
    setIsFixing(true);
    setFixError(null);
    try {
      const generated = await generateRemediation(finding);
      setFix(generated);
    } catch (err: any) {
      setFixError(err?.message || 'Failed to generate AI fix.');
    } finally {
      setIsFixing(false);
    }
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm transition hover:shadow">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                isA11y
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}
            >
              {finding.type}
            </span>
            <SeverityBadge impact={finding.impact} />
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {finding.ruleId}
            </span>
            {finding.category && (
              <span className="font-mono text-xs text-gray-400">
                {finding.category}
              </span>
            )}
            {finding.confidence === 'needs-review' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border bg-amber-50 text-amber-800 border-amber-300">
                Needs Review
              </span>
            )}
            {finding.cweId && (
              <span className="font-mono text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                {finding.cweId}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug">
            {finding.description}
          </p>
        </div>

        {/* Action icons / Docs */}
        <div className="flex items-center gap-2">
          {isA11y && finding.selector && activeTabId && (
            <button
              type="button"
              onClick={handleHighlight}
              title={isHighlighted ? 'Clear highlight' : 'Highlight in page'}
              aria-label={isHighlighted ? 'Clear highlight in page' : 'Highlight element in page'}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition ${
                isHighlighted
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye size={12} />
              {isHighlighted ? 'Highlighted' : 'Highlight'}
            </button>
          )}

          {safeDomain(finding.helpUrl) && (
            <a
              href={safeDomain(finding.helpUrl)!}
              target="_blank"
              rel="noopener noreferrer"
              title="Documentation"
              aria-label="View official documentation (opens in new tab)"
              className="text-gray-400 hover:text-blue-600 p-1 rounded"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Copy As Export Toolbar */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100/80">
        <span className="text-[10px] font-medium text-gray-400">Copy as:</span>
        <button
          type="button"
          onClick={handleCopyMarkdown}
          title="Copy finding formatted for GitHub / Markdown"
          aria-label="Copy finding as Markdown"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
        >
          {copiedFormat === 'md' ? <CheckCircle2 size={11} className="text-emerald-600" /> : <FileText size={11} />}
          {copiedFormat === 'md' ? 'Copied!' : 'Markdown'}
        </button>
        {isA11y && finding.selector && (
          <button
            type="button"
            onClick={handleCopyPlaywright}
            title="Copy as Playwright test locator"
            aria-label="Copy finding as Playwright test"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
          >
            {copiedFormat === 'playwright' ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Code size={11} />}
            {copiedFormat === 'playwright' ? 'Copied!' : 'Playwright'}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopyJira}
          title="Copy formatted for Jira / Linear"
          aria-label="Copy finding as Jira ticket"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
        >
          {copiedFormat === 'jira' ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Copy size={11} />}
          {copiedFormat === 'jira' ? 'Copied!' : 'Jira'}
        </button>
      </div>

      {/* Code snippet / Selector toggle */}
      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-controls={`details-${finding.id}`}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-gray-600 hover:text-gray-900 py-1"
        >
          <span className="flex items-center gap-1">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isA11y
              ? `Target: ${finding.selector || 'Element'}`
              : 'Headers / Exposure Context'}
          </span>
          <span className="text-[11px] text-gray-400">
            {expanded ? 'Hide details' : 'View details'}
          </span>
        </button>

        {expanded && (
          <div id={`details-${finding.id}`} className="mt-2 space-y-2">
            {isA11y ? (
              finding.html && (
                <div className="overflow-x-auto rounded border border-gray-800 bg-gray-900 p-2.5 text-xs text-green-300 font-mono">
                  <code>{finding.html}</code>
                </div>
              )
            ) : (
              <div className="space-y-2">
                {finding.requestHeaders && (
                  <div>
                    <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                      Request:
                    </div>
                    <pre className="overflow-x-auto rounded border border-gray-800 bg-gray-900 p-2 text-xs text-blue-300 font-mono">
                      <code>{finding.requestHeaders}</code>
                    </pre>
                  </div>
                )}
                {finding.responseHeaders && (
                  <div>
                    <div className="text-[10px] font-mono text-gray-500 mb-0.5">
                      Response:
                    </div>
                    <pre className="overflow-x-auto rounded border border-gray-800 bg-gray-900 p-2 text-xs text-green-300 font-mono">
                      <code>{finding.responseHeaders}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Remediation Section */}
      <div className="mt-3 border-t border-gray-100 pt-2.5">
        {fix ? (
          <div className="rounded border border-purple-200 bg-purple-50/50 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900 mb-1">
              <Sparkles size={13} className="text-purple-600" />
              AI Suggested Fix:
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-purple-950 bg-white p-2 rounded border border-purple-100">
              {fix}
            </pre>
          </div>
        ) : (
          <div>
            <button
              type="button"
              disabled={isFixing}
              onClick={handleGenerateFix}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition disabled:opacity-50"
            >
              {isFixing ? (
                <>
                  <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                  Generating Fix...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Generate AI Fix
                </>
              )}
            </button>
            {fixError && (
              <p className="mt-1 text-xs text-red-600">{fixError}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
