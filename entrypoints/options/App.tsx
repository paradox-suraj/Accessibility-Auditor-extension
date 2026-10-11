import React, { useState, useEffect } from 'react';
import {
  Key,
  Database,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Save,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  AI_PROVIDERS,
  type AIProviderId,
  type AIModelOption,
  getActiveAIProvider,
  setActiveAIProvider,
  getAIProviderKey,
  setAIProviderKey,
  getAIProviderModel,
  setAIProviderModel,
  testAIConnection,
  fetchRemoteModels,
} from '@/core/remediate';
import { db } from '@/core/db';

const AVAILABLE_TAGS = [
  { id: 'wcag2a', label: 'WCAG 2.0 Level A' },
  { id: 'wcag2aa', label: 'WCAG 2.0 Level AA' },
  { id: 'wcag21aa', label: 'WCAG 2.1 Level AA' },
  { id: 'wcag22aa', label: 'WCAG 2.2 Level AA' },
  { id: 'best-practice', label: 'Axe Best Practices' },
];

const PROVIDER_LIST: AIProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'deepseek',
  'grok',
  'openrouter',
];

export default function OptionsApp() {
  const [activeProvider, setProvider] = useState<AIProviderId>('gemini');
  const [apiKeys, setApiKeys] = useState<Record<AIProviderId, string>>({
    gemini: '',
    openai: '',
    anthropic: '',
    deepseek: '',
    grok: '',
    openrouter: '',
  });
  const [models, setModels] = useState<Record<AIProviderId, string>>({
    gemini: AI_PROVIDERS.gemini.defaultModel,
    openai: AI_PROVIDERS.openai.defaultModel,
    anthropic: AI_PROVIDERS.anthropic.defaultModel,
    deepseek: AI_PROVIDERS.deepseek.defaultModel,
    grok: AI_PROVIDERS.grok.defaultModel,
    openrouter: AI_PROVIDERS.openrouter.defaultModel,
  });

  const [liveModels, setLiveModels] = useState<Record<AIProviderId, AIModelOption[] | null>>({
    gemini: null,
    openai: null,
    anthropic: null,
    deepseek: null,
    grok: null,
    openrouter: null,
  });
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ success: boolean; text: string } | null>(null);

  const [customModelMode, setCustomModelMode] = useState<Record<AIProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    deepseek: false,
    grok: false,
    openrouter: false,
  });

  const [activeTags, setActiveTags] = useState<string[]>(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  const [allowActiveChecks, setAllowActiveChecks] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Stats
  const [siteCount, setSiteCount] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [findingCount, setFindingCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      const active = await getActiveAIProvider();
      setProvider(active);

      const keysAcc: Record<AIProviderId, string> = { ...apiKeys };
      const modelsAcc: Record<AIProviderId, string> = { ...models };

      for (const p of PROVIDER_LIST) {
        const k = await getAIProviderKey(p);
        if (k) keysAcc[p] = k;
        const m = await getAIProviderModel(p);
        if (m) modelsAcc[p] = m;
      }

      setApiKeys(keysAcc);
      setModels(modelsAcc);

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(['axeTags', 'allowActiveChecks']);
        if (stored.axeTags && Array.isArray(stored.axeTags)) {
          setActiveTags(stored.axeTags);
        }
        if (typeof stored.allowActiveChecks === 'boolean') {
          setAllowActiveChecks(stored.allowActiveChecks);
        }
      }

      const sCount = await db.sites.count();
      const rCount = await db.scanRuns.count();
      const fCount = await db.findings.count();
      setSiteCount(sCount);
      setRunCount(rCount);
      setFindingCount(fCount);
    }
    loadData();
  }, []);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    await setActiveAIProvider(activeProvider);

    for (const p of PROVIDER_LIST) {
      await setAIProviderKey(p, apiKeys[p].trim());
      await setAIProviderModel(p, models[p].trim());
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        axeTags: activeTags,
        allowActiveChecks,
      });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  function toggleTag(tagId: string) {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleTestConnection() {
    const key = apiKeys[activeProvider];
    const model = models[activeProvider];
    if (!key.trim()) return;

    setTestingKey(true);
    setTestResult(null);

    try {
      const res = await testAIConnection(activeProvider, key, model);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection test error: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setTestingKey(false);
    }
  }

  async function handleFetchModels() {
    const key = apiKeys[activeProvider];
    if (!key.trim()) return;

    setFetchingModels(true);
    setFetchMsg(null);

    try {
      const list = await fetchRemoteModels(activeProvider, key);
      if (list.length > 0) {
        setLiveModels((prev) => ({ ...prev, [activeProvider]: list }));
        setFetchMsg({ success: true, text: `Successfully discovered ${list.length} available models for your account!` });
        // If current model isn't in discovered list, select first available
        if (!list.some((m) => m.id === models[activeProvider])) {
          setModels((prev) => ({ ...prev, [activeProvider]: list[0].id }));
        }
      } else {
        setFetchMsg({ success: false, text: 'No text models returned by API for this key.' });
      }
    } catch (err: any) {
      setFetchMsg({ success: false, text: `Could not fetch models: ${err?.message || 'Check your API key.'}` });
    } finally {
      setFetchingModels(false);
    }
  }

  async function handleClearHistory() {
    if (confirm('Are you sure you want to delete all historical scans and findings?')) {
      await db.sites.clear();
      await db.scanRuns.clear();
      await db.pageResults.clear();
      await db.pageStates.clear();
      await db.findings.clear();
      await db.aiCache.clear();
      setSiteCount(0);
      setRunCount(0);
      setFindingCount(0);
    }
  }

  const currentProviderConfig = AI_PROVIDERS[activeProvider];
  const modelOptions = liveModels[activeProvider] || currentProviderConfig.models;
  const isCustomModel = customModelMode[activeProvider];

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Accessibility Auditor Settings
          </h1>
          <p className="text-sm text-gray-500">
            Configure multi-provider AI remediation, scan preferences, and local storage.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* Section 1: AI Remediation Multi-Provider */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <Key size={18} className="text-blue-600" />
              AI Remediation Engine (BYOK)
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Zero Server Intermediaries
            </span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Choose your preferred cloud AI provider. Requests and code snippets are sent directly from your browser to the official provider endpoint. Your API key and audited code never touch any third-party backend.
          </p>

          {/* Provider Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Select Active AI Provider
            </label>
            <div
              role="tablist"
              aria-label="AI Providers"
              className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 rounded-xl bg-gray-100 border border-gray-200"
            >
              {PROVIDER_LIST.map((p) => {
                const conf = AI_PROVIDERS[p];
                const isActive = activeProvider === p;
                const hasKey = !!apiKeys[p]?.trim();

                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    id={`tab-${p}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${p}`}
                    onClick={() => {
                      setProvider(p);
                      setTestResult(null);
                      setFetchMsg(null);
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition relative ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                    }`}
                  >
                    <span>{conf.name}</span>
                    {hasKey && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" title="API key configured" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Provider Configuration Card */}
          <div
            role="tabpanel"
            id={`panel-${activeProvider}`}
            aria-labelledby={`tab-${activeProvider}`}
            className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                {currentProviderConfig.name} Configuration
              </span>
              <a
                href={currentProviderConfig.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
              >
                Get API Key on {currentProviderConfig.portalLabel}
                <ExternalLink size={11} />
              </a>
            </div>

            {/* API Key Input */}
            <div>
              <label htmlFor="apiKeyInput" className="block text-xs font-semibold text-gray-700 mb-1">
                {currentProviderConfig.name} API Key
              </label>
              <input
                id="apiKeyInput"
                type="password"
                value={apiKeys[activeProvider]}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiKeys((prev) => ({ ...prev, [activeProvider]: val }));
                }}
                placeholder={currentProviderConfig.placeholderKey}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="modelSelect" className="text-xs font-semibold text-gray-700">
                  Model
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={fetchingModels || !apiKeys[activeProvider]?.trim()}
                    onClick={handleFetchModels}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 disabled:opacity-40"
                    title="Connects with your API key to fetch currently accessible models"
                  >
                    <RefreshCw size={11} className={fetchingModels ? 'animate-spin motion-reduce:animate-none' : ''} />
                    {fetchingModels ? 'Discovering Models...' : 'Fetch Live Models'}
                  </button>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCustomModel}
                      onChange={(e) =>
                        setCustomModelMode((prev) => ({
                          ...prev,
                          [activeProvider]: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300 text-blue-600 w-3.5 h-3.5"
                    />
                    Custom Model ID
                  </label>
                </div>
              </div>

              {isCustomModel ? (
                <input
                  type="text"
                  value={models[activeProvider]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModels((prev) => ({ ...prev, [activeProvider]: val }));
                  }}
                  placeholder="e.g. gpt-4o, claude-3-7-sonnet-latest, deepseek-chat..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              ) : (
                <select
                  id="modelSelect"
                  value={models[activeProvider]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModels((prev) => ({ ...prev, [activeProvider]: val }));
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}

              {fetchMsg && (
                <p className={`text-[11px] font-medium ${fetchMsg.success ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {fetchMsg.text}
                </p>
              )}
            </div>

            {/* Test Connection & Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <Save size={14} />
                Save All Settings
              </button>
              <button
                type="button"
                disabled={testingKey || !apiKeys[activeProvider]?.trim()}
                onClick={handleTestConnection}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {testingKey ? 'Testing Connection...' : `Test ${currentProviderConfig.name}`}
              </button>
            </div>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
              <CheckCircle2 size={16} />
              All AI provider settings & preferences saved successfully!
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-start gap-2 text-xs font-medium p-3 rounded-lg border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </section>

        {/* Section 2: Accessibility Standards */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <Sliders size={18} className="text-blue-600" />
            Accessibility Rulesets (axe-core 4.10.2)
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Select the WCAG conformance levels and standard rule tags to enforce during page and crawl audits.
          </p>

          <div className="space-y-2">
            {AVAILABLE_TAGS.map((tag) => {
              const isChecked = activeTags.includes(tag.id);
              return (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTag(tag.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-800">{tag.label}</span>
                    <span className="text-[11px] font-mono text-gray-400">{tag.id}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Section 3: Active Security Checks */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <ShieldCheck size={18} className="text-blue-600" />
            Active Security Probing (Opt-In)
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Passive security scans analyze existing HTTP headers and cookie attributes without generating extra server traffic.
            Active probing tests for common repository exposure (<code className="bg-gray-100 px-1 py-0.5 rounded">.git/HEAD</code>)
            and environment files (<code className="bg-gray-100 px-1 py-0.5 rounded">.env</code>).
          </p>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
            <input
              type="checkbox"
              checked={allowActiveChecks}
              onChange={(e) => setAllowActiveChecks(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
            />
            <div className="space-y-1">
              <span className="text-xs font-semibold text-amber-900 block">
                Enable Active Path Probes (.git/HEAD and .env)
              </span>
              <span className="text-[11px] text-amber-700 leading-relaxed block">
                <strong>Notice:</strong> Probes generate active HTTP GET requests that appear in server access logs.
                Soft-404 baseline detection and content signature validation are automatically enforced to prevent false positives.
              </span>
            </div>
          </label>
        </section>
      </form>

      {/* Section 4: Local Database */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Database size={18} className="text-blue-600" />
          Local Storage & IndexedDB
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          All scan runs, page findings, and remediation history are stored privately in IndexedDB on this device.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
            <div className="text-lg font-bold text-gray-900">{siteCount}</div>
            <div className="text-xs text-gray-500">Sites Scanned</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
            <div className="text-lg font-bold text-gray-900">{runCount}</div>
            <div className="text-xs text-gray-500">Total Scan Runs</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
            <div className="text-lg font-bold text-gray-900">{findingCount}</div>
            <div className="text-xs text-gray-500">Stored Findings</div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleClearHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
          >
            <Trash2 size={14} />
            Clear All History & Cache
          </button>
        </div>
      </section>
    </div>
  );
}
