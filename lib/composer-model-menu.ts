import { injectComposerEffort } from "./composer-effort.ts";
import { injectComposerModelSize } from "./composer-model-size.ts";
import { acceptJumpPulse, postHaptic, readHapticBridge } from "./send-haptic.ts";

export const MODEL_MENU_MARK = "data-bb-chat-ui-model-menu";
export const MODEL_SUBMENU_MARK = "data-bb-chat-ui-model-submenu";
export const MODEL_SCROLL_MARK = "data-bb-chat-ui-model-scrolled";
const TRIGGER = 'button[aria-haspopup="dialog"][aria-label^="Provider, model and reasoning"][aria-controls]';
const DIALOG = '[data-bb-portaled-overlay][role="dialog"]';
const MORE = 'button[aria-haspopup="menu"][aria-expanded="true"]';
// phone opens the picker in a BB drawer; its trigger has no aria-controls, so the drawer is found by its label.
const PHONE_TRIGGER = 'button[aria-haspopup="dialog"][aria-label^="Provider, model and reasoning"]:not([aria-controls])';
const PHONE_DRAWER = '[data-persistent-drawer-content][data-state="open"][role="dialog"]';

// Native Codex uses a listbox; providers without search use an overflow-y-auto list.
function trackModelScroll(card: HTMLElement): () => void {
  let scroller: HTMLElement | null = null;
  function update(): void {
    if (!scroller) return;
    const scrolled = scroller.scrollTop > 0;
    if (scroller.hasAttribute(MODEL_SCROLL_MARK) !== scrolled) scroller.toggleAttribute(MODEL_SCROLL_MARK, scrolled);
  }
  function unbind(): void {
    scroller?.removeEventListener("scroll", update);
    scroller?.removeAttribute(MODEL_SCROLL_MARK);
    scroller = null;
  }
  function bind(): void {
    const next = Array.from(card.querySelectorAll<HTMLElement>('[role="listbox"],div[class~="overflow-y-auto"]'))
      .find(element => element.querySelector(':scope > div[class~="sticky"]')) ?? null;
    if (next === scroller) return;
    unbind();
    scroller = next;
    scroller?.addEventListener("scroll", update, { passive: true });
    update();
  }
  const observer = new card.ownerDocument.defaultView!.MutationObserver(bind);
  observer.observe(card, { childList: true, subtree: true });
  bind();
  return () => { observer.disconnect(); unbind(); };
}

