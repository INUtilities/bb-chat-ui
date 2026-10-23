import { injectComposerEffort } from "./composer-effort.ts";
import { injectComposerModelSize } from "./composer-model-size.ts";

export const MODEL_MENU_MARK = "data-bb-chat-ui-model-menu";
const TRIGGER = 'button[aria-haspopup="dialog"][aria-label^="Provider, model and reasoning"][aria-controls]';
const DIALOG = '[data-bb-portaled-overlay][role="dialog"]';

// Track composer-owned model portals independently of optional provider controls.
export function injectComposerModelMenus(document: Document): () => void {
  const view = document.defaultView;
  const cards = new Map<HTMLElement, { previous: string | null; stop: () => void }>();
  let disposed = false;

  // Restore the marker that existed before this content-script generation.
  function release(card: HTMLElement, record: { previous: string | null; stop: () => void }): void {
    record.stop();
    if (record.previous === null) card.removeAttribute(MODEL_MENU_MARK);
    else card.setAttribute(MODEL_MENU_MARK, record.previous);
    cards.delete(card);
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
  }

  // Inspect only newly added candidate subtrees instead of rescanning on chat tokens.
  function changed(records: MutationRecord[]): void {
    if (disposed) return;
    for (const record of records) {
      if (record.type === "attributes" && (record.target as Element).matches(TRIGGER)) {
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
      }
    }
  }

  const observer = view ? new view.MutationObserver(changed) : null;
  observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-controls", "aria-haspopup", "aria-label"] });
  discover();

  // Release portal ownership when the plugin reloads or is disabled.
  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    for (const [card, previous] of cards) release(card, previous);
  };
}
