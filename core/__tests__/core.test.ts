import { describe, it, expect } from 'vitest';
import {
  calculateStateScore,
  extractWcagCriterion,
  makeFingerprint,
  normaliseSiteUrl,
} from '../scoring';
import { computeFindingsDiff } from '../diff';
import { evaluateConformance, WCAG_2_2_CATALOG } from '../wcag';
import { evaluateOwaspConformance } from '../owasp';
import { checkSecurityHeaders } from '../securityScanner';
import type { FindingRecord } from '../types';

describe('Scoring & Normalization', () => {
  it('normalises site URLs correctly', () => {
    expect(normaliseSiteUrl('https://example.com/some/path?query=1#hash')).toBe(
      'https://example.com'
    );
    expect(normaliseSiteUrl('http://localhost:3000/dashboard')).toBe(
      'http://localhost:3000'
    );
  });

  it('extracts WCAG criterion tags', () => {
    expect(extractWcagCriterion(['cat.color', 'wcag2aa', 'wcag143'])).toBe(
      'wcag143'
    );
    expect(extractWcagCriterion(['cat.aria'])).toBe('unknown');
  });

  it('calculates score according to severity weights', () => {
    // 100 - (10*critical + 5*serious + 2*moderate + 1*minor)
    expect(calculateStateScore([])).toBe(100);
    expect(
      calculateStateScore([
        { impact: 'critical' }, // -10
        { impact: 'serious' },  // -5
        { impact: 'moderate' }, // -2
        { impact: 'minor' },    // -1
      ])
    ).toBe(82);

    // Caps at 0
    const manyCritical = Array(15).fill({ impact: 'critical' });
    expect(calculateStateScore(manyCritical)).toBe(0);
  });

  it('generates consistent fingerprints', async () => {
    const fp1 = await makeFingerprint(
      'https://example.com',
      'default',
      'color-contrast',
      '#main > button'
    );
    const fp2 = await makeFingerprint(
      'https://example.com',
      'default',
      'color-contrast',
      '#main > button'
    );
    const fp3 = await makeFingerprint(
      'https://example.com',
      'default',
      'image-alt',
      '#main > img'
    );

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1.length).toBe(64); // SHA-256 hex length
  });
});

describe('Diffing Algorithm', () => {
  it('correctly categorizes new, resolved, unchanged, and changed findings', () => {
    const baseFinding: Omit<FindingRecord, 'fingerprint' | 'impact'> = {
      id: '1',
      pageStateId: 's1',
      type: 'a11y',
      source: 'axe-core',
      ruleId: 'color-contrast',
      category: 'wcag143',
      description: 'Elements must have sufficient color contrast',
      createdAt: new Date(),
    };

    const previousFindings: FindingRecord[] = [
      {
        ...baseFinding,
        id: 'p1',
        fingerprint: 'fp-unchanged',
        impact: 'serious',
      },
      {
        ...baseFinding,
        id: 'p2',
        fingerprint: 'fp-resolved',
        impact: 'critical',
      },
      {
        ...baseFinding,
        id: 'p3',
        fingerprint: 'fp-changed',
        impact: 'moderate',
      },
    ];

    const currentFindings: FindingRecord[] = [
      {
        ...baseFinding,
        id: 'c1',
        fingerprint: 'fp-unchanged',
        impact: 'serious',
      },
      {
        ...baseFinding,
        id: 'c2',
        fingerprint: 'fp-new',
        impact: 'minor',
      },
      {
        ...baseFinding,
        id: 'c3',
        fingerprint: 'fp-changed',
        impact: 'serious', // impact changed from moderate to serious
      },
    ];

    const diff = computeFindingsDiff(currentFindings, previousFindings, 'run-prev');

    expect(diff.previousRunId).toBe('run-prev');
    expect(diff.new.map((f) => f.fingerprint)).toEqual(['fp-new']);
    expect(diff.resolved.map((f) => f.fingerprint)).toEqual(['fp-resolved']);
    expect(diff.unchanged.map((f) => f.fingerprint)).toEqual(['fp-unchanged']);
    expect(diff.changed.length).toBe(1);
    expect(diff.changed[0].current.fingerprint).toBe('fp-changed');
    expect(diff.changed[0].previous.impact).toBe('moderate');
    expect(diff.changed[0].current.impact).toBe('serious');
  });
});

describe('WCAG 2.2 Conformance', () => {
  it('includes core WCAG 2.2 criteria in catalog', () => {
    expect(WCAG_2_2_CATALOG.length).toBeGreaterThan(30);
    const contrast = WCAG_2_2_CATALOG.find((c) => c.id === '1.4.3');
    expect(contrast).toBeDefined();
    expect(contrast?.name).toBe('Contrast (Minimum)');
  });

  it('marks violated criterion as Does Not Support', () => {
    const findings = [
      { wcagCriterion: 'wcag143', ruleId: 'color-contrast', pageUrl: 'https://example.com' },
    ];
    const evaluations = evaluateConformance(findings, 1);
    const contrastEval = evaluations.find((e) => e.criterion.id === '1.4.3');

    expect(contrastEval?.status).toBe('Does Not Support');
    expect(contrastEval?.remarks).toContain('color-contrast');
  });
});

