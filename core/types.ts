export type FindingImpact = "critical" | "serious" | "moderate" | "minor";

export interface FindingNode {
  target: string[];
  html: string;
  failureSummary?: string;
  screenshotData?: string;
}

export interface AxeViolationItem {
  id: string;
  impact: FindingImpact | null;
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: FindingNode[];
}

export interface SecurityFindingItem {
  type: "security";
  source: string;
  ruleId: string;
  category: string;
  impact: FindingImpact;
  cweId: string | null;
  description: string;
  helpUrl: string | null;
  requestHeaders: string | null;
  responseHeaders: string | null;
}

export interface SiteRecord {
  id?: string;
  url: string; // normalized base URL, e.g. "https://example.com"
  createdAt: Date;
}

export type FindingConfidence = 'certain' | 'likely' | 'needs-review';

export interface ScanRunRecord {
  id?: string;
  siteId: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: "running" | "completed" | "failed";
  pageCount: number;
  isAuthenticated: boolean;
  authCheckStatus?: string | null;
  a11yScore?: number;
  securityScore?: number;
  engineVersion?: string;
}

export interface PageResultRecord {
  id?: string;
  scanRunId: string;
  url: string;
  score: number;
  status: "completed" | "failed" | "auth-failed";
}

export interface PageStateRecord {
  id?: string;
  pageResultId: string;
  label: string; // e.g. "default", "disclosure: FAQ"
  triggerType?: string | null;
  triggerSelector?: string | null;
  status: string;
  score: number;
  createdAt: Date;
}

export interface FindingRecord {
  id?: string;
  pageStateId: string;
  type: "a11y" | "security";
  source: string; // "axe-core" | "custom-header-check" | "custom-cookie-check" | "custom-exposure-check"
  ruleId: string;
  category: string; // WCAG tag or OWASP Category
  impact: FindingImpact;
  confidence?: FindingConfidence;
  engineVersion?: string;
  rulesetVersion?: string;
  cweId?: string | null;
  selector?: string | null;
  html?: string | null;
  description: string;
  helpUrl?: string | null;
  requestHeaders?: string | null;
  responseHeaders?: string | null;
  screenshotUrl?: string | null;
  fingerprint: string;
  aiSuggestedFix?: string | null;
  createdAt: Date;
}

export interface AiCacheRecord {
  id?: string;
  hash: string; // sha256(ruleId + html) or sha256(ruleId + reqH + resH)
  fix: string;
  createdAt: Date;
}

export interface SettingRecord {
  key: string;
  value: any;
}
