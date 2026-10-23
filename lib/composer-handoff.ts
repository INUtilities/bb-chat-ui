import { heightTo, popoverRise } from "./motion.ts";

export const COMPOSER_HANDOFF_RESIZING = "data-bb-chat-ui-handoff-resizing";
const EXIT = '[aria-label="Exit handoff"]';

// Reveal only the new native handoff heading, preserving its real exit button.
export function revealHandoffHeader(surface: HTMLElement): Animation | null {
  const view = surface.ownerDocument.defaultView;
  const heading = surface.querySelector<HTMLElement>(EXIT)?.parentElement;
  if (!heading || typeof heading.animate !== "function" || view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  const motion = popoverRise(heading);
  if (motion) motion.playbackRate = 260 / 160;
  return motion;
}

// Morph handoff height without taking over ordinary draft or native collapse sizing.
export function injectComposerHandoff(composer: HTMLElement): () => void {
  const view = composer.ownerDocument.defaultView;
  if (!view?.ResizeObserver || typeof composer.animate !== "function") {
    // Keep unsupported hosts on their existing native layout path.
    return () => {};
  }
  const media = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const previousMarker = composer.getAttribute(COMPOSER_HANDOFF_RESIZING);
  let handoff = Boolean(composer.querySelector(EXIT));
  let idleHeight = composer.offsetHeight;
  let targetHeight = idleHeight;
  let height: Animation | null = null;
  let reveal: Animation | null = null;
  let queued = false;
  let disposed = false;

  // Restore the attribute that existed before this enhancement owned clipping.
  function restoreMarker(): void {
    if (previousMarker === null) composer.removeAttribute(COMPOSER_HANDOFF_RESIZING);
    else composer.setAttribute(COMPOSER_HANDOFF_RESIZING, previousMarker);
  }

  // Release all temporary motion while leaving draft nodes and inline styles intact.
  function cancel(): void {
    const previous = height;
    height = null;
    previous?.cancel();
    reveal?.cancel();
    reveal = null;
    restoreMarker();
    targetHeight = idleHeight = composer.offsetHeight;
  }

  // Apply a mode change before paint and continue interrupted motion from visible height.
  function measure(): void {
    queued = false;
    if (disposed) return;
    const nextHandoff = Boolean(composer.querySelector(EXIT));
    const changed = nextHandoff !== handoff;
    if (!changed && !height) return;
    handoff = nextHandoff;
    if (changed) {
      reveal?.cancel();
      reveal = nextHandoff ? revealHandoffHeader(composer) : null;
    }
    const previous = height;
    const from = previous ? composer.offsetHeight : idleHeight;
    const time = previous?.currentTime ?? null;
    height = null;
    previous?.cancel();
    const to = composer.offsetHeight;
    const nativeHeight = composer.style.height;
    if (media?.matches || (nativeHeight && nativeHeight !== "auto") || from <= 0 || to <= 0) { cancel(); return; }
    if (previous && to === targetHeight) {
      height = previous;
      previous.play();
      previous.currentTime = time;
      return;
    }
    targetHeight = to;
    if (from === to) { restoreMarker(); idleHeight = to; return; }
    height = heightTo(composer, from, to);
    if (!height) { restoreMarker(); idleHeight = to; return; }
    height.playbackRate = 2;
    composer.setAttribute(COMPOSER_HANDOFF_RESIZING, "");
    const current = height;
    // Return to natural sizing when this handoff height has settled.
    current.addEventListener("finish", () => {
      if (height !== current) return;
      height = null;
      restoreMarker();
      idleHeight = composer.offsetHeight;
    }, { once: true });
  }

  // Combine native subtree changes without adding a frame of input latency.
  function changed(): void {
    if (queued || disposed) return;
    queued = true;
    view!.queueMicrotask(measure);
  }

  const content = new view.MutationObserver(changed);
  content.observe(composer, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "data-promptbox-compact"] });
  // Cache settled geometry from layout delivery rather than measuring every keystroke.
  const size = new view.ResizeObserver(() => {
    if (!disposed && !height) idleHeight = composer.offsetHeight;
  });
  size.observe(composer);
  media?.addEventListener?.("change", cancel);

  // Disconnect all work when the native form leaves the page or the plugin reloads.
  return () => {
    if (disposed) return;
    disposed = true;
    content.disconnect();
    size.disconnect();
    media?.removeEventListener?.("change", cancel);
    cancel();
  };
}