// Track composer-owned model portals independently of optional provider controls.
export function injectComposerModelMenus(document: Document): () => void {
  const view = document.defaultView;
  const cards = new Map<HTMLElement, { previous: string | null; stop: () => void; trigger: Element; phone?: boolean }>();
  const submenus = new Map<HTMLElement, { previous: string | null; trigger: Element }>();
  const seen = new WeakSet<Element>();
  const owners = new WeakMap<HTMLElement, Element>();
  let disposed = false;
  let lastActionAt: number | null = null;

  // Native radio clicks also carry Effort drag/keyboard commits from the shared gauge.
  function bindActionHaptics(card: HTMLElement): () => void {
    // Read this native utility without emitting another plugin CSS declaration.
    const selectedProviderClass = ["border", "foreground"].join("-");
    const click = (event: Event) => {
      if (document.documentElement.getAttribute('data-bb-chat-ui-root-device') !== 'phone' || !(event.target instanceof view!.Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      const fast = button.matches('[role="switch"][aria-label="Fast mode"]');
      const effort = button.matches('[role="radio"]:not([aria-checked="true"])') && button.closest('[role="radiogroup"][aria-label="Reasoning"]');
      const provider = button.hasAttribute('title') && button.parentElement?.matches('div[class~="bg-background"]') &&
        !button.classList.contains(selectedProviderClass) && button.getAttribute('aria-selected') !== 'true';
      if (!fast && !effort && !provider) return;
      const next = acceptJumpPulse(lastActionAt, view!.performance.now());
      if (next === null) return;
      lastActionAt = next;
      postHaptic(readHapticBridge(view), 'impact-light');
    };
    card.addEventListener('click', click, true);
    return () => card.removeEventListener('click', click, true);
  }

  // Restore the marker that existed before this content-script generation.
  function release(card: HTMLElement, record: { previous: string | null; stop: () => void }): void {
    record.stop();
    if (record.previous === null) card.removeAttribute(MODEL_MENU_MARK);
    else card.setAttribute(MODEL_MENU_MARK, record.previous);
    cards.delete(card);
  }

  // Restore only the styling marker owned by an additional-model portal.
  function releaseSubmenu(card: HTMLElement, previous: string | null): void {
    if (previous === null) card.removeAttribute(MODEL_SUBMENU_MARK);
    else card.setAttribute(MODEL_SUBMENU_MARK, previous);
    submenus.delete(card);
  }

  // Release child styling as soon as its native trigger or parent closes or disappears.
  function releaseClosedSubmenus(): void {
    for (const [card, record] of submenus) {
      if (!card.isConnected || !record.trigger.isConnected || !record.trigger.matches(MORE) || !record.trigger.closest(`[${MODEL_MENU_MARK}]`)) releaseSubmenu(card, record.previous);
    }
  }

  // Bind the native alias picker opened by More models, which supplies no aria-controls relation.
  function discoverSubmenus(): void {
    releaseClosedSubmenus();
    const triggers = Array.from(cards.keys()).flatMap(card => Array.from(card.querySelectorAll(MORE))).filter(trigger => trigger.textContent?.trim() === "More models");
    for (const card of Array.from(document.querySelectorAll<HTMLElement>(DIALOG))) {
      if (!cards.has(card) && !submenus.has(card) && triggers.length === 1 && (!seen.has(card) || owners.get(card) === triggers[0])) {
        const options = Array.from(card.querySelectorAll(':scope > button'));
        if (card.hasAttribute("data-side") && options.length && options.every(option => option.querySelector(':scope > span[title]') && option.querySelector('[data-icon="Check"]'))) {
          const previous = card.getAttribute(MODEL_SUBMENU_MARK);
          card.setAttribute(MODEL_SUBMENU_MARK, "");
          owners.set(card, triggers[0]);
          submenus.set(card, { previous, trigger: triggers[0] });
        }
      }
      seen.add(card);
    }
  }

  // Resolve the actual portal through its native trigger's aria-controls relation.
  function discover(): void {
    releaseClosedMenus();
    for (const trigger of Array.from(document.querySelectorAll(TRIGGER))) {
      const id = trigger.getAttribute("aria-controls");
      const card = id ? document.getElementById(id) : null;
      if (!card || !card.matches(DIALOG) || cards.has(card) || trigger.getAttribute("aria-expanded") === "false" || card.getAttribute("data-state") === "closed") continue;
      const previous = card.getAttribute(MODEL_MENU_MARK);
      card.setAttribute(MODEL_MENU_MARK, "");
      const stopEffort = injectComposerEffort(card);
      const stopSize = injectComposerModelSize(card);
      const stopScroll = trackModelScroll(card);
      // Release size motion before restoring the native effort controls.
      cards.set(card, { previous, trigger, stop: () => { stopScroll(); stopSize(); stopEffort(); } });
    }
    // Share desktop content enhancements; the native phone drawer still owns its outer height.
    const phoneTrigger = Array.from(document.querySelectorAll(PHONE_TRIGGER)).find(trigger => trigger.getAttribute("aria-expanded") === "true");
    if (phoneTrigger) {
      for (const card of Array.from(document.querySelectorAll<HTMLElement>(PHONE_DRAWER))) {
        if (cards.has(card) || document.getElementById(card.getAttribute("aria-labelledby") ?? "")?.textContent?.trim() !== "Model") continue;
        const previous = card.getAttribute(MODEL_MENU_MARK);
        card.setAttribute(MODEL_MENU_MARK, "");
        // Native editor focus restoration also runs while its phone drawer is open.
        // The portaled controls remain interactive; only their underlying composer is inert.
        const composer = phoneTrigger.closest<HTMLElement>('[data-promptbox]');
        const previousInert = composer?.getAttribute('inert') ?? null;
        if (composer && !composer.contains(card)) composer.setAttribute('inert', '');
        const stopEffort = injectComposerEffort(card);
        const stopScroll = trackModelScroll(card);
        const stopHaptics = bindActionHaptics(card);
        cards.set(card, { previous, trigger: phoneTrigger, stop: () => {
          stopHaptics(); stopScroll(); stopEffort();
          if (composer && !composer.contains(card)) {
            if (previousInert === null) composer.removeAttribute('inert');
            else composer.setAttribute('inert', previousInert);
          }
        }, phone: true });
      }
    }
    discoverSubmenus();
  }

  function releaseClosedMenus(): void {
    for (const [card, record] of cards) {
      if (!card.isConnected || !record.trigger.isConnected || (!record.phone && record.trigger.getAttribute("aria-controls") !== card.id) || record.trigger.getAttribute("aria-expanded") === "false" || card.getAttribute("data-state") === "closed") release(card, record);
    }
  }

  // Inspect only newly added candidate subtrees instead of rescanning on chat tokens.
  function changed(records: MutationRecord[]): void {
    if (disposed) return;
    for (const record of records) {
      if (record.type === "attributes" && ((record.target as Element).matches(`${TRIGGER},${PHONE_TRIGGER},${PHONE_DRAWER}`) || (record.target as Element).closest(`[${MODEL_MENU_MARK}]`))) {
        discover();
        return;
      }
      for (const node of Array.from(record.addedNodes)) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        if (element.matches(`${TRIGGER},${DIALOG}`) || element.querySelector(`${TRIGGER},${DIALOG}`)) {
          discover();
          return;
        }
      }
      if (record.removedNodes.length && cards.size) {
        releaseClosedMenus();
        releaseClosedSubmenus();
      }
    }
  }

  const observer = view ? new view.MutationObserver(changed) : null;
  observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-controls", "aria-haspopup", "aria-label", "aria-expanded", "data-state"] });
  discover();

  // Release portal ownership when the plugin reloads or is disabled.
  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    for (const [card, record] of submenus) releaseSubmenu(card, record.previous);
    for (const [card, previous] of cards) release(card, previous);
  };
}
