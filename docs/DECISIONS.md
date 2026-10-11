# Architecture Decision Records (ADRs)

This document records the architectural and design decisions made for Accessibility & Security Auditor.

---

### ADR-001: Closed Shadow DOM for In-Page Element Highlighting
- **Context:** The in-page highlighter draws bounding boxes and badges on elements flagged for accessibility issues. Injecting nodes directly into `document.body` caused CSS conflicts with host page styles and risked DOM-based XSS if page attributes contained unescaped HTML.
- **Decision:** Encapsulate the entire highlight overlay inside a closed Shadow DOM (`attachShadow({ mode: 'closed' })`). All text and badges are populated strictly via `textContent` and `createTextNode`.
- **Consequence:** Host page CSS cannot alter the highlighter UI, scripts on the host page cannot access the overlay DOM, and style/script injection is prevented.

### ADR-002: Client-Side DOM & Input Sanitization
- **Context:** The side panel, ACR, and report views render page-derived strings (failing selectors, HTML snippets, and help URLs).
- **Decision:** Integrate DOMPurify for sanitizing any rendered markup, enforce strict protocol whitelisting (`http:` and `https:` only) on outgoing links, and render code snippets inside plain text `<code>` elements rather than raw HTML.
- **Consequence:** Eliminates privilege escalation into the extension origin.

### ADR-003: Opt-In Active Path Probing
- **Context:** Probing for sensitive endpoints (like `/.git/HEAD` or `/.env`) issues HTTP requests. In single-page applications (SPAs), catch-all routes return HTTP 200 for non-existent files, creating false positives and violating the extension's default passive posture.
- **Decision:** Keep active network probes disabled by default and require explicit user opt-in. Implement random-path soft-404 baseline detection and verify content signatures (e.g. `ref: refs/` or 40-char commit SHA for Git).
- **Consequence:** True passive auditing out of the box; zero soft-404 false positives on modern SPA frameworks.

### ADR-004: Principle of Least Privilege in Manifest V3
- **Context:** Early builds declared unused permissions like `webRequest` and `alarms`. Broad unnecessary permissions increase attack surface and risk store rejection.
- **Decision:** Remove `webRequest` and `alarms`. Rely on `activeTab` for user-driven single-tab audits and declare a strict Content Security Policy (`script-src 'self'; object-src 'none';`).
- **Consequence:** Minimal permission scope that adheres to modern browser security guidelines.

### ADR-005: Multi-Provider Cloud AI (BYOK) with Client-Side Redaction
- **Context:** Hardcoding a single AI provider or model limits developer choice and introduces maintenance issues as providers deprecate older model versions. Additionally, sending raw HTML snippets to cloud endpoints risks leaking sensitive tokens or triggering prompt injection.
- **Decision:**
  1. Build a unified client-side dispatcher supporting Google Gemini, OpenAI, Anthropic Claude, DeepSeek, xAI Grok, and OpenRouter.
  2. Implement dynamic model discovery querying official provider `/models` endpoints with the user's API key.
  3. Strip high-entropy tokens, JWTs, inline scripts, and authorization headers from code snippets prior to dispatch.
  4. Enforce a 30-second abort timeout and cache suggested fixes locally using SHA-256 hashes.
- **Consequence:** Future-proof multi-model support with zero intermediary server infrastructure and client-side privacy.

### ADR-006: Security Taxonomy Alignment with CWE-693
- **Context:** Initial mappings categorized missing CSP and missing X-Content-Type-Options under disparate CWEs.
- **Decision:** Map both findings to `CWE-693` (Protection Mechanism Failure), matching standard MITRE classification.
- **Consequence:** Standardized taxonomy compatible with enterprise vulnerability tracking tools.

### ADR-007: Local IndexedDB Persistence with Dexie Migrations
- **Context:** Complex relational audit data (scans, pages, states, findings) requires local querying without hitting remote databases.
- **Decision:** Use Dexie.js with versioned schema migrations (`version(1)` and `version(2)`). Separate `a11yScore` and `securityScore` to avoid conflating accessibility defects with HTTP transport misconfigurations.
- **Consequence:** Fast local querying, full offline capability, zero telemetry, and smooth schema upgrades.

### ADR-008: ITI VPAT 2.5 Terminology for Conformance Reporting
- **Context:** Conformance reports previously used custom non-standard status phrases.
- **Decision:** Adopt official ITI VPAT 2.5 terms: `Supports`, `Partially Supports`, `Does Not Support`, and `Not Evaluated`. Automated tests only mark criteria they directly evaluate, explicitly reserving manual-only checks as `Not Evaluated`.
- **Consequence:** Generates credible, procurement-ready Accessibility Conformance Reports.

### ADR-009: URL-Independent Component Fingerprinting
- **Context:** Identical template components (e.g., a shared footer link with poor contrast) across 50 crawled pages previously produced 50 distinct findings because the page URL was part of the fingerprint.
- **Decision:** Implement `makeComponentFingerprint(ruleId, selector)` to compute a deterministic hash based strictly on the rule and element selector.
- **Consequence:** Enables root-cause clustering in the UI ("Top Fixes"), allowing teams to fix one component template and resolve dozens of duplicate errors.

### ADR-010: Accessible UI and Multi-Format Ticket Exports
- **Context:** As an accessibility tool, the extension UI must practice what it preaches, and developers need frictionless ways to transfer findings into issue trackers.
- **Decision:** Implement full ARIA tab semantics, `aria-live` announcement regions, `prefers-reduced-motion` compliance, and one-click copy buttons for Markdown, Playwright locators, and Jira formatting.
- **Consequence:** High UI accessibility standards and immediate integration into developer workflows.
