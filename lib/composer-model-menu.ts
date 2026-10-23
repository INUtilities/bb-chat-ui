import { injectComposerEffort } from "./composer-effort.ts";
import { injectComposerModelSize } from "./composer-model-size.ts";

export const MODEL_MENU_MARK = "data-bb-chat-ui-model-menu";
export const MODEL_SUBMENU_MARK = "data-bb-chat-ui-model-submenu";
const TRIGGER = 'button[aria-haspopup="dialog"][aria-label^="Provider, model and reasoning"][aria-controls]';
const DIALOG = '[data-bb-portaled-overlay][role="dialog"]';
const MORE = 'button[aria-haspopup="menu"][aria-expanded="true"]';

// Track composer-owned model portals independently of optional provider controls.
export function injectComposerModelMenus(document: Document): () => void {
  const view = document.defaultView;
  const cards = new Map<HTMLElement, { previous: string | null; stop: () => void }>();
  const submenus = new Map<HTMLElement, { previous: string | null; trigger: Element }>();
  const seen = new WeakSet<Element>();
  const owners = new WeakMap<HTMLElement, Element>();
  let disposed = false;

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
    for (const [card, previous] of cards) {
      if (!card.isConnected) release(card, previous);
    }
    for (const trigger of Array.from(document.querySelectorAll(TRIGGER))) {
      const id = trigger.getAttribute("aria-controls");
      const card = id ? document.getElementById(id) : null;
      if (!card || !card.matches(DIALOG) || cards.has(card)) continue;
      const previous = card.getAttribute(MODEL_MENU_MARK);
      card.setAttribute(MODEL_MENU_MARK, "");
      const stopEffort = injectComposerEffort(card);
      const stopSize = injectComposerModelSize(card);
      // Release size motion before restoring the native effort controls.
      cards.set(card, { previous, stop: () => { stopSize(); stopEffort(); } });
    }
    discoverSubmenus();
  }

  // Inspect only newly added candidate subtrees instead of rescanning on chat tokens.
  function changed(records: MutationRecord[]): void {
    if (disposed) return;
    for (const record of records) {
      if (record.type === "attributes" && ((record.target as Element).matches(TRIGGER) || (record.target as Element).closest(`[${MODEL_MENU_MARK}]`))) {
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
        for (const [card, previous] of cards) {
          if (!card.isConnected) release(card, previous);
        }
        releaseClosedSubmenus();
      }
    }
  }

  const observer = view ? new view.MutationObserver(changed) : null;
  observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-controls", "aria-haspopup", "aria-label", "aria-expanded"] });
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
