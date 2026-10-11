# Permissions Justification — Accessibility & Security Auditor

This document provides granular justification for every permission declared in `wxt.config.ts` (Manifest V3), adhering to Google Chrome Web Store's Principle of Least Privilege and single-purpose policy.

---

## Declared Permissions

### 1. `activeTab`
- **Purpose:** Grants temporary host access to the currently active tab when the user initiates an audit action.
- **Usage:** Allows the extension to interact with the target page DOM and capture current tab state with minimal privilege escalation.
- **Alternatives Considered:** Broad host permissions alone without `activeTab` violate modern least-privilege standards; pairing `activeTab` ensures user-initiated intent is respected.

### 2. `tabs`
- **Purpose:** Querying active tab properties (URL, title, ID) to orchestrate single-page scans and multi-page crawler navigation.
- **Usage:**
  - `chrome.tabs.query({ active: true, currentWindow: true })` — identifies the active target tab in the side panel.
  - `chrome.tabs.create` / `chrome.tabs.remove` — spawns temporary background tabs during breadth-first site crawls without disrupting the user's active viewport.
  - `chrome.tabs.sendMessage` — sends audit instructions (`RUN_AXE_SCAN`, `TEST_TRIGGER`, `HIGHLIGHT_ELEMENT`) to the tab content script.
- **Alternatives Considered:** `activeTab` alone cannot orchestrate multi-page site crawls because it cannot open, inspect, or manage background child tabs.

### 3. `scripting`
- **Purpose:** Programmatically injecting content scripts and style assets into inspected tabs on-demand.
- **Usage:** `chrome.scripting.executeScript` ensures the axe-core scanner and interaction drivers are loaded in tabs visited during single audits or BFS site crawls.
- **Alternatives Considered:** Statically injecting content scripts on `<all_urls>` into every tab at all times introduces memory overhead; dynamic scripting allows on-demand execution.

### 4. `storage`
- **Purpose:** Persisting user-configured extension preferences locally.
- **Usage:**
  - `chrome.storage.local` stores the user's Gemini API key (BYOK), selected AI model, and custom scan configurations.
  - Note: All scan history, site records, and findings are stored locally in IndexedDB via Dexie.js for complex querying and relational integrity.
- **Data Boundary:** No storage data is synchronized to remote servers. All data remains local on the user's device.

### 5. `sidePanel`
- **Purpose:** Displaying the auditor UI in Chrome's dedicated side panel.
- **Usage:** Allows auditors and developers to keep the audit controls, findings list, and remediation guidance side-by-side with the webpage being tested without overlaying or obscuring inspected elements.
- **Alternatives Considered:** Traditional browser popups close immediately upon clicking or interacting with the underlying web page, making interactive inspection impossible.

### 6. `cookies`
- **Purpose:** Auditing cookie security posture for the current origin.
- **Usage:** Checks whether session and tracking cookies transmitted over HTTPS have the `Secure` flag and whether sensitive cookies have the `HttpOnly` flag to prevent unauthorized client-side JavaScript access.
- **Privacy Guarantee:** Actual cookie values are NEVER stored or transmitted. The scanner explicitly redacts values (`[REDACTED]`) and only inspects the security metadata flags (`secure`, `httpOnly`, `domain`, `path`).

---

## Host Permissions

### `<all_urls>`
- **Purpose:** Allows web developers, QA teams, and accessibility consultants to audit any website, including local development servers (`http://localhost:*`), staging environments (`https://*.staging.internal`), and public web applications.
- **Justification:** An accessibility and web security scanner is a general-purpose developer tool. Restricting to a static domain list would render the tool unusable for developers testing arbitrary sites or staging URLs.

---

## Removed Permissions

The following permissions were present in early prototypes and were removed in accordance with the Principle of Least Privilege:
- **`webRequest`:** Removed because passive header evaluation does not require blocking network requests.
- **`alarms`:** Removed in favor of direct lifecycle coordination.
