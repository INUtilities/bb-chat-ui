import { EASE, heightTo } from "./motion.ts";

const RESIZING = "data-bb-chat-ui-model-resizing";

// Smooth natural card height and native placement without moving host-owned nodes.
export function injectComposerModelSize(card: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  const wrapper = card.closest<HTMLElement>("[data-radix-popper-content-wrapper]");
  if (!view?.ResizeObserver || !wrapper) {
    // Keep unsupported hosts on their original sizing path.
    return () => {};
  }
  const media = view.matchMedia?.("(prefers-reduced-motion: reduce)");
  const previousMarker = wrapper.getAttribute(RESIZING);
  let targetHeight = card.offsetHeight;
  let nativeY = wrapper.getBoundingClientRect().top;
  let height: Animation | null = null;
  let position: Animation | null = null;
  let frame = 0;
  let disposed = false;

  // Restore the wrapper attribute after temporary clipping is no longer needed.
  function restoreMarker(): void {
    if (previousMarker === null) wrapper!.removeAttribute(RESIZING);
    else wrapper!.setAttribute(RESIZING, previousMarker);
  }

  // Read only the independent translate, leaving the host's transform untouched.
  function translateY(): number {
    const parts = view!.getComputedStyle(wrapper!).translate?.split(/\s+/) ?? [];
    return parts.length > 1 ? parseFloat(parts[1]) || 0 : 0;
  }

  // Cancel motion when accessibility settings change or the enhancement unloads.
  function cancel(): void {
    const oldHeight = height;
    const oldPosition = position;
    height = position = null;
    oldHeight?.cancel();
    oldPosition?.cancel();
    restoreMarker();
  }

  // Coalesce natural-size and native-position updates into one visual transition.
  function measure(): void {
    frame = 0;
    if (disposed) return;
    const rect = wrapper!.getBoundingClientRect();
    const offsetY = translateY();
    const nextY = rect.top - offsetY;
    const nextHeight = card.offsetHeight;
    const resized = nextHeight !== targetHeight;
    const moved = Math.abs(nextY - nativeY) > .5;
    const fromHeight = height ? rect.height : targetHeight;
    const fromY = nativeY + offsetY;
    const previousHeight = targetHeight;
    targetHeight = nextHeight;
    nativeY = nextY;
    if (media?.matches) { cancel(); return; }
    if (resized && previousHeight > 0 && nextHeight > 0) {
      const old = height;
      height = null;
      old?.cancel();
      height = heightTo(wrapper!, fromHeight, nextHeight);
      if (height) {
        wrapper!.setAttribute(RESIZING, "");
        const current = height;
        // Release clipping after this height target has settled.
        current.addEventListener("finish", () => {
          if (height !== current) return;
          height = null;
          restoreMarker();
        }, { once: true });
      }
    }
    if (moved && (resized || height || position) && typeof wrapper!.animate === "function") {
      position?.cancel();
      position = wrapper!.animate([
        { translate: `0px ${fromY - nextY}px` },
        { translate: "0px 0px" },
      ], { duration: 320, easing: EASE.out });
      const current = position;
      // Forget the position motion once the native anchor has been reached.
      current.addEventListener("finish", () => {
        if (position === current) position = null;
      }, { once: true });
    }
  }

  // Schedule at most one measurement for a burst of host updates.
  function schedule(): void {
    if (!disposed && !frame) frame = view!.requestAnimationFrame(measure);
  }

  const resize = new view.ResizeObserver(schedule);
  const placement = new view.MutationObserver(schedule);
  resize.observe(card);
  placement.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
  media?.addEventListener?.("change", cancel);

  // Release observers and animations without leaving fixed dimensions behind.
  return () => {
    if (disposed) return;
    disposed = true;
    resize.disconnect();
    placement.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
    media?.removeEventListener?.("change", cancel);
    cancel();
  };
}
