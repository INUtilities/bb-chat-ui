import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectComposerModelSize } from "./composer-model-size.ts";

const RESIZING = "data-bb-chat-ui-model-resizing";

type Motion = {
  target: Element;
  frames: Keyframe[] | PropertyIndexedKeyframes | null;
  options: number | KeyframeAnimationOptions | undefined;
  cancels: number;
  plays: number;
  animation: Animation;
};

// Read animation endpoints without depending on the array or property-indexed WAAPI form.
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

// Model card-owned WAAPI height while keeping natural height available after cancellation.
function fixture(options: { wrapper?: boolean; resizeObserver?: boolean; reducedMotion?: boolean } = {}) {
  const dom = new JSDOM(`<html><head></head><body>${options.wrapper === false ? "" : '<div data-radix-popper-content-wrapper style="transform: translate(24px, 500px);">'}<div role="dialog" data-bb-portaled-overlay style="min-width: 256px;"><div data-native-controls>Models</div><div data-bb-chat-ui-effort><output>Low</output></div></div>${options.wrapper === false ? "" : "</div>"}</body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  const card = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const wrapper = card.parentElement!;
  const state = { naturalHeight: 240, visibleHeight: 240, reads: 0, reduced: Boolean(options.reducedMotion) };
  const frames = new Map<number, FrameRequestCallback>();
  const motions: Motion[] = [];
  const mutations: TrackedMutation[] = [];
  const resizes: SizeObserver[] = [];
  let serial = 0;
  // Return the visible animated card height until its animation has been cancelled.
  function cardHeight(): number {
    state.reads++;
    for (const motion of motions) {
      if (motion.target === card && ["running", "paused"].includes(motion.animation.playState)) return state.visibleHeight;
    }
    return state.naturalHeight;
  }
  Object.defineProperty(card, "offsetHeight", { get: cardHeight });
  // Expose card geometry for compatibility with consumers that inspect its visible rectangle.
  card.getBoundingClientRect = () => ({ x: 24, y: 500, left: 24, top: 500, right: 344, bottom: 500 + cardHeight(), width: 320, height: cardHeight(), toJSON() {} });
  // Keep native wrapper geometry outside the card animation state.
  wrapper.getBoundingClientRect = () => ({ x: 24, y: 500, left: 24, top: 500, right: 344, bottom: 500 + state.naturalHeight, width: 320, height: state.naturalHeight, toJSON() {} });
  // Record any forbidden frame scheduling without advancing the browser paint clock.
  dom.window.requestAnimationFrame = callback => { const id = ++serial; frames.set(id, callback); return id; };
  // Allow disposal to clear frame work left by a previous implementation.
  dom.window.cancelAnimationFrame = id => { frames.delete(id); };
  const mediaEvents = new dom.window.EventTarget();
  const media = {
    // Reflect the current system setting when the implementation checks the media query.
    get matches() { return state.reduced; },
    addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
  } as unknown as MediaQueryList;
  // Share one live accessibility query between the implementation and motion helper.
  dom.window.matchMedia = () => media;
  class TrackedMutation extends dom.window.MutationObserver {
    target: Node | null = null;
    active = false;
    // Retain observer ownership while using real DOM mutation delivery.
    constructor(callback: MutationCallback) { super(callback); mutations.push(this); }
    // Track each observed surface so wrapper style observation cannot return unnoticed.
    observe(target: Node, settings?: MutationObserverInit): void { this.target = target; this.active = true; super.observe(target, settings); }
    // Record observer release when a popup closes.
    disconnect(): void { this.active = false; super.disconnect(); }
  }
  class SizeObserver {
    // Detect use of the obsolete natural-size observer path.
    constructor(_callback: ResizeObserverCallback) { resizes.push(this); }
    // Keep the previous implementation executable for a meaningful RED result.
    observe(_target: Element): void {}
    // Match the native observer cleanup API.
    disconnect(): void {}
  }
  // Record card or wrapper motions with restartable animation state and a controllable clock.
  function animate(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, timing?: number | KeyframeAnimationOptions): Animation {
    const events = new dom.window.EventTarget();
    const motion = { target: this, frames: keyframes, options: timing, cancels: 0, plays: 0 } as Motion;
    const animation = {
      playState: "running",
      currentTime: 0 as number | null,
      playbackRate: 1,
      onfinish: null as ((event: Event) => void) | null,
      oncancel: null as ((event: Event) => void) | null,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      // Remove the visible interpolation so the next offsetHeight read sees natural content.
      cancel() {
        motion.cancels++;
        animation.playState = "idle";
        animation.currentTime = null;
        const event = new dom.window.Event("cancel");
        events.dispatchEvent(event);
        animation.oncancel?.(event);
      },
      // Reuse this exact animation when a measurement confirms its previous target.
      play() {
        motion.plays++;
        animation.playState = "running";
        if (animation.currentTime === null) animation.currentTime = 0;
      },
      // Support either direct playbackRate assignment or the equivalent WAAPI method.
      updatePlaybackRate(rate: number) { animation.playbackRate = rate; },
      // Finish synchronously so marker restoration can be checked without a timer.
      finish() {
        animation.playState = "finished";
        const event = new dom.window.Event("finish");
        events.dispatchEvent(event);
        animation.onfinish?.(event);
      },
    };
    motion.animation = animation as unknown as Animation;
    motions.push(motion);
    return motion.animation;
  }
  card.animate = animate;
  wrapper.animate = animate;
  Object.defineProperty(dom.window, "MutationObserver", { configurable: true, value: TrackedMutation });
  Object.defineProperty(dom.window, "ResizeObserver", { configurable: true, value: options.resizeObserver === false ? undefined : SizeObserver });
  const globals = { MutationObserver: TrackedMutation, ResizeObserver: options.resizeObserver === false ? undefined : SizeObserver, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), getComputedStyle: dom.window.getComputedStyle.bind(dom.window), matchMedia: dom.window.matchMedia.bind(dom.window) };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // Change native provider content to trigger a card subtree measurement.
  function change(): void { card.querySelector("[data-native-controls]")!.append(document.createElement("span")); }
  // Deliver DOM observers and queued measurements before any requestAnimationFrame callback.
  async function settle(): Promise<void> {
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  }
  // Apply a live system preference change through the MediaQueryList event boundary.
  function reduce(): void { state.reduced = true; mediaEvents.dispatchEvent(new dom.window.Event("change")); }
  // Restore host globals after the enhancement and its DOM have been released.
  function restore(): void {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
  return { dom, document, card, wrapper, state, frames, motions, mutations, resizes, change, settle, reduce, restore };
}

// Preserve initial host geometry and avoid animating the native positioning wrapper.
test("installation preserves card ownership and inline styles without wrapper observation or an entry motion", async () => {
  const f = fixture();
  const parent = f.card.parentNode;
  const cardStyle = f.card.getAttribute("style");
  const wrapperStyle = f.wrapper.getAttribute("style");
  const stop = injectComposerModelSize(f.card);
  try {
    await f.settle();
    assert.equal(f.motions.length, 0);
    assert.equal(f.card.parentNode, parent);
    assert.equal(f.card.getAttribute("style"), cardStyle);
    assert.equal(f.wrapper.getAttribute("style"), wrapperStyle);
    for (const observer of f.mutations) assert.notEqual(observer.target, f.wrapper, "the native positioning wrapper is not observed");
    assert.equal(f.resizes.length, 0, "card content changes do not depend on ResizeObserver");
  } finally { stop(); f.restore(); }
});

// Morph the actual popup card before another paint can expose the final content height.
test("native child-list bursts start one card height motion in a microtask at twice the 320ms playback rate", async () => {
  const f = fixture();
  const wrapperStyle = f.wrapper.getAttribute("style");
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.change(); f.change(); f.change();
    await f.settle();
    assert.equal(f.frames.size, 0, "height measurement does not wait for rAF");
    assert.equal(f.motions.length, 1);
    const motion = f.motions[0];
    assert.equal(motion.target, f.card, "the visible popup and its content use the same height motion");
    assert.deepEqual(values(motion, "height"), ["240px", "303px"]);
    const timing = motion.options;
    assert.equal(typeof timing === "number" ? timing : timing?.duration, 320);
    assert.equal(motion.animation.playbackRate, 2);
    assert.ok(f.card.hasAttribute(RESIZING));
    assert.equal(f.wrapper.hasAttribute(RESIZING), false);
    assert.equal(f.wrapper.getAttribute("style"), wrapperStyle);
    assert.equal(values(motion, "translate").length, 0);
    assert.equal(values(motion, "transform").length, 0);
  } finally { stop(); f.restore(); }
});

// Leave stationary content alone instead of starting a redundant height animation.
test("unchanged native card height does not start a height motion", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.change(); await f.settle();
    assert.equal(f.motions.length, 0);
    assert.equal(f.frames.size, 0);
  } finally { stop(); f.restore(); }
});

// Measure natural height by cancelling and then resume the same interpolation if its target remains valid.
test("the same active target reuses its Animation and restores currentTime after natural-height measurement", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.change(); await f.settle();
    const motion = f.motions[0];
    assert.ok(motion);
    motion.animation.currentTime = 88;
    f.state.visibleHeight = 285;
    f.change(); f.change(); await f.settle();
    assert.equal(f.motions.length, 1, "measurement does not replace a motion with an unchanged target");
    assert.ok(motion.cancels > 0, "natural height is read with the old visual interpolation removed");
    assert.equal(motion.plays, 1);
    assert.equal(motion.animation.currentTime, 88);
    assert.equal(motion.animation.playState, "running");
    assert.equal(motion.animation.playbackRate, 2);
    assert.ok(f.card.hasAttribute(RESIZING));
  } finally { stop(); f.restore(); }
});

// Start a changed target at the actual animated card height, rather than the old endpoint or wrapper height.
test("a changed active target restarts at the card's visible offsetHeight after cancelling the previous motion", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.change(); await f.settle();
    const first = f.motions[0];
    assert.ok(first);
    f.state.visibleHeight = 285;
    f.state.naturalHeight = 418;
    f.change(); await f.settle();
    assert.equal(f.motions.length, 2);
    assert.ok(first.cancels > 0);
    assert.equal(first.animation.playState, "idle");
    assert.equal(f.motions[1].target, f.card);
    assert.deepEqual(values(f.motions[1], "height"), ["285px", "418px"]);
    assert.equal(f.motions[1].animation.playbackRate, 2);
  } finally { stop(); f.restore(); }
});

// Keep native popper placement outside the resize enhancement's lifecycle.
test("native wrapper transform changes do not schedule or create a card or wrapper animation", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.wrapper.style.transform = "translate(24px, 450px)";
    await f.settle();
    assert.equal(f.frames.size, 0);
    assert.equal(f.motions.length, 0);
    assert.equal(f.wrapper.style.transform, "translate(24px, 450px)");
    assert.equal(f.wrapper.hasAttribute(RESIZING), false);
  } finally { stop(); f.restore(); }
});

// Remeasure layout changes caused by the browser window using the same pre-paint path.
test("window resize starts a card height motion without waiting for native content mutations or rAF", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
    await f.settle();
    assert.equal(f.frames.size, 0);
    assert.equal(f.motions.length, 1);
    assert.equal(f.motions[0].target, f.card);
    assert.deepEqual(values(f.motions[0], "height"), ["240px", "303px"]);
  } finally { stop(); f.restore(); }
});

// Exclude the enhancement's own gauge text updates from provider-card measurement.
test("effort gauge output mutations do not measure or restart card height", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    const reads = f.state.reads;
    f.state.naturalHeight = 303;
    f.card.querySelector("[data-bb-chat-ui-effort] output")!.textContent = "Extra High";
    await f.settle();
    assert.equal(f.state.reads, reads, "gauge-owned output updates are ignored before measuring layout");
    assert.equal(f.motions.length, 0);
  } finally { stop(); f.restore(); }
});

// Release card clipping when a height transition reaches its final native height.
test("finishing a card motion restores its previous marker and preserves native inline styles", async () => {
  const f = fixture();
  f.card.setAttribute(RESIZING, "native-owner");
  const cardStyle = f.card.getAttribute("style");
  const wrapperStyle = f.wrapper.getAttribute("style");
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.change(); await f.settle();
    assert.equal(f.motions.length, 1);
    f.motions[0].animation.finish();
    await f.settle();
    assert.equal(f.card.getAttribute(RESIZING), "native-owner");
    assert.equal(f.card.getAttribute("style"), cardStyle);
    assert.equal(f.wrapper.getAttribute("style"), wrapperStyle);
  } finally { stop(); f.restore(); }
});

// Stop active animations and prevent queued microtasks or retained listeners from starting more work.
test("dispose cancels active card motion, restores markers and styles, and releases queued updates", async () => {
  const f = fixture();
  const parent = f.card.parentNode;
  const cardStyle = f.card.getAttribute("style");
  const wrapperStyle = f.wrapper.getAttribute("style");
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 360;
    f.change(); await f.settle();
    assert.equal(f.motions.length, 1);
    assert.ok(f.card.hasAttribute(RESIZING));
    f.state.naturalHeight = 418;
    f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
    stop();
    await f.settle();
    assert.equal(f.motions.length, 1, "queued measurements are ignored after disposal");
    assert.ok(f.motions[0].cancels > 0);
    assert.equal(f.card.hasAttribute(RESIZING), false);
    assert.equal(f.wrapper.hasAttribute(RESIZING), false);
    assert.equal(f.card.parentNode, parent);
    assert.equal(f.card.getAttribute("style"), cardStyle);
    assert.equal(f.wrapper.getAttribute("style"), wrapperStyle);
    for (const observer of f.mutations) assert.equal(observer.active, false);
    f.change();
    f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
    await f.settle();
    assert.equal(f.motions.length, 1);
    assert.equal(f.frames.size, 0);
  } finally { stop(); f.restore(); }
});

// Respect reduced motion before creating any visual interpolation.
test("prefers-reduced-motion suppresses card height animation", async () => {
  const f = fixture({ reducedMotion: true });
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.change();
    f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
    await f.settle();
    assert.equal(f.motions.length, 0);
    assert.equal(f.card.hasAttribute(RESIZING), false);
    assert.equal(f.frames.size, 0);
  } finally { stop(); f.restore(); }
});

// Apply a live accessibility preference change to an already running card transition.
test("enabling reduced motion cancels the active card motion and restores its marker", async () => {
  const f = fixture();
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.change(); await f.settle();
    assert.equal(f.motions.length, 1);
    f.reduce(); await f.settle();
    assert.ok(f.motions[0].cancels > 0);
    assert.equal(f.card.hasAttribute(RESIZING), false);
  } finally { stop(); f.restore(); }
});

// Animate the real card even when the host has no native positioning wrapper or ResizeObserver support.
test("card height motion works without a popper wrapper or ResizeObserver", async () => {
  const f = fixture({ wrapper: false, resizeObserver: false });
  const parent = f.card.parentNode;
  const stop = injectComposerModelSize(f.card);
  try {
    f.state.naturalHeight = 303;
    f.change(); await f.settle();
    assert.equal(f.motions.length, 1);
    assert.equal(f.motions[0].target, f.card);
    assert.deepEqual(values(f.motions[0], "height"), ["240px", "303px"]);
    assert.equal(f.card.parentNode, parent);
  } finally { stop(); f.restore(); }
});
