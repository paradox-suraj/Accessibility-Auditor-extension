import type { SecurityFindingItem, FindingImpact } from './types';

function serializeHeaders(headers: Headers): string {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return JSON.stringify(obj, null, 2);
}

export function checkSecurityHeaders(url: string, headers: Headers): SecurityFindingItem[] {
  const findings: SecurityFindingItem[] = [];
  const resHeadersStr = serializeHeaders(headers);

  // Strict-Transport-Security (HSTS)
  if (url.startsWith('https://')) {
    const hsts = headers.get('strict-transport-security');
    if (!hsts) {
      findings.push({
        type: 'security',
        source: 'custom-header-check',
        ruleId: 'missing-hsts',
        category: 'Security Misconfiguration',
        impact: 'serious',
        cweId: 'CWE-319',
        description: 'Missing Strict-Transport-Security (HSTS) header. This leaves the site vulnerable to man-in-the-middle downgrade attacks.',
        helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
        requestHeaders: null,
        responseHeaders: resHeadersStr,
      });
    }
  }

  // Content-Security-Policy (CSP)
  const csp = headers.get('content-security-policy');
  if (!csp) {
    findings.push({
      type: 'security',
      source: 'custom-header-check',
      ruleId: 'missing-csp',
      category: 'Security Misconfiguration',
      impact: 'moderate',
      cweId: 'CWE-693',
      description: 'Missing Content-Security-Policy header. CSP helps prevent XSS and data injection attacks by restricting resource origins.',
      helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
      requestHeaders: null,
      responseHeaders: resHeadersStr,
    });
  }

  // X-Content-Type-Options
  const xcto = headers.get('x-content-type-options');
  if (!xcto || xcto.toLowerCase() !== 'nosniff') {
    findings.push({
      type: 'security',
      source: 'custom-header-check',
      ruleId: 'missing-xcto',
      category: 'Security Misconfiguration',
      impact: 'minor',
      cweId: 'CWE-693',
      description: "Missing or invalid X-Content-Type-Options header. It should be set to 'nosniff' to prevent MIME-sniffing attacks.",
      helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
      requestHeaders: null,
      responseHeaders: resHeadersStr,
    });
  }

  // X-Frame-Options or CSP frame-ancestors
  const xfo = headers.get('x-frame-options');
  const hasFrameAncestors = csp && csp.includes('frame-ancestors');
  if (!xfo && !hasFrameAncestors) {
    findings.push({
      type: 'security',
      source: 'custom-header-check',
      ruleId: 'missing-clickjacking-protection',
      category: 'Security Misconfiguration',
      impact: 'moderate',
      cweId: 'CWE-1021',
      description: 'Missing X-Frame-Options or CSP frame-ancestors directive. This leaves the site vulnerable to clickjacking attacks.',
      helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
      requestHeaders: null,
      responseHeaders: resHeadersStr,
    });
  }

  return findings;
}

export async function checkCookies(url: string): Promise<SecurityFindingItem[]> {
  const findings: SecurityFindingItem[] = [];
  if (typeof chrome === 'undefined' || !chrome.cookies) {
    return findings;
  }

  try {
    const isHttps = url.startsWith('https://');
    const cookies = await chrome.cookies.getAll({ url });

    for (const cookie of cookies) {
      if (isHttps && !cookie.secure) {
        findings.push({
          type: 'security',
          source: 'custom-cookie-check',
          ruleId: 'cookie-missing-secure',
          category: 'Security Misconfiguration',
          impact: 'serious',
          cweId: 'CWE-614',
          description: `Cookie '${cookie.name}' is missing the 'Secure' flag, meaning it could be transmitted over unencrypted HTTP connections.`,
          helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie',
          requestHeaders: null,
          responseHeaders: JSON.stringify({ cookie: `${cookie.name}=[REDACTED]`, domain: cookie.domain, path: cookie.path, secure: cookie.secure, httpOnly: cookie.httpOnly }, null, 2),
        });
      }

      if (!cookie.httpOnly) {
        findings.push({
          type: 'security',
          source: 'custom-cookie-check',
          ruleId: 'cookie-missing-httponly',
          category: 'Security Misconfiguration',
          impact: 'moderate',
          cweId: 'CWE-1004',
          description: `Cookie '${cookie.name}' is missing the 'HttpOnly' flag, meaning it can be accessed via client-side JavaScript (vulnerable to XSS extraction).`,
          helpUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie',
          requestHeaders: null,
          responseHeaders: JSON.stringify({ cookie: `${cookie.name}=[REDACTED]`, domain: cookie.domain, path: cookie.path, secure: cookie.secure, httpOnly: cookie.httpOnly }, null, 2),
        });
      }
    }
  } catch (err) {
    console.error('Error checking cookies:', err);
  }

  return findings;
}

