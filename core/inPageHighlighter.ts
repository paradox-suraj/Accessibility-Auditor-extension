// ── Security: The overlay lives inside a *closed* Shadow DOM attached to a
// dedicated host element.  This means:
//  1. Page CSS cannot accidentally restyle the overlay.
//  2. Page JS cannot reach in via document.getElementById / querySelector.
//  3. All user-visible text is set via textContent (never innerHTML) so
//     page-derived strings (ruleId, helpText) cannot cause XSS even if a
//     malicious page injects payloads into its own ARIA attributes / DOM.

const HOST_ID = 'a11y-auditor-highlight-host';

/** Retrieve (or lazily create) the host element and its closed shadow root. */
function getOrCreateShadowHost(): ShadowRoot {
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    // The host itself is invisible and non-interactive
    host.style.cssText =
      'all:unset;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    // Stash the shadow root on the element so clearHighlight can reach it
    (host as any).__shadow = shadow;
    return shadow;
  }
  return (host as any).__shadow as ShadowRoot;
}

export function highlightElement(selector: string, ruleId: string, helpText: string): boolean {
  try {
    const el = document.querySelector(selector);
    if (!el) {
      console.warn(`[Highlighter] Element not found for selector: ${selector}`);
      return false;
    }

    clearHighlight();

    const rect = el.getBoundingClientRect();
    const shadow = getOrCreateShadowHost();

    // ── Overlay box ──────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.setAttribute('data-a11y-overlay', 'true');
    overlay.style.cssText = [
      'position:fixed',
      `top:${rect.top}px`,
      `left:${rect.left}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'border:3px solid #ef4444',
      'background:rgba(239,68,68,0.15)',
      'border-radius:4px',
      'box-shadow:0 0 15px rgba(239,68,68,0.6)',
      'transition:top .15s,left .15s,width .15s,height .15s',
      'pointer-events:none',
      'box-sizing:border-box',
    ].join(';');

    // ── Badge / tooltip ──────────────────────────────────────────────────────
    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute',
      'bottom:100%',
      'left:0',
      'margin-bottom:6px',
      'background:#1f2937',
      'color:#fff',
      'font:600 12px/1.4 system-ui,sans-serif',
      'padding:4px 8px',
      'border-radius:4px',
      'white-space:nowrap',
      'pointer-events:auto',
      'box-shadow:0 2px 8px rgba(0,0,0,.3)',
      'max-width:320px',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';');

    // ── textContent ONLY — NEVER innerHTML with page-derived strings ─────────
    const strong = document.createElement('strong');
    strong.textContent = String(ruleId).substring(0, 80);
    const sep = document.createTextNode(': ');
    const desc = document.createTextNode(String(helpText).substring(0, 120));

    badge.appendChild(strong);
    badge.appendChild(sep);
    badge.appendChild(desc);
    overlay.appendChild(badge);
    shadow.appendChild(overlay);

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // ── Reposition on scroll / resize ────────────────────────────────────────
    const updatePosition = () => {
      const liveOverlay = shadow.querySelector('[data-a11y-overlay]') as HTMLElement | null;
      if (!liveOverlay) {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
        return;
      }
      const r = el.getBoundingClientRect();
      liveOverlay.style.top = `${r.top}px`;
      liveOverlay.style.left = `${r.left}px`;
      liveOverlay.style.width = `${r.width}px`;
      liveOverlay.style.height = `${r.height}px`;
    };

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return true;
  } catch (err) {
    console.error('[Highlighter] Error highlighting element:', err);
    return false;
  }
}

export function clearHighlight(): void {
  const host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (host) {
    const shadow = (host as any).__shadow as ShadowRoot | undefined;
    if (shadow) {
      const overlay = shadow.querySelector('[data-a11y-overlay]');
      if (overlay) overlay.remove();
    }
  }
}
