import type { AxeViolationItem } from './types';
import type { InteractiveTrigger } from './interactive';

// ── Discriminated Request Messages ──────────────────────────────────────────

export type ExtensionRequest =
  | { type: 'RUN_AXE_SCAN'; tags?: string[] }
  | { type: 'DISCOVER_TRIGGERS'; limit?: number }
  | { type: 'TEST_TRIGGER'; trigger: InteractiveTrigger }
  | { type: 'HIGHLIGHT_ELEMENT'; selector: string; ruleId: string; helpText: string }
  | { type: 'CLEAR_HIGHLIGHT' }
  | { type: 'EXTRACT_LINKS' };

// ── Response Shapes ─────────────────────────────────────────────────────────

export interface AxeScanResponse {
  success: boolean;
  url: string;
  violations: AxeViolationItem[];
  incomplete: AxeViolationItem[];
  passesCount: number;
  inapplicableCount: number;
  error?: string;
}

export interface DiscoverTriggersResponse {
  success: boolean;
  triggers: InteractiveTrigger[];
  error?: string;
}

export interface TestTriggerResponse {
  success: boolean;
  status: string;
  violations: AxeViolationItem[];
  error?: string;
}

export interface HighlightResponse {
  success: boolean;
  error?: string;
}

export interface ClearHighlightResponse {
  success: boolean;
  error?: string;
}

export interface ExtractLinksResponse {
  success: boolean;
  links: string[];
  error?: string;
}

// ── Type-Safe Message Dispatch Helper ───────────────────────────────────────

export async function sendTabMessage<T = any>(
  tabId: number,
  message: ExtensionRequest
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}