/**
 * ACTIVE check — opt-in only.
 *
 * Probes for commonly exposed sensitive paths (.git/HEAD, .env).
 * These requests appear in the server's access logs, so this is NOT a passive
 * check.  It only runs when the caller explicitly enables active checks.
 *
 * False-positive mitigation:
 *  1. A random-path baseline request is made first.  If the server returns 200
 *     for a nonsense path (soft-404 / SPA catch-all), all path probes are
 *     skipped.
 *  2. For .git/HEAD we validate that the response body starts with "ref: " or
 *     a 40-char hex SHA — anything else is treated as a false positive.
 *  3. Secret values are NEVER stored or logged — only the HTTP status matters.
 */
export async function checkExposedPaths(baseUrl: string): Promise<SecurityFindingItem[]> {
  const findings: SecurityFindingItem[] = [];

  try {
    const origin = new URL(baseUrl).origin;

    // ── Baseline: probe a random path to detect soft-404s ────────────────────
    const randomPath = `/__a11y_auditor_probe_${Math.random().toString(36).slice(2)}/`;
    try {
      const baselineRes = await fetch(`${origin}${randomPath}`, {
        method: 'HEAD',
        redirect: 'manual',
      });
      if (baselineRes.status === 200) {
        // Server returns 200 for anything → probes would be meaningless
        console.log('[SecurityScanner] Soft-404 detected, skipping active path probes.');
        return [];
      }
    } catch {
      // Network error on baseline probe — proceed cautiously
    }

    // ── Path probe definitions ────────────────────────────────────────────────
    const paths: Array<{
      path: string;
      ruleId: string;
      cweId: string;
      impact: FindingImpact;
      desc: string;
      /** Optional: validate response body to reduce false positives */
      validateBody?: (body: string) => boolean;
    }> = [
      {
        path: '.git/HEAD',
        ruleId: 'exposed-git',
        cweId: 'CWE-538',
        impact: 'critical',
        desc: 'Exposed .git repository detected. An attacker can reconstruct source code, commit history, and any secrets committed to the repository.',
        validateBody: (body) => {
          const trimmed = body.trim();
          // Valid git HEAD starts with "ref: " or a 40-char hex SHA
          return trimmed.startsWith('ref: ') || /^[0-9a-f]{40}$/i.test(trimmed.substring(0, 40));
        },
      },
      {
        path: '.env',
        ruleId: 'exposed-env',
        cweId: 'CWE-538',
        impact: 'critical',
        desc: 'Exposed .env file detected. This file typically contains critical secrets such as API keys, database credentials, and private tokens. Values are NOT displayed — rotate all secrets immediately.',
      },
    ];

    for (const probe of paths) {
      try {
        const targetUrl = `${origin}/${probe.path}`;
        // Use GET so we can read the body for content validation
        const res = await fetch(targetUrl, { redirect: 'manual' });

        if (res.status !== 200) continue;

        // Content validation (if defined)
        if (probe.validateBody) {
          const body = await res.text();
          if (!probe.validateBody(body)) continue;
          // Do NOT store the body — it may contain secret values
        }

        findings.push({
          type: 'security',
          source: 'custom-exposure-check',
          ruleId: probe.ruleId,
          category: 'Security Misconfiguration',
          impact: probe.impact,
          cweId: probe.cweId,
          description: probe.desc,
          helpUrl: 'https://cwe.mitre.org/data/definitions/538.html',
          requestHeaders: `GET /${probe.path} HTTP/1.1\nHost: ${new URL(origin).host}`,
          // Only store the status — NEVER store response body which may contain secrets
          responseHeaders: JSON.stringify({ status: res.status, statusText: res.statusText }),
        });
      } catch {
        // Network or CORS error — safely skip
      }
    }
  } catch {
    // Invalid base URL
  }

  return findings;
}

export async function scanPassiveSecurity(
  url: string,
  options: { allowActiveChecks?: boolean } = {}
): Promise<SecurityFindingItem[]> {
  try {
    // Refuse scanning internal browser URLs
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
      return [];
    }

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    const headerFindings = checkSecurityHeaders(url, res.headers);
    const cookieFindings = await checkCookies(url);

    let pathFindings: SecurityFindingItem[] = [];
    if (options.allowActiveChecks) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
          pathFindings = await checkExposedPaths(url);
        }
      } catch {}
    }

    return [...headerFindings, ...cookieFindings, ...pathFindings];
  } catch (err) {
    console.error(`Passive security scan error on ${url}:`, err);
    return [];
  }
}
