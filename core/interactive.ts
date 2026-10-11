export type TriggerType = 'disclosure' | 'haspopup' | 'tab';

export interface InteractiveTrigger {
  type: TriggerType;
  selector: string;
  label: string;
}

export function getCssPath(el: Element): string {
  if (!(el instanceof Element)) return '';
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();
    if (current.id) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // IDs are unique, can stop
    } else {
      let sibling: Element | null = current;
      let nth = 1;
      while ((sibling = sibling.previousElementSibling as Element | null) !== null) {
        if (sibling.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1 || (current.nextElementSibling && current.nextElementSibling.nodeName.toLowerCase() === selector)) {
        selector += `:nth-of-type(${nth})`;
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

export function discoverInteractiveTriggers(limit: number = 5): InteractiveTrigger[] {
  const found: InteractiveTrigger[] = [];

  // 1. [aria-expanded="false"]
  const expanded = document.querySelectorAll('[aria-expanded="false"]');
  for (const el of Array.from(expanded)) {
    if (found.length >= limit) break;
    found.push({
      type: 'disclosure',
      selector: getCssPath(el),
      label: `disclosure: ${(el.textContent || '').trim().substring(0, 20)}`,
    });
  }

  // 2. [aria-haspopup]
  const haspopup = document.querySelectorAll('[aria-haspopup]:not([aria-expanded])');
  for (const el of Array.from(haspopup)) {
    if (found.length >= limit) break;
    found.push({
      type: 'haspopup',
      selector: getCssPath(el),
      label: `popup: ${(el.textContent || '').trim().substring(0, 20)}`,
    });
  }

  // 3. [role="tab"]
  const tabs = document.querySelectorAll('[role="tab"]');
  for (const el of Array.from(tabs)) {
    if (found.length >= limit) break;
    if (el.getAttribute('aria-selected') !== 'true') {
      found.push({
        type: 'tab',
        selector: getCssPath(el),
        label: `tab: ${(el.textContent || '').trim().substring(0, 20)}`,
      });
    }
  }

  return found;
}

export async function triggerInteractiveElement(trigger: InteractiveTrigger): Promise<boolean> {
  const el = document.querySelector(trigger.selector) as HTMLElement | null;
  if (!el) return false;

  try {
    el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    el.click();

    // Wait for DOM changes / transition
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  } catch (err) {
    console.error(`Failed to trigger element ${trigger.selector}:`, err);
    return false;
  }
}

/**
 * Attempts to restore the DOM to its pre-triggered state.
 * For disclosures (aria-expanded), re-clicks to collapse if still open.
 * For popups and menus, sends an Escape key event or clicks outside.
 */
export async function restoreInteractiveElement(trigger: InteractiveTrigger): Promise<boolean> {
  const el = document.querySelector(trigger.selector) as HTMLElement | null;
  if (!el) return false;

  try {
    if (trigger.type === 'disclosure') {
      if (el.getAttribute('aria-expanded') === 'true') {
        el.click();
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    } else if (trigger.type === 'haspopup') {
      // Dispatch Escape key to dismiss modals/menus
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return true;
  } catch (err) {
    console.warn(`Failed to restore element ${trigger.selector}:`, err);
    return false;
  }
}
