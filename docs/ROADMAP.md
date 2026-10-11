# Project Roadmap

This document outlines current capabilities and future development priorities for Accessibility & Security Auditor.

---

## Current Release: v1.0.0

- [x] **Axe-core Engine:** Pinned `axe-core 4.10.2` executing against WCAG 2.2 Level A/AA criteria.
- [x] **Passive Security Audit:** Automated inspection of HSTS, CSP, X-Content-Type-Options, clickjacking mitigation, and cookie security flags (`Secure`, `HttpOnly`).
- [x] **Interactive State Discovery:** Dynamic auditing of expandable components (`aria-expanded`, `<details>`) with state restoration.
- [x] **In-Page Highlighter:** Closed Shadow DOM visual overlay with element inspection and direct jump-to-element.
- [x] **Multi-Page Crawler:** Same-origin BFS crawl with depth limits, `robots.txt` honoring, and live cancellation.
- [x] **Root Cause Clustering:** "Top Fixes" view grouping duplicate template issues by selector pattern.
- [x] **Multi-Provider Cloud AI:** Client-side BYOK remediation supporting Gemini, OpenAI, Claude, DeepSeek, Grok, and OpenRouter with automatic token sanitization.
- [x] **Conformance Reporting:** Exportable WCAG 2.2 / VPAT 2.5 and OWASP Top 10 reports with print-to-PDF formatting.
- [x] **Local-First Privacy:** Zero remote telemetry; all historical data persists locally in IndexedDB.

---

## Planned Milestones

### v1.1 — Enhanced Manual Assistance & Visual Audits
- [ ] **Keyboard Navigation Flow:** Visual focus path inspection highlighting tab order and detecting focus traps.
- [ ] **Touch Target Size Overlay:** Interactive heatmap verifying WCAG 2.5.8 target size requirements (minimum 24×24 CSS pixels).
- [ ] **Color Contrast Simulator:** Client-side SVG filters simulating common vision deficiencies (protanopia, deuteranopia, tritanopia, achromatopsia).
- [ ] **Baseline Regression Tracking:** Mark issues as `suppressed`, `in-progress`, or `fixed` across recurring crawl runs.

### v1.2 — Developer Tools & CI Integration
- [ ] **SARIF 2.1.0 Export:** Output findings in standard SARIF format for GitHub Code Scanning and GitLab SAST ingestion.
- [ ] **Custom Ruleset Presets:** Save and export custom auditing profiles (e.g. strict WCAG AAA color contrast, custom header requirements).
- [ ] **Standalone CLI Runner:** Headless audit CLI sharing core logic for integration into GitHub Actions and local Git pre-commit hooks.

### v2.0 — Ecosystem & Cross-Browser Support
- [ ] **Firefox Add-On Support:** Verified package targeting Mozilla Firefox via WXT's multi-browser build system.
- [ ] **Accessibility Statement Generator:** One-click template generator producing W3C-compliant accessibility statements in Markdown and HTML.
- [ ] **Custom Community Rule Packs:** Declarative schema allowing teams to define internal company-specific accessibility or security lint rules.
