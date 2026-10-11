# Privacy Policy — Accessibility & Security Auditor

*Effective Date: October 11, 2026*  
*Extension Version: 1.0.0*

This Privacy Policy explains how **Accessibility & Security Auditor** ("the Extension", "we", "us") handles information when you use our Chrome browser extension. We are committed to transparency and user privacy.

---

## 1. Core Principle: Local-First & Zero Tracking

Accessibility & Security Auditor is built as a **local-first developer tool**. 
- We **do not** collect, track, or sell your personal information.
- We **do not** collect your browsing history or track the websites you visit.
- We **do not** use Google Analytics, telemetry SDKs, or any third-party tracking scripts.
- We **do not** operate intermediary servers, proxies, or analytics databases.

All accessibility and security audits execute entirely within your local browser sandbox.

---

## 2. Information Handled by the Extension

### A. Webpage Content & Audit Findings
- **What is processed:** When you initiate an audit or crawl, the extension's content scripts inspect the Document Object Model (DOM) and CSS styles of the target page using the industry-standard `axe-core` accessibility engine.
- **Where it is stored:** All scan findings, audit scores, and compliance results are stored exclusively on your device in your browser's local **IndexedDB** database (managed via Dexie.js).
- **Retention:** Audit history remains on your local machine until you explicitly delete it in the extension UI or uninstall the extension.

### B. Security Headers & Cookie Metadata
- **Cookie Security:** The extension inspects whether cookies set by the audited origin include required `Secure` and `HttpOnly` security flags.
- **Strict Redaction:** Cookie names and sensitive values are **never stored or transmitted**. Values are strictly redacted (`[REDACTED]`) in memory. Only the boolean security flags are evaluated.
- **Passive HTTP Headers:** The extension inspects passive response headers (such as `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`) solely to compute the security audit score.

### C. Bring-Your-Own-Key (BYOK) AI Remediation (Optional)
- **API Keys:** If you choose to enable AI-powered code remediation, your API key (for Google Gemini, OpenAI, Anthropic Claude, DeepSeek, xAI Grok, or OpenRouter) is stored strictly in your browser's local `chrome.storage.local`. It is never sent to our servers.
- **Payload Redaction:** Before any code snippet is sent to an AI provider, the extension automatically scrubs inline scripts, comments, and strings to prevent accidental leakage of sensitive tokens.
- **Direct HTTPS Transmission:** API calls are made directly from your browser to the respective AI provider's official endpoint over encrypted HTTPS. Data processing by those providers is governed by their respective API privacy terms.

---

## 3. Chrome Permissions & Why They Are Needed

| Permission | Purpose & Privacy Boundary |
| :--- | :--- |
| `activeTab` | Grants temporary access to the active webpage when you click to scan, ensuring audits are user-initiated. |
| `tabs` | Reads the URL/title of the audited tab and manages background tabs during multi-page site crawls. |
| `scripting` | Dynamically injects the `axe-core` scanner and non-destructive element highlighter into the audited tab. |
| `storage` | Stores your local extension preferences, custom crawl configurations, and BYOK AI credentials locally. |
| `sidePanel` | Displays the auditor interface alongside the audited webpage without obscuring or modifying page layout. |
| `cookies` | Passively checks for `Secure` and `HttpOnly` flags. Values are strictly redacted in memory. |
| `<all_urls>` | Allows developers to audit any web page, including `localhost` development servers and staging domains. |

---

## 4. Third-Party Services

The Extension does not connect to any third-party services by default. The only external network requests occur when:
1. **You audit an external website:** The extension interacts with the target webpage requested by you.
2. **You use BYOK AI remediation:** The extension communicates directly with your chosen AI provider (Google, OpenAI, Anthropic, DeepSeek, xAI, or OpenRouter) using your private API key.

---

## 5. Data Deletion & User Control

You maintain complete control over your data:
- **Clear Audit History:** Click the "Clear History" button in the extension interface to instantly wipe all IndexedDB records.
- **Remove API Keys:** Remove or rotate your API keys at any time in the Extension Settings page.
- **Uninstalling:** Removing the extension from Chrome (`chrome://extensions`) immediately purges all extension storage, settings, and IndexedDB data from your browser.

---

## 6. Open Source Transparency

Accessibility & Security Auditor is an open-source project. You can inspect the source code, verify that no telemetry exists, and review all network requests on our GitHub repository.

---

## 7. Contact & Inquiries

For questions regarding this Privacy Policy, bug reports, or security disclosures, please open an issue on our GitHub repository or contact the project maintainers.
