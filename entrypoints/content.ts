import axe from 'axe-core';
import {
  discoverInteractiveTriggers,
  triggerInteractiveElement,
  restoreInteractiveElement,
  type InteractiveTrigger,
} from '@/core/interactive';
import { highlightElement, clearHighlight } from '@/core/inPageHighlighter';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('[Accessibility Auditor] Content script initialized.');

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Security: verify that the message originated from our own extension runtime
      if (sender.id && sender.id !== chrome.runtime.id) {
        console.warn('[Accessibility Auditor] Rejected message from unauthorized sender:', sender.id);
        return false;
      }

      // Security: validate basic message shape
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return false;
      }

      (async () => {
        try {
          switch (message.type) {
            case 'RUN_AXE_SCAN': {
              const scanTags = (Array.isArray(message.tags) && message.tags.length > 0)
                ? message.tags
                : ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

              const axeResult = await axe.run(document, {
                runOnly: {
                  type: 'tag',
                  values: scanTags,
                },
              });

              sendResponse({
                success: true,
                url: window.location.href,
                violations: axeResult.violations,
                incomplete: axeResult.incomplete,
                passesCount: axeResult.passes.length,
                inapplicableCount: axeResult.inapplicable.length,
              });
              break;
            }

            case 'DISCOVER_TRIGGERS': {
              const triggers = discoverInteractiveTriggers(message.limit || 5);
              sendResponse({ success: true, triggers });
              break;
            }

            case 'TEST_TRIGGER': {
              const trigger = message.trigger as InteractiveTrigger;
              const triggered = await triggerInteractiveElement(trigger);

              if (!triggered) {
                sendResponse({
                  success: false,
                  status: 'trigger-not-found',
                  violations: [],
                });
                return;
              }

              let triggerViolations: any[] = [];
              try {
                const scanTags = (Array.isArray(message.tags) && message.tags.length > 0)
                  ? message.tags
                  : ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

                const axeResult = await axe.run(document, {
                  runOnly: {
                    type: 'tag',
                    values: scanTags,
                  },
                });
                triggerViolations = axeResult.violations;
              } finally {
                // Restore page state so subsequent triggers are tested on a clean DOM
                await restoreInteractiveElement(trigger);
              }

              sendResponse({
                success: true,
                status: 'completed',
                violations: triggerViolations,
              });
              break;
            }

            case 'HIGHLIGHT_ELEMENT': {
              const success = highlightElement(
                message.selector,
                message.ruleId || 'Violation',
                message.helpText || ''
              );
              sendResponse({ success });
              break;
            }

            case 'CLEAR_HIGHLIGHT': {
              clearHighlight();
              sendResponse({ success: true });
              break;
            }

            case 'EXTRACT_LINKS': {
              const origin = window.location.origin;
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              const links: string[] = [];

              for (const a of anchors) {
                try {
                  const href = (a as HTMLAnchorElement).href;
                  const u = new URL(href);
                  if (u.origin === origin && u.protocol.startsWith('http')) {
                    u.hash = '';
                    let clean = u.toString();
                    if (clean.endsWith('/')) clean = clean.slice(0, -1);

                    const lowerPath = u.pathname.toLowerCase();
                    if (
                      !lowerPath.includes('logout') &&
                      !lowerPath.includes('signout') &&
                      !lowerPath.includes('sign-out') &&
                      !lowerPath.includes('log-out')
                    ) {
                      links.push(clean);
                    }
                  }
                } catch {
                  // Ignore invalid URL
                }
              }

              sendResponse({ success: true, links: Array.from(new Set(links)) });
              break;
            }

            default:
              sendResponse({ error: `Unknown message type: ${message.type}` });
          }
        } catch (err: any) {
          console.error('[Accessibility Auditor] Error processing message:', err);
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();

      return true; // Keep message channel open for async response
    });
  },
});
