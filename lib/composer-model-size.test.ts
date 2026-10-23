import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectComposerModelSize } from "./composer-model-size.ts";

const RESIZING = "data-bb-chat-ui-model-resizing";

type Motion = {
  target: Element;
  frames: Keyframe[] | PropertyIndexedKeyframes | null;
  options: number | KeyframeAnimationOptions | undefined;
  cancelled: boolean;
  animation: Animation;
};

// Read a property's endpoints from either form accepted by Element.animate.
function values(motion: Motion, property: string): string[] {
  if (Array.isArray(motion.frames)) {
    const result: string[] = [];
    for (const frame of motion.frames) if (frame[property] !== undefined) result.push(String(frame[property]));
    return result;
  }
  const value = motion.frames?.[property];
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

// Provide controlled natural height, visible geometry, observers, animation records, and rAF delivery.
function fixture(options: { wrapper?: boolean; resizeObserver?: boolean; reducedMotion?: boolean } = {}) {
  const dom = new JSDOM(`<html><head></head><body>${options.wrapper === false ? "" : '<div data-radix-popper-content-wrapper style="transform: translate(24px, 500px)">'}<div role="dialog" data-bb-portaled-overlay><div>Models</div></div>${options.wrapper === false ? "" : "</div>"}</body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  const card = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const wrapper = card.parentElement!;
  const state = { naturalHeight: 240, visibleHeight: 240, nativeY: 500, translateY: 0 };
  const frames = new Map<number, FrameRequestCallback>();
  const motions: Motion[] = [];
  const observers: SizeObserver[] = [];
  let serial = 0;
  // Keep the measured source height independent from the animated outer wrapper.
  Object.defineProperty(card, "offsetHeight", { get: () => state.naturalHeight });
  // Report the visible wrapper height during an interrupted animation.
  Object.defineProperty(wrapper, "offsetHeight", { get: () => state.visibleHeight });
  // Return actual visible popup coordinates including the current independent translate.
  wrapper.getBoundingClientRect = () => ({ x: 24, y: state.nativeY + state.translateY, left: 24, top: state.nativeY + state.translateY, right: 344, bottom: state.nativeY + state.translateY + state.visibleHeight, width: 320, height: state.visibleHeight, toJSON() {} });
  // Expose the unmodified natural card geometry inside its clipping wrapper.
  card.getBoundingClientRect = () => ({ ...wrapper.getBoundingClientRect(), height: state.naturalHeight, bottom: state.nativeY + state.translateY + state.naturalHeight });
  // Record pending work so bursts can be flushed as a single browser frame.
  dom.window.requestAnimationFrame = callback => { const id = ++serial; frames.set(id, callback); return id; };
  // Remove deferred layout work when the enhancement is disposed.
  dom.window.cancelAnimationFrame = id => { frames.delete(id); };
  // Return only the requested accessibility preference as a matched media query.
  dom.window.matchMedia = query => ({ matches: Boolean(options.reducedMotion && query.includes("prefers-reduced-motion")), media: query } as MediaQueryList);
  const realComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  // Expose current WAAPI translate separately from the host's original transform.
  dom.window.getComputedStyle = (element, pseudo) => {
    const computed = realComputedStyle(element, pseudo);
    if (element === wrapper) Object.defineProperty(computed, "translate", { value: state.translateY ? `0px ${state.translateY}px` : "none", configurable: true });
    return computed;
  };
  class SizeObserver {
    targets = new Set<Element>();
    callback: ResizeObserverCallback;
    // Retain the browser callback and targets for explicit resize delivery.
    constructor(callback: ResizeObserverCallback) { this.callback = callback; observers.push(this); }
    // Track the elements whose natural size the implementation observes.
    observe(target: Element): void { this.targets.add(target); }
    // Release an individual observed element.
    unobserve(target: Element): void { this.targets.delete(target); }
    // Release all retained elements when the enhancement is disposed.
    disconnect(): void { this.targets.clear(); }
  }
  // Record independent height and position motions without running a browser clock.
  function animate(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, timing?: number | KeyframeAnimationOptions): Animation {
    let resolve!: (animation: Animation) => void;
    let reject!: (reason: Error) => void;
    // Keep the animation pending until the test finishes or cancels it.
    const finished = new Promise<Animation>((done, fail) => { resolve = done; reject = fail; });
    // Browser consumers may omit a finished handler, so consume the original cancellation rejection.
    finished.catch(() => {});
    const events = new dom.window.EventTarget();
    const motion = { target: this, frames: keyframes, options: timing, cancelled: false } as Motion;
    const animation = {
      finished,
      playState: "running",
      onfinish: null,
      oncancel: null,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      // Cancel the current visual interpolation before a replacement starts.
      cancel() {
        if (motion.cancelled) return;
        motion.cancelled = true;
        animation.playState = "idle";
        reject(new dom.window.DOMException("The animation was cancelled", "AbortError"));
        events.dispatchEvent(new dom.window.Event("cancel"));
      },
      // Allow tests to complete a motion without waiting for wall-clock time.
      finish() {
        animation.playState = "finished";
        resolve(animation as unknown as Animation);
        events.dispatchEvent(new dom.window.Event("finish"));
      },
    };
    motion.animation = animation as unknown as Animation;
    motions.push(motion);
    return motion.animation;
  }
  card.animate = animate;
  wrapper.animate = animate;
  const observerType = options.resizeObserver === false ? undefined : SizeObserver;
  Object.defineProperty(dom.window, "ResizeObserver", { configurable: true, value: observerType });
  const globals = { ResizeObserver: observerType, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), getComputedStyle: dom.window.getComputedStyle.bind(dom.window) };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // Deliver a natural-size change to each currently active observer.
  function resize(): void {
    for (const observer of observers) {
      const entries: ResizeObserverEntry[] = [];
      for (const target of observer.targets) entries.push({ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry);
      if (entries.length) observer.callback(entries, observer as unknown as ResizeObserver);
    }
  }
  // Flush observer microtasks and one coalesced browser frame.
  async function paint(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    const pending = Array.from(frames.entries());
    for (const [id, callback] of pending) { frames.delete(id); callback(0); }
    await Promise.resolve();
    await Promise.resolve();
  }
  // Restore host globals after all animation and observer work has been released.
  function restore(): void {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
  return { dom, document, card, wrapper, state, frames, motions, observers, resize, paint, restore };
}

// Select only motions that interpolate popup height.
function heightMotions(motions: Motion[]): Motion[] {
  const result: Motion[] = [];
  for (const motion of motions) if (values(motion, "height").length) result.push(motion);
  return result;
}

// Preserve the initial position and the host's DOM ownership without an entry resize animation.
test("installation observes the existing popup without animating or reparenting it", async () => {
  const f = fixture();
  const parent = f.card.parentNode;
  const transform = f.wrapper.style.transform;
  const stop = injectComposerModelSize(f.card);
  try {
    await f.paint();
    assert.equal(f.motions.length, 0);
    assert.equal(f.card.parentNode, parent);
    assert.equal(f.wrapper.style.transform, transform);
  } finally { stop(); f.restore(); }
});

// Animate the measured size and compensate the popup's native y change in one coalesced frame.
test("resize bursts animate visible height to the new target for 320ms with separate position compensation", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.state.nativeY = 450;
    f.resize(); f.resize(); f.resize();
    f.wrapper.style.transform = "translate(24px, 450px)";
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.frames.size, 1, "resize and native position updates share one frame");
    await f.paint();
    const heights = heightMotions(f.motions);
    assert.equal(heights.length, 1);
    assert.equal(heights[0].target, f.wrapper);
    assert.deepEqual(values(heights[0], "height"), ["240px", "360px"]);
    const timing = heights[0].options;
    assert.equal(typeof timing === "number" ? timing : timing?.duration, 320);
    const translations = f.motions.filter(motion => values(motion, "translate").length || values(motion, "transform").length);
    assert.equal(translations.length, 1, "height and y compensation use independent animations");
    const endpoints = values(translations[0], "translate").length ? values(translations[0], "translate") : values(translations[0], "transform");
    assert.match(endpoints[0], /50px/, "the old visual position is preserved above the new native coordinate");
    assert.match(endpoints.at(-1)!, /(?:^|[^\d])0(?:px)?(?:\)|$)/, "position compensation returns to the native coordinate");
    assert.equal(f.wrapper.style.transform, "translate(24px, 450px)", "the host retains its native transform");
    assert.equal(f.card.offsetHeight, 360, "wrapper motion does not change the natural card height");
  } finally { stop(); f.restore(); }
});

// Ignore ResizeObserver callbacks that report the already measured target size.
test("unchanged natural height does not start or duplicate a height motion", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.resize(); await f.paint();
    assert.equal(f.motions.length, 0);
    f.state.naturalHeight = 360;
    f.resize(); await f.paint();
    assert.equal(heightMotions(f.motions).length, 1);
    f.resize(); f.resize(); await f.paint();
    assert.equal(heightMotions(f.motions).length, 1, "callbacks during the active interpolation do not restart the same target");
  } finally { stop(); f.restore(); }
});

// Catch native position changes delivered after the popup's height has already changed.
test("a later native wrapper position update animates translate without repeating the height motion", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.resize(); await f.paint();
    assert.equal(heightMotions(f.motions).length, 1);
    f.state.nativeY = 450;
    f.wrapper.style.transform = "translate(24px, 450px)";
    await f.paint();
    assert.equal(heightMotions(f.motions).length, 1);
    const translations = f.motions.filter(motion => values(motion, "translate").length || values(motion, "transform").length);
    assert.equal(translations.length, 1, "the native style observer compensates a delayed position update");
    const endpoints = values(translations[0], "translate").length ? values(translations[0], "translate") : values(translations[0], "transform");
    assert.match(endpoints[0], /50px/);
  } finally { stop(); f.restore(); }
});

// Restart an interrupted transition from the visible result instead of its prior endpoint.
test("a new target cancels the previous height motion and starts at the currently visible height", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.resize(); await f.paint();
    const first = heightMotions(f.motions)[0];
    assert.ok(first);
    f.state.visibleHeight = 285;
    f.state.naturalHeight = 420;
    f.resize(); await f.paint();
    const heights = heightMotions(f.motions);
    assert.equal(heights.length, 2);
    assert.equal(first.cancelled, true);
    assert.deepEqual(values(heights[1], "height"), ["285px", "420px"]);
  } finally { stop(); f.restore(); }
});

// Clear all pending enhancement work when a popup closes or the plugin unloads.
test("dispose disconnects observers, cancels queued frames and active motions, and removes its marker", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.state.nativeY = 450;
    f.resize(); await f.paint();
    assert.ok(f.wrapper.hasAttribute(RESIZING));
    f.state.naturalHeight = 420;
    f.resize();
    assert.equal(f.frames.size, 1);
    stop();
    assert.equal(f.frames.size, 0);
    for (const observer of f.observers) assert.equal(observer.targets.size, 0);
    for (const motion of f.motions) assert.equal(motion.cancelled, true);
    assert.equal(f.wrapper.hasAttribute(RESIZING), false);
    const count = f.motions.length;
    f.wrapper.style.transform = "translate(24px, 400px)";
    f.resize(); await f.paint();
    assert.equal(f.frames.size, 0);
    assert.equal(f.motions.length, count, "disposed mutation observers cannot restart motion");
  } finally { stop(); f.restore(); }
});

// Restore a wrapper attribute owned by a prior host or content-script generation.
test("dispose restores a pre-existing wrapper resizing marker value", async () => {
  const f = fixture();
  f.wrapper.setAttribute(RESIZING, "native-owner");
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.resize(); await f.paint();
    stop();
    assert.equal(f.wrapper.getAttribute(RESIZING), "native-owner");
  } finally { stop(); f.restore(); }
});

// Honor the system motion preference for both size and position updates.
test("prefers-reduced-motion suppresses height and position animations", async () => {
  const f = fixture({ reducedMotion: true });
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.state.nativeY = 450;
    f.wrapper.style.transform = "translate(24px, 450px)";
    f.resize(); await f.paint();
    assert.equal(f.motions.length, 0);
  } finally { stop(); f.restore(); }
});

// Leave unsupported host layouts untouched instead of creating an artificial wrapper.
test("a card without a native popper wrapper remains unchanged", async () => {
  const f = fixture({ wrapper: false });
  const original = f.card.outerHTML;
  const parent = f.card.parentNode;
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.resize(); await f.paint();
    assert.equal(f.motions.length, 0);
    assert.equal(f.card.outerHTML, original);
    assert.equal(f.card.parentNode, parent);
    assert.equal(f.frames.size, 0);
  } finally { stop(); f.restore(); }
});

// Keep browsers without ResizeObserver on their native positioning and sizing path.
test("missing ResizeObserver support leaves the popup untouched", async () => {
  const f = fixture({ resizeObserver: false });
  const original = f.wrapper.outerHTML;
  const originalStyle = f.wrapper.getAttribute("style")!;
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.wrapper.style.transform = "translate(24px, 450px)";
    await f.paint();
    assert.equal(f.motions.length, 0);
    assert.equal(f.wrapper.hasAttribute(RESIZING), false);
    assert.equal(f.frames.size, 0);
    stop();
    f.wrapper.setAttribute("style", originalStyle);
    assert.equal(f.wrapper.outerHTML, original);
  } finally { stop(); f.restore(); }
});
