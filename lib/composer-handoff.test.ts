import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectComposerHandoff, revealHandoffHeader } from "./composer-handoff.ts";

const MARKER = "data-bb-chat-ui-handoff-resizing";
const HEADER = '<div data-header-shell><div data-handoff-header><span>Handoff to new thread</span><button type="button" aria-label="Exit handoff">Exit</button></div></div>';
type Motion = { target: Element; frames: Keyframe[]; options: KeyframeAnimationOptions; cancels: number; plays: number; animation: Animation };

// Provide native composer heights, host content, and controllable browser observer and animation boundaries.
function fixture(options: { initialHandoff?: boolean; resizeObserver?: boolean; reduced?: boolean; height?: number; inlineHeight?: string } = {}) {
  const dom = new JSDOM(`<html><head></head><body><section style="transform: translate(24px, 500px);"><form id="composer" data-promptbox style="min-height: 0px;">${options.initialHandoff ? HEADER : ""}<div contenteditable="true" data-draft>Original draft</div><div data-tokens>10</div></form><form id="other" data-promptbox><div contenteditable="true">Other draft</div></form></section></body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  const composer = document.getElementById("composer") as HTMLElement;
  const other = document.getElementById("other") as HTMLElement;
  const wrapper = composer.parentElement!;
  const editor = composer.querySelector<HTMLElement>("[data-draft]")!;
  const state = { natural: options.height ?? (options.initialHandoff ? 176 : 116), visible: 116, reads: 0, otherNatural: 116, otherVisible: 116, reduced: Boolean(options.reduced) };
  const motions: Motion[] = [];
  const sizes: SizeObserver[] = [];
  const mutations: TrackedMutation[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  if (options.inlineHeight) composer.style.height = options.inlineHeight;
  // Expose the visible interpolation until cancellation reveals the current natural composer size.
  function measured(node: Element): number {
    if (node === composer) state.reads++;
    for (const motion of motions) {
      if (motion.target === node && motion.frames.some(frame => frame.height !== undefined) && motion.animation.playState === "running") return node === composer ? state.visible : state.otherVisible;
    }
    return node === composer ? state.natural : state.otherNatural;
  }
  // Resolve the main form's actual layout height at the moment it is measured.
  Object.defineProperty(composer, "offsetHeight", { get: () => measured(composer) });
  // Keep a second native form independent from the primary composer.
  Object.defineProperty(other, "offsetHeight", { get: () => measured(other) });
  // Expose the main composer's current rendered height through its DOM rectangle.
  composer.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: measured(composer), width: 400, height: measured(composer), toJSON() {} });
  const mediaEvents = new dom.window.EventTarget();
  const media = {
    // Return the current operating-system motion preference.
    get matches() { return state.reduced; },
    addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
  } as unknown as MediaQueryList;
  // Share the preference with the implementation and the common motion helpers.
  dom.window.matchMedia = () => media;
  // Record forbidden deferred paints without advancing their callbacks.
  dom.window.requestAnimationFrame = callback => { const id = ++serial; frames.set(id, callback); return id; };
  // Allow cleanup to cancel any pending paint work.
  dom.window.cancelAnimationFrame = id => { frames.delete(id); };
  class SizeObserver {
    callback: ResizeObserverCallback;
    targets = new Set<Element>();
    // Retain the native observer callback for explicit idle-size cache updates.
    constructor(callback: ResizeObserverCallback) { this.callback = callback; sizes.push(this); }
    // Track the composer owned by this observer.
    observe(target: Element): void { this.targets.add(target); }
    // Release observed nodes when their form is disposed.
    disconnect(): void { this.targets.clear(); }
    // Release one observed node without affecting independent forms.
    unobserve(target: Element): void { this.targets.delete(target); }
  }
  class TrackedMutation extends dom.window.MutationObserver {
    active = false;
    // Use real DOM mutation delivery while tracking observer lifetime.
    constructor(callback: MutationCallback) { super(callback); mutations.push(this); }
    // Activate form-scoped native mutation observation.
    observe(target: Node, config?: MutationObserverInit): void { this.active = true; super.observe(target, config); }
    // Disconnect all provider DOM updates on unload.
    disconnect(): void { this.active = false; super.disconnect(); }
  }
  // Record each height or header reveal motion without waiting for a browser clock.
  function animate(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null, timing?: number | KeyframeAnimationOptions): Animation {
    const events = new dom.window.EventTarget();
    const motion = { target: this, frames: keyframes as Keyframe[], options: typeof timing === "number" ? { duration: timing } : timing ?? {}, cancels: 0, plays: 0 } as Motion;
    const animation = {
      playState: "running", currentTime: 0 as number | null, playbackRate: 1,
      onfinish: null as ((event: Event) => void) | null,
      oncancel: null as ((event: Event) => void) | null,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      // Reveal natural layout while recording cancellation of the old visual state.
      cancel() { motion.cancels++; animation.playState = "idle"; animation.currentTime = null; const event = new dom.window.Event("cancel"); events.dispatchEvent(event); animation.oncancel?.(event); },
      // Resume this same interpolation after a repeated target measurement.
      play() { motion.plays++; animation.playState = "running"; if (animation.currentTime === null) animation.currentTime = 0; },
      // Support the equivalent WAAPI playback-rate API.
      updatePlaybackRate(rate: number) { animation.playbackRate = rate; },
      // Complete a transition and deliver its native finish callback synchronously.
      finish() { animation.playState = "finished"; const event = new dom.window.Event("finish"); events.dispatchEvent(event); animation.onfinish?.(event); },
    };
    motion.animation = animation as unknown as Animation;
    motions.push(motion);
    return motion.animation;
  }
  dom.window.HTMLElement.prototype.animate = animate;
  Object.defineProperty(dom.window, "ResizeObserver", { configurable: true, value: options.resizeObserver === false ? undefined : SizeObserver });
  Object.defineProperty(dom.window, "MutationObserver", { configurable: true, value: TrackedMutation });
  const globals = { ResizeObserver: options.resizeObserver === false ? undefined : SizeObserver, MutationObserver: TrackedMutation, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, matchMedia: dom.window.matchMedia.bind(dom.window), requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), getComputedStyle: dom.window.getComputedStyle.bind(dom.window) };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  // Insert the host's real Handoff header while preserving the editor and draft nodes.
  function show(surface: HTMLElement = composer): HTMLElement {
    surface.insertAdjacentHTML("afterbegin", HEADER);
    return surface.querySelector<HTMLElement>("[data-handoff-header]")!;
  }
  // Remove the host's Handoff header when the user leaves this mode.
  function hide(surface: HTMLElement = composer): void { surface.querySelector("[data-header-shell]")?.remove(); }
  // Deliver an idle size update without forcing the implementation to read layout on each input.
  function resize(target: HTMLElement = composer): void {
    for (const observer of sizes) {
      if (!observer.targets.has(target)) continue;
      const height = target === composer ? state.natural : state.otherNatural;
      observer.callback([{ target, contentRect: { height }, borderBoxSize: [{ blockSize: height, inlineSize: 400 }], contentBoxSize: [{ blockSize: height, inlineSize: 400 }] } as ResizeObserverEntry], observer as unknown as ResizeObserver);
    }
  }
  // Flush DOM observers and transition microtasks before any browser paint.
  async function settle(): Promise<void> { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
  // Trigger a live reduced-motion preference change during an active transition.
  function reduce(): void { state.reduced = true; mediaEvents.dispatchEvent(new dom.window.Event("change")); }
  // Restore host globals and release the fixture's native DOM.
  function restore(): void {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
  return { dom, document, composer, other, wrapper, editor, state, motions, sizes, mutations, frames, show, hide, resize, settle, reduce, restore };
}

// Select only motions that change the visible composer height.
function heightMotions(motions: Motion[]): Motion[] {
  return motions.filter(motion => motion.frames.some(frame => frame.height !== undefined));
}

// Preserve the initial screen regardless of whether Handoff was already active.
// Verify initial normal and existing Handoff composers mount without height or header reveal motion.
test("initial normal and existing Handoff composers mount without height or header reveal motion", async () => {
  for (const initialHandoff of [false, true]) {
    const f = fixture({ initialHandoff });
    const original = f.composer.outerHTML;
    const stop = injectComposerHandoff(f.composer);
    try { await f.settle(); assert.equal(f.motions.length, 0); assert.equal(f.composer.outerHTML, original); }
    finally { stop(); f.restore(); }
  }
});

// Synchronize header appearance with the real composer's 160ms height transition before the next paint.
// Verify entering Handoff morphs the composer 116 to 176 and reveals only the Exit handoff header parent.
test("entering Handoff morphs the composer 116 to 176 and reveals only the Exit handoff header parent", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    const header = f.show();
    await f.settle();
    const heights = heightMotions(f.motions);
    assert.equal(heights.length, 1);
    assert.equal(heights[0].target, f.composer);
    assert.deepEqual(heights[0].frames, [{ height: "116px" }, { height: "176px" }]);
    assert.equal(heights[0].options.duration, 320);
    assert.equal(heights[0].animation.playbackRate, 2);
    assert.ok(f.composer.hasAttribute(MARKER));
    const reveals = f.motions.filter(motion => motion.target === header);
    assert.equal(reveals.length, 1);
    assert.equal(reveals[0].options.duration, 260);
    assert.equal(reveals[0].animation.playbackRate, 1.625);
    assert.equal(f.frames.size, 0);
    assert.equal(f.wrapper.hasAttribute(MARKER), false);
  } finally { stop(); f.restore(); }
});

// Use an observer-maintained idle height instead of a stale installation height.
// Verify the ResizeObserver idle-height cache supplies the next Handoff transition start.
test("the ResizeObserver idle-height cache supplies the next Handoff transition start", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 130;
    f.resize(); await f.settle();
    assert.equal(f.motions.length, 0);
    f.state.natural = 190;
    f.show(); await f.settle();
    assert.deepEqual(heightMotions(f.motions)[0]?.frames, [{ height: "130px" }, { height: "190px" }]);
  } finally { stop(); f.restore(); }
});

// Ignore input and token changes while Handoff presence remains unchanged.
// Verify idle draft and token updates do not force composer height measurements or animations.
test("idle draft and token updates do not force composer height measurements or animations", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    const reads = f.state.reads;
    f.editor.textContent = "A longer user draft";
    f.composer.querySelector("[data-tokens]")!.textContent = "1024";
    f.editor.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.equal(f.state.reads, reads);
    assert.equal(f.motions.length, 0);
    assert.equal(f.editor.textContent, "A longer user draft");
  } finally { stop(); f.restore(); }
});

// Preserve transition progress when native DOM updates leave the target height unchanged.
// Verify additional DOM changes reuse the same active animation and restore its currentTime.
test("additional DOM changes reuse the same active animation and restore its currentTime", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    const first = heightMotions(f.motions)[0];
    assert.ok(first);
    first.animation.currentTime = 72;
    f.state.visible = 148;
    f.editor.append(f.document.createElement("span"));
    await f.settle();
    assert.equal(heightMotions(f.motions).length, 1);
    assert.ok(first.cancels > 0);
    assert.equal(first.plays, 1);
    assert.equal(first.animation.currentTime, 72);
  } finally { stop(); f.restore(); }
});

// Retarget a toggled mode at the current visible composer height and stop the removed header's fade.
// Verify leaving Handoff during entry retargets from the visible height and cancels the header reveal.
test("leaving Handoff during entry retargets from the visible height and cancels the header reveal", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    const header = f.show(); await f.settle();
    const first = heightMotions(f.motions)[0];
    assert.ok(first);
    f.state.visible = 148;
    f.state.natural = 116;
    f.hide(); await f.settle();
    const heights = heightMotions(f.motions);
    assert.equal(heights.length, 2);
    assert.ok(first.cancels > 0);
    assert.deepEqual(heights[1].frames, [{ height: "148px" }, { height: "116px" }]);
    assert.ok(f.motions.find(motion => motion.target === header)!.cancels > 0);
  } finally { stop(); f.restore(); }
});

// Track compact-layout changes delivered on the native form while its height is transitioning.
// Verify a compact-state change retargets an active Handoff transition from its visible height.
test("a compact-state change retargets an active Handoff transition from its visible height", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    assert.equal(heightMotions(f.motions).length, 1);
    f.state.visible = 148;
    f.state.natural = 156;
    f.composer.setAttribute("data-promptbox-compact", "");
    await f.settle();
    assert.deepEqual(heightMotions(f.motions)[1]?.frames, [{ height: "148px" }, { height: "156px" }]);
  } finally { stop(); f.restore(); }
});

// Respect native height ownership rather than adding a second height interpolation.
// Verify a native inline height suppresses enhancement height motion.
test("a native inline height suppresses enhancement height motion", async () => {
  const f = fixture({ inlineHeight: "176px" });
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    assert.equal(heightMotions(f.motions).length, 0);
    assert.equal(f.composer.style.height, "176px");
    assert.equal(f.composer.hasAttribute(MARKER), false);
  } finally { stop(); f.restore(); }
});

// Yield immediately when the native host starts controlling height during an enhancement transition.
// Verify setting native inline height cancels the active enhancement height motion.
test("setting native inline height cancels the active enhancement height motion", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    const motion = heightMotions(f.motions)[0];
    assert.ok(motion);
    f.composer.style.height = "180px";
    await f.settle();
    assert.ok(motion.cancels > 0);
    assert.equal(heightMotions(f.motions).length, 1);
    assert.equal(f.composer.style.height, "180px");
    assert.equal(f.composer.hasAttribute(MARKER), false);
  } finally { stop(); f.restore(); }
});

// Restore the original clipping marker as soon as a transition finishes.
// Verify finishing a Handoff transition restores a pre-existing composer marker.
test("finishing a Handoff transition restores a pre-existing composer marker", async () => {
  const f = fixture();
  f.composer.setAttribute(MARKER, "existing-owner");
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    assert.equal(heightMotions(f.motions).length, 1);
    heightMotions(f.motions)[0].animation.finish();
    await f.settle();
    assert.equal(f.composer.getAttribute(MARKER), "existing-owner");
  } finally { stop(); f.restore(); }
});

// Keep each form's observer cache and Handoff transition independent in the same document.
// Verify independent composer forms animate only their own Handoff changes.
test("independent composer forms animate only their own Handoff changes", async () => {
  const f = fixture();
  const firstStop = injectComposerHandoff(f.composer);
  const otherStop = injectComposerHandoff(f.other);
  try {
    f.state.otherNatural = 176;
    f.show(f.other); await f.settle();
    const heights = heightMotions(f.motions);
    assert.equal(heights.length, 1);
    assert.equal(heights[0].target, f.other);
    assert.equal(f.composer.hasAttribute(MARKER), false);
  } finally { firstStop(); otherStop(); f.restore(); }
});

// Release transition work while preserving native draft, DOM position, and inline styles.
// Verify dispose cancels motions and queued updates, restores markers, and preserves native composer state.
test("dispose cancels motions and queued updates, restores markers, and preserves native composer state", async () => {
  const f = fixture();
  const parent = f.composer.parentNode;
  const style = f.composer.getAttribute("style");
  const wrapperStyle = f.wrapper.getAttribute("style");
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    assert.equal(heightMotions(f.motions).length, 1);
    f.editor.textContent = "User's retained draft";
    stop(); await f.settle();
    for (const motion of f.motions) assert.ok(motion.cancels > 0);
    assert.equal(f.composer.hasAttribute(MARKER), false);
    assert.equal(f.composer.parentNode, parent);
    assert.equal(f.composer.getAttribute("style"), style);
    assert.equal(f.wrapper.getAttribute("style"), wrapperStyle);
    assert.equal(f.composer.querySelector("[data-draft]"), f.editor);
    assert.equal(f.editor.textContent, "User's retained draft");
    for (const size of f.sizes) assert.equal(size.targets.size, 0);
    for (const mutation of f.mutations) assert.equal(mutation.active, false);
    const count = f.motions.length;
    f.hide(); f.resize(); await f.settle();
    assert.equal(f.motions.length, count);
    assert.equal(f.frames.size, 0);
  } finally { stop(); f.restore(); }
});

// Honor reduced motion and avoid interpolating an unmeasurable initial height.
// Verify reduced motion and a zero-height composer do not create Handoff height animations.
test("reduced motion and a zero-height composer do not create Handoff height animations", async () => {
  for (const options of [{ reduced: true }, { height: 0 }]) {
    const f = fixture(options);
    const stop = injectComposerHandoff(f.composer);
    try {
      f.state.natural = 176;
      f.show(); await f.settle();
      assert.equal(heightMotions(f.motions).length, 0);
      if (options.reduced) assert.equal(f.motions.length, 0);
      assert.equal(f.composer.hasAttribute(MARKER), false);
    } finally { stop(); f.restore(); }
  }
});

// Stop both height and header entrance motion if the user enables reduced motion while entering Handoff.
// Verify enabling reduced motion cancels active Handoff motions.
test("enabling reduced motion cancels active Handoff motions", async () => {
  const f = fixture();
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    f.show(); await f.settle();
    assert.equal(heightMotions(f.motions).length, 1);
    f.reduce(); await f.settle();
    for (const motion of f.motions) assert.ok(motion.cancels > 0);
    assert.equal(f.composer.hasAttribute(MARKER), false);
  } finally { stop(); f.restore(); }
});

// Keep unsupported browser hosts on their existing native composer sizing path.
// Verify missing ResizeObserver leaves native Handoff DOM and height unchanged.
test("missing ResizeObserver leaves native Handoff DOM and height unchanged", async () => {
  const f = fixture({ resizeObserver: false });
  const stop = injectComposerHandoff(f.composer);
  try {
    f.state.natural = 176;
    const header = f.show(); await f.settle();
    assert.equal(f.motions.length, 0);
    assert.equal(f.composer.hasAttribute(MARKER), false);
    assert.equal(header.parentNode, f.composer.querySelector("[data-header-shell]"));
  } finally { stop(); f.restore(); }
});

// Reuse the exact header entrance motion on a model-selector popup without animating its whole surface.
// Verify revealHandoffHeader animates only the Exit handoff button parent for 160ms.
test("revealHandoffHeader animates only the Exit handoff button parent for 160ms", () => {
  const f = fixture();
  try {
    const popup = f.document.createElement("div");
    popup.setAttribute("role", "dialog");
    f.document.body.append(popup);
    const header = f.show(popup);
    const animation = revealHandoffHeader(popup);
    assert.ok(animation);
    assert.equal(f.motions.length, 1);
    assert.equal(f.motions[0].target, header);
    assert.equal(f.motions[0].options.duration, 260);
    assert.equal(animation.playbackRate, 1.625);
    assert.equal(f.motions[0].frames[0].opacity, 0);
    assert.equal(f.motions[0].frames.at(-1)!.opacity, 1);
    assert.equal(revealHandoffHeader(f.other), null);
    animation.cancel();
  } finally { f.restore(); }
});
