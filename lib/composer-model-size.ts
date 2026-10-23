import { heightTo } from "./motion.ts";
import { revealHandoffHeader } from "./composer-handoff.ts";

const RESIZING = "data-bb-chat-ui-model-resizing";
const GAUGE = "[data-bb-chat-ui-effort]";

// Animate the card itself so native positioning follows the same visible height.
export function injectComposerModelSize(card: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  if (!view || typeof card.animate !== "function") {
    // Leave unsupported hosts on the original layout path.
    return () => {};
  }
  const media = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const previousMarker = card.getAttribute(RESIZING);
  let targetHeight = card.offsetHeight;
  let motion: Animation | null = null;
  let handoff = Boolean(card.querySelector('[aria-label="Exit handoff"]'));
  let reveal: Animation | null = null;
  let queued = false;
  let disposed = false;

  // Restore temporary clipping without changing the host's inline styles.
  function restoreMarker(): void {
    if (previousMarker === null) card.removeAttribute(RESIZING);
    else card.setAttribute(RESIZING, previousMarker);
  }

  // Release the height override immediately when motion is disabled or unloaded.
  function cancel(): void {
    const previous = motion;
    motion = null;
    previous?.cancel();
    reveal?.cancel();
    reveal = null;
    restoreMarker();
    targetHeight = card.offsetHeight;
  }

  // Measure the new intrinsic height and install its motion before the next paint.
  function measure(): void {
    queued = false;
    if (disposed) return;
    const nextHandoff = Boolean(card.querySelector('[aria-label="Exit handoff"]'));
    if (nextHandoff !== handoff) {
      handoff = nextHandoff;
      reveal?.cancel();
      reveal = handoff ? revealHandoffHeader(card) : null;
    }
    const previous = motion;
    const visibleHeight = previous ? card.offsetHeight : targetHeight;
    const currentTime = previous?.currentTime ?? null;
    motion = null;
    previous?.cancel();
    const nextHeight = card.offsetHeight;
    if (media?.matches || nextHeight <= 0 || visibleHeight <= 0) { cancel(); return; }
    if (nextHeight === targetHeight) {
      if (previous) {
        motion = previous;
        previous.play();
        previous.currentTime = currentTime;
      }
      return;
    }
    targetHeight = nextHeight;
    motion = heightTo(card, visibleHeight, nextHeight);
    if (!motion) { restoreMarker(); return; }
    motion.playbackRate = 2;
    card.setAttribute(RESIZING, "");
    const current = motion;
    // Return to intrinsic height after this target has settled.
    current.addEventListener("finish", () => {
      if (motion !== current) return;
      motion = null;
      restoreMarker();
    }, { once: true });
  }

  // Combine host and gauge insertion mutations without delaying them by a frame.
  function schedule(): void {
    if (disposed || queued) return;
    queued = true;
    view!.queueMicrotask(measure);
  }

  // Ignore changing gauge labels while observing actual provider content changes.
  function changed(records: MutationRecord[]): void {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (!target?.closest(GAUGE)) { schedule(); return; }
    }
  }

  const content = new view.MutationObserver(changed);
  content.observe(card, { childList: true, subtree: true, characterData: true });
  view.addEventListener("resize", schedule);
  media?.addEventListener?.("change", cancel);

  // Release queued work, native content observation, and the temporary height motion.
  return () => {
    if (disposed) return;
    disposed = true;
    content.disconnect();
    view.removeEventListener("resize", schedule);
    media?.removeEventListener?.("change", cancel);
    cancel();
  };
}
