# Scoring & Confidence Methodology

The **Accessibility & Security Auditor** uses deterministic, transparent, and reproducible scoring algorithms to quantify both digital accessibility conformance (WCAG 2.2) and passive web security posture (OWASP Top 10).

---

## 1. Score Calculation Formula

Every audited page, interactive state, and scan run computes scores on a normalized **0 to 100 integer scale**, where **100** indicates zero detected automated violations and **0** indicates severe accumulated defects.

### Penalty Weights by Impact Severity

| Impact | Penalty Deducted | Description | Example |
| :--- | :---: | :--- | :--- |
| **`critical`** | **10 points** | Completely blocks access for users with assistive technologies, or presents an immediate exploitable security exposure. | Missing button accessible name, missing document `<title>`, exposed `.env` file |
| **`serious`** | **5 points** | Causes significant barriers or difficulty, or leaves security transport unhardened. | Missing image `alt`, invalid form label association, missing HSTS header |
| **`moderate`** | **2 points** | Causes friction or sub-optimal user experience, or lacks defense-in-depth protections. | Low color contrast on non-critical text, missing CSP header |
| **`minor`** | **1 point** | Technical standard violation with minor practical accessibility impact. | Duplicate attribute token, missing `X-Content-Type-Options: nosniff` |

### Mathematical Formula

$$\text{Score} = \max\left(0, 100 - \sum (c \times 10 + s \times 5 + m \times 2 + n \times 1)\right)$$

Where:
- $c$ = count of `critical` violations
- $s$ = count of `serious` violations
- $m$ = count of `moderate` violations
- $n$ = count of `minor` violations

If total penalties exceed 100, the score is strictly clamped to `0`.

---

## 2. Independent vs. Separated Scoring

Older tools combine accessibility and security into a single confusing score. This extension provides **independent, uncoupled scores** via `calculateSeparatedScores()`:

1. **Accessibility Score (0–100):** Computed **exclusively** on axe-core accessibility violations (`type === 'a11y'`).
2. **Security Score (0–100):** Computed **exclusively** on security header, cookie, and exposure findings (`type === 'security'`).
3. **Composite Page Score:** Minimum state score across default and interactive states for single-page triage.

---

## 3. Confidence Classification

Automated tooling must distinguish between definitive bugs and items requiring manual human judgment. Findings are classified into three confidence tiers:

### 1. `certain` (Deterministic)
- **Condition:** Findings where the DOM element or HTTP response unambiguously breaches a measurable specification.
- **Examples:** An `<input type="text">` with no label, aria-label, or title; an HTTP response with no `Strict-Transport-Security` header.
- **Scoring Impact:** Fully factored into automated score deduction.

### 2. `likely` (High Probability)
- **Condition:** Heuristic checks with near-zero false-positive rates.
- **Scoring Impact:** Fully factored into automated score deduction.

### 3. `needs-review` (Axe Incomplete)
- **Condition:** axe-core could not reliably determine whether the requirement was satisfied or violated without human inspection.
- **Examples:** Color contrast against complex CSS background gradients or background images; audio elements without track elements where audio might only be atmospheric.
- **Scoring Impact:** **Zero penalty deduction.** Items are presented with a yellow `Needs Review` badge to alert manual QA teams without falsely penalizing automated scores.

---

## 4. VPAT 2.5 & Section 508 Conformance Standards

When generating Accessibility Conformance Reports (ACR / VPAT), findings map to official ITI VPAT 2.5 terminology:

| Conformance Term | Criteria Definition in Auditor |
| :--- | :--- |
| **`Supports`** | Zero automated violations detected for this criterion across all audited pages and states. |
| **`Partially Supports`** | Violations detected, but none are categorized as `critical`. |
| **`Does Not Support`** | One or more `critical` violations detected for this criterion. |
| **`Not Evaluated`** | Criteria not auditable via client-side automation (e.g. WCAG 1.2.4 Live Captions). |

---

## 5. Automated Testing Coverage & Industry Honesty

> **Critical Disclaimer for QA and Compliance Teams:**
> Automated accessibility testing tools (including axe-core) can reliably test approximately **30% to 40%** of WCAG 2.2 Level A/AA criteria.
> 
> A score of **100/100** means **zero automated defects were detected** under the active ruleset. It **does NOT** guarantee legal compliance or barrier-free usability for people with disabilities. Full conformance requires manual testing with screen readers (NVDA, JAWS, VoiceOver), keyboard-only navigation verification, and cognitive walkthroughs.
