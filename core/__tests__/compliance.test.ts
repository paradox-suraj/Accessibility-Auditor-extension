import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractWcagCriterion, calculateStateScore, calculateSeparatedScores, makeComponentFingerprint } from '../scoring';
import { checkSecurityHeaders, checkCookies } from '../securityScanner';
import { evaluateConformance } from '../wcag';
import { evaluateOwaspConformance } from '../owasp';

describe('Accessibility Scoring Engine', () => {
  it('correctly maps various WCAG tags to standard criterion format', () => {
    expect(extractWcagCriterion(['wcag2a', 'wcag143'])).toBe('wcag143');
    expect(extractWcagCriterion(['wcag21aa', 'wcag1410', 'cat.color'])).toBe('wcag1410');
    expect(extractWcagCriterion(['wcag2aa', 'wcag244'])).toBe('wcag244');
    expect(extractWcagCriterion(['wcag2411', 'wcag22aa'])).toBe('wcag2411');
    expect(extractWcagCriterion(['non-wcag-tag'])).toBe('unknown');
  });

  it('guarantees score monotonicity: adding violations strictly decreases or maintains score', () => {
    const baseScore = calculateStateScore([]);
    expect(baseScore).toBe(100);

    const minor = calculateStateScore([{ impact: 'minor' }]);
    expect(minor).toBe(99);

    const moderate = calculateStateScore([{ impact: 'minor' }, { impact: 'moderate' }]);
    expect(moderate).toBe(97);

    const serious = calculateStateScore([{ impact: 'minor' }, { impact: 'moderate' }, { impact: 'serious' }]);
    expect(serious).toBe(92);

    const critical = calculateStateScore([{ impact: 'minor' }, { impact: 'moderate' }, { impact: 'serious' }, { impact: 'critical' }]);
    expect(critical).toBe(82);

    // Caps at zero floor
    const heavyFailures = Array.from({ length: 20 }, () => ({ impact: 'critical' }));
    expect(calculateStateScore(heavyFailures)).toBe(0);
  });

  it('correctly separates accessibility scores from security scores', () => {
    const mixedFindings: any[] = [
      { type: 'a11y', impact: 'critical' },
      { type: 'a11y', impact: 'serious' },
      { type: 'security', impact: 'critical' },
      { type: 'security', impact: 'critical' },
      { type: 'security', impact: 'moderate' },
    ];

    const { a11yScore, securityScore } = calculateSeparatedScores(mixedFindings);
    expect(a11yScore).toBe(100 - (10 + 5)); // 85
    expect(securityScore).toBe(100 - (20 + 2)); // 78
  });
});

describe('Security Headers & Policy Enforcement', () => {
  it('requires all four critical security headers for 100% compliance', () => {
    const testCases = [
      {
        headers: new Headers({
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
        }),
        missingRule: 'missing-hsts',
      },
      {
        headers: new Headers({
          'strict-transport-security': 'max-age=31536000',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
        }),
        missingRule: 'missing-csp',
      },
      {
        headers: new Headers({
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-frame-options': 'DENY',
        }),
        missingRule: 'missing-xcto',
      },
      {
        headers: new Headers({
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
        }),
        missingRule: 'missing-clickjacking-protection',
      },
    ];

    for (const { headers, missingRule } of testCases) {
      const findings = checkSecurityHeaders('https://example.com', headers);
      expect(findings.some((f) => f.ruleId === missingRule)).toBe(true);
    }
  });

  it('accepts CSP frame-ancestors as valid clickjacking mitigation in lieu of X-Frame-Options', () => {
    const headers = new Headers({
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
      'x-content-type-options': 'nosniff',
    });

    const findings = checkSecurityHeaders('https://example.com', headers);
    expect(findings.some((f) => f.ruleId === 'missing-clickjacking-protection')).toBe(false);
  });
});

describe('Standards Conformance Matrix (VPAT & OWASP)', () => {
  it('evaluates Section 508 VPAT matrix with standard conformance labels', () => {
    const evaluations = evaluateConformance([
      { wcagCriterion: 'wcag111', ruleId: 'image-alt', pageUrl: 'https://example.com' },
    ], 1);

    const nonTextEval = evaluations.find((e) => e.criterion.id === '1.1.1');
    expect(nonTextEval?.status).toBe('Does Not Support');

    const compliantEval = evaluations.find((e) => e.criterion.id === '1.4.3');
    expect(compliantEval?.status).toBe('Supports');

    // Unautomated criteria must be marked Not Evaluated
    const manualEval = evaluations.find((e) => e.status === 'Not Evaluated');
    expect(manualEval).toBeDefined();
    expect(manualEval?.remarks).toContain('requires manual testing');
  });

  it('maps exposed-git and exposed-env correctly to OWASP A01:2021 & A05:2021', () => {
    const findings = [
      { category: 'Security Misconfiguration', ruleId: 'exposed-git', pageUrl: 'https://example.com' },
      { category: 'Security Misconfiguration', ruleId: 'exposed-env', pageUrl: 'https://example.com' },
    ];

    const evaluations = evaluateOwaspConformance(findings, 1);
    const a01 = evaluations.find((e) => e.category.id === 'A01:2021');
    const a05 = evaluations.find((e) => e.category.id === 'A05:2021');

    expect(a01?.status).toBe('Does Not Support');
    expect(a05?.status).toBe('Does Not Support');
    expect(a01?.remarks).toContain('exposed-git');
    expect(a05?.remarks).toContain('exposed-env');
  });
});