describe('Passive Security Checks', () => {
  it('detects missing security headers', () => {
    const emptyHeaders = new Headers();
    const findings = checkSecurityHeaders('https://example.com', emptyHeaders);

    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('missing-hsts');
    expect(ruleIds).toContain('missing-csp');
    expect(ruleIds).toContain('missing-xcto');
    expect(ruleIds).toContain('missing-clickjacking-protection');
  });

  it('passes when valid security headers are present', () => {
    const headers = new Headers({
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    });

    const findings = checkSecurityHeaders('https://example.com', headers);
    expect(findings.length).toBe(0);
  });

  it('maps missing-csp and missing-xcto to CWE-693 (Protection Mechanism Failure)', () => {
    const emptyHeaders = new Headers();
    const findings = checkSecurityHeaders('https://example.com', emptyHeaders);

    const csp = findings.find((f) => f.ruleId === 'missing-csp');
    const xcto = findings.find((f) => f.ruleId === 'missing-xcto');

    expect(csp?.cweId).toBe('CWE-693');
    expect(xcto?.cweId).toBe('CWE-693');
  });

  it('redacts cookie values in checkCookies', async () => {
    // Mock chrome.cookies API
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = {
      cookies: {
        getAll: async () => [
          {
            name: 'session_id',
            value: 'super_secret_session_token_12345',
            domain: 'example.com',
            path: '/',
            secure: false,
            httpOnly: false,
          },
        ],
      },
    };

    try {
      const { checkCookies } = await import('../securityScanner');
      const findings = await checkCookies('https://example.com');
      expect(findings.length).toBe(2); // missing secure + missing httponly
      for (const finding of findings) {
        expect(finding.responseHeaders).toBeDefined();
        expect(finding.responseHeaders).toContain('[REDACTED]');
        expect(finding.responseHeaders).not.toContain('super_secret_session_token_12345');
      }
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });
});

describe('URL Validation & Restricted Protocols', () => {
  it('blocks dangerous schemes, browser internal pages, and invalid URLs', async () => {
    const { isRestrictedUrl } = await import('../crawler');
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abcdef/sidepanel.html')).toBe(true);
    expect(isRestrictedUrl('edge://settings')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
    expect(isRestrictedUrl('javascript:alert(1)')).toBe(true);
    expect(isRestrictedUrl('data:text/html,<h1>Hello</h1>')).toBe(true);
    expect(isRestrictedUrl('file:///etc/passwd')).toBe(true);
    expect(isRestrictedUrl('')).toBe(true);
    expect(isRestrictedUrl('not-a-valid-url')).toBe(true);

    // Valid URLs
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl('http://localhost:3000/dashboard')).toBe(false);
    expect(isRestrictedUrl('https://sub.domain.org/path?q=1#hash')).toBe(false);
  });
});

describe('VPAT Conformance Standards & OWASP Mapping', () => {
  it('marks compliant criterion as Supports', () => {
    const evaluations = evaluateConformance([], 1);
    const contrastEval = evaluations.find((e) => e.criterion.id === '1.4.3');
    expect(contrastEval?.status).toBe('Supports');
  });

  it('evaluates OWASP Top 10 with exact security rule mapping', async () => {
    const { evaluateOwaspConformance } = await import('../owasp');
    const findings = [
      { category: 'Security Misconfiguration', ruleId: 'cookie-missing-secure', pageUrl: 'https://example.com' },
      { category: 'Security Misconfiguration', ruleId: 'missing-csp', pageUrl: 'https://example.com' },
    ];

    const evaluations = evaluateOwaspConformance(findings, 1);
    const a02 = evaluations.find((e) => e.category.id === 'A02:2021');
    const a05 = evaluations.find((e) => e.category.id === 'A05:2021');
    const a03 = evaluations.find((e) => e.category.id === 'A03:2021');

    expect(a02?.status).toBe('Does Not Support');
    expect(a05?.status).toBe('Does Not Support');
    expect(a03?.status).toBe('Not Evaluated');
  });
});

describe('Cross-Page Component Fingerprinting & Separated Scoring', () => {
  it('generates identical component fingerprint across different page URLs', async () => {
    const { makeComponentFingerprint } = await import('../scoring');
    const fp1 = await makeComponentFingerprint('color-contrast', 'button.cta');
    const fp2 = await makeComponentFingerprint('color-contrast', 'button.cta');
    const fpDiff = await makeComponentFingerprint('color-contrast', 'header.main');

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fpDiff);
  });

  it('calculates independent a11y and security scores', async () => {
    const { calculateSeparatedScores } = await import('../scoring');
    const findings: any[] = [
      { type: 'a11y', impact: 'critical' }, // -10 -> 90
      { type: 'security', impact: 'critical' }, // -10
      { type: 'security', impact: 'serious' }, // -5 -> 85
    ];

    const { a11yScore, securityScore } = calculateSeparatedScores(findings);
    expect(a11yScore).toBe(90);
    expect(securityScore).toBe(85);
  });
});