describe('Component-Level Clustering & Root Cause Grouping', () => {
  it('groups recurring template defects across multiple pages and ranks by severity', async () => {
    const { clusterFindings } = await import('../clustering');

    const mockPageResults: any[] = [
      { id: 'page-1', url: 'https://example.com/home' },
      { id: 'page-2', url: 'https://example.com/about' },
      { id: 'page-3', url: 'https://example.com/contact' },
    ];

    const mockPageStates: any[] = [
      { id: 'state-1', pageResultId: 'page-1' },
      { id: 'state-2', pageResultId: 'page-2' },
      { id: 'state-3', pageResultId: 'page-3' },
    ];

    const mockFindings: any[] = [
      // Serious issue on all 3 pages (shared footer nav)
      { id: 'f1', pageStateId: 'state-1', type: 'a11y', ruleId: 'color-contrast', selector: 'footer a', impact: 'serious', description: 'Low contrast' },
      { id: 'f2', pageStateId: 'state-2', type: 'a11y', ruleId: 'color-contrast', selector: 'footer a', impact: 'serious', description: 'Low contrast' },
      { id: 'f3', pageStateId: 'state-3', type: 'a11y', ruleId: 'color-contrast', selector: 'footer a', impact: 'serious', description: 'Low contrast' },

      // Critical issue on 1 page (unlabeled submit button in contact)
      { id: 'f4', pageStateId: 'state-3', type: 'a11y', ruleId: 'button-name', selector: 'form button[type=submit]', impact: 'critical', description: 'Missing button name' },

      // Minor issue on 2 pages (header logo duplicate role)
      { id: 'f5', pageStateId: 'state-1', type: 'a11y', ruleId: 'landmark-complementary-is-top-level', selector: 'header > img', impact: 'minor', description: 'Redundant landmark' },
      { id: 'f6', pageStateId: 'state-2', type: 'a11y', ruleId: 'landmark-complementary-is-top-level', selector: 'header > img', impact: 'minor', description: 'Redundant landmark' },
    ];

    const clusters = clusterFindings(mockFindings, mockPageStates, mockPageResults);

    expect(clusters.length).toBe(3);

    // Critical cluster should rank first even with fewer instances
    expect(clusters[0].ruleId).toBe('button-name');
    expect(clusters[0].impact).toBe('critical');
    expect(clusters[0].instanceCount).toBe(1);

    // Serious cluster ranks second with 3 instances across 3 pages
    expect(clusters[1].ruleId).toBe('color-contrast');
    expect(clusters[1].impact).toBe('serious');
    expect(clusters[1].instanceCount).toBe(3);
    expect(clusters[1].affectedPagesCount).toBe(3);

    // Minor cluster ranks third with 2 instances
    expect(clusters[2].ruleId).toBe('landmark-complementary-is-top-level');
    expect(clusters[2].impact).toBe('minor');
    expect(clusters[2].instanceCount).toBe(2);
    expect(clusters[2].affectedPagesCount).toBe(2);
  });
});

describe('Multi-Provider AI Remediation Dispatcher', () => {
  it('defines valid configurations and portal URLs for all 6 cloud AI providers', async () => {
    const { AI_PROVIDERS } = await import('../remediate');

    const expectedProviders = ['gemini', 'openai', 'anthropic', 'deepseek', 'grok', 'openrouter'] as const;
    for (const p of expectedProviders) {
      const conf = AI_PROVIDERS[p];
      expect(conf).toBeDefined();
      expect(conf.name).toBeTruthy();
      expect(conf.portalUrl.startsWith('https://')).toBe(true);
      expect(conf.defaultModel).toBeTruthy();
      expect(conf.models.length).toBeGreaterThan(0);
      expect(conf.models.some((m) => m.id === conf.defaultModel)).toBe(true);
    }
  });

  it('correctly dispatches OpenAI chat completions format', async () => {
    const { dispatchAIRequest } = await import('../remediate');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '<button>Save</button>\n\nExplanation: Added button text.' } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    const result = await dispatchAIRequest('openai', 'sk-test-123', 'gpt-4o', 'Fix this button', controller.signal);

    expect(result).toBe('<button>Save</button>\n\nExplanation: Added button text.');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test-123',
          'Content-Type': 'application/json',
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('correctly dispatches Anthropic Claude format with direct browser header', async () => {
    const { dispatchAIRequest } = await import('../remediate');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '<img alt="Logo" src="logo.png">\n\nExplanation: Added alt text.' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    const result = await dispatchAIRequest('anthropic', 'sk-ant-test', 'claude-3-7-sonnet-latest', 'Fix this img', controller.signal);

    expect(result).toBe('<img alt="Logo" src="logo.png">\n\nExplanation: Added alt text.');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        }),
      })
    );

    vi.unstubAllGlobals();
  });

  it('correctly dispatches Google Gemini generateContent format', async () => {
    const { dispatchAIRequest } = await import('../remediate');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '<html lang="en">\n\nExplanation: Added lang attribute.' }] } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const controller = new AbortController();
    const result = await dispatchAIRequest('gemini', 'AIzaSy-test', 'gemini-3.5-flash', 'Fix html', controller.signal);

    expect(result).toBe('<html lang="en">\n\nExplanation: Added lang attribute.');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=AIzaSy-test'),
      expect.objectContaining({
        method: 'POST',
      })
    );

    vi.unstubAllGlobals();
  });
});


