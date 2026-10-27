import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectComposerMenuGlass } from "./composer-menu-glass.ts";

const SOURCE = "data-bb-chat-ui-effort-source";
const RANGE = 'input[type="range"][aria-label="Effort"]';
const LABELS = ["Low", "Medium", "High", "Extra High"];

// Render native radio controls with the same accessible state as the host provider UI.
function radioMarkup(labels: string[], selected: number, disabled: number[] = []): string {
  let html = "";
  for (let index = 0; index < labels.length; index++) {
    html += `<button type="button" role="radio" aria-label="${labels[index]}" aria-checked="${index === selected}"${disabled.includes(index) ? " disabled" : ""}>${labels[index]}</button>`;
  }
  return html;
}

// Bind a small native host that updates checked state only when its radio is clicked.
function fixture(options: { selected?: number; labels?: string[]; disabled?: number[]; phone?: boolean } = {}) {
  const labels = options.labels ?? LABELS;
  const dom = new JSDOM(`<html${options.phone?' data-bb-chat-ui-root-device="phone"':''}><head></head><body>
    <button aria-haspopup="dialog" aria-label="Provider, model and reasoning: Codex" ${options.phone?'aria-expanded="true"':'aria-controls="provider-menu"'}>Model</button>
    <div role="dialog" id="provider-menu" data-bb-portaled-overlay ${options.phone?'data-persistent-drawer-content data-state="open" aria-labelledby="model-title"':''}>
      ${options.phone?'<div data-persistent-drawer-handle></div><h2 id="model-title" class="sr-only">Model</h2>':''}
      <div id="effort-section"><div>Reasoning</div><div role="radiogroup" aria-label="Reasoning" tabindex="0" data-native="preserve">${radioMarkup(labels, options.selected ?? 1, options.disabled)}</div></div>
    </div>
  </body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  // Keep reduced-motion probing deterministic for DOM behavior checks.
  dom.window.matchMedia = () => ({ matches: false } as MediaQueryList);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ["HTMLElement", "Element", "Node", "MutationObserver"] as const) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  }
  const card = document.getElementById("provider-menu")!;
  const clicks: number[] = [];
  // Resolve the current native group after the host replaces its controls.
  function group(): HTMLElement {
    return card.querySelector('[role="radiogroup"][aria-label="Reasoning"]')!;
  }
  // Read current native radio nodes rather than caching a prior provider render.
  function radios(): HTMLButtonElement[] {
    return Array.from(group().querySelectorAll('button[role="radio"]'));
  }
  // Emulate the host's state commit when its original radio receives a real click.
  function hostClick(event: Event): void {
    const target = (event.target as Element).closest<HTMLButtonElement>('button[role="radio"]');
    if (!target || !group().contains(target) || target.disabled) return;
    const controls = radios();
    clicks.push(controls.indexOf(target));
    for (const control of controls) control.setAttribute("aria-checked", String(control === target));
  }
  card.addEventListener("click", hostClick);
  // Read the augmented control and provide a useful failure if it was not installed.
  function range(): HTMLInputElement {
    const slider = card.querySelector<HTMLInputElement>(RANGE);
    assert.ok(slider, "the selected native reasoning group receives an Effort range");
    return slider;
  }
  // Flush both host and enhancement mutation delivery without a timer.
  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  // Restore globals and release this test's DOM and host event listener.
  function restore(): void {
    card.removeEventListener("click", hostClick);
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
  return { dom, document, card, clicks, group, radios, range, settle, restore };
}

test("phone model drawers share the desktop Effort waveform and preserve native selections", async () => {
  const labels=["Low","Medium","High","Extra High","Max","Ultra"];
  const f=fixture({phone:true,labels,selected:4,disabled:[2]});
  const parent=f.group().parentElement,radios=f.radios();
  const stop=injectComposerMenuGlass(f.document);
  try {
    const range=f.range();
    assert.equal(range.max,"5");
    assert.equal(range.value,"4");
    assert.equal(range.getAttribute("aria-valuetext"),"Max");
    assert.equal(f.card.querySelectorAll('[data-effort-tick]').length,73);
    assert.equal(f.group().parentElement,parent);
    assert.deepEqual(f.radios(),radios);
    assert.deepEqual(f.clicks,[],"mounting the phone UI must not change effort");
    range.value="1";range.dispatchEvent(new f.dom.window.Event("input",{bubbles:true}));await f.settle();
    range.dispatchEvent(new f.dom.window.KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}));await f.settle();
    assert.deepEqual(f.clicks,[1,3],"the shared controller skips disabled native options");
    f.card.setAttribute("data-state","closed");await f.settle();
    assert.equal(f.card.querySelector('[data-bb-chat-ui-effort]'),null);
    assert.equal(f.group().hasAttribute(SOURCE),false);
    range.dispatchEvent(new f.dom.window.KeyboardEvent("keydown",{key:"Home",bubbles:true}));
    assert.deepEqual(f.clicks,[1,3],"closed drawer releases the old controller");
    f.card.setAttribute("data-state","open");await f.settle();
    assert.equal(f.range().getAttribute("aria-valuetext"),"Extra High");
    assert.equal(f.card.querySelectorAll('[data-bb-chat-ui-effort]').length,1);
  } finally {stop();f.restore();}
});

test("phone effort follows provider rerenders through the same controller", async () => {
  const f=fixture({phone:true});
  const stop=injectComposerMenuGlass(f.document);
  try {
    f.range();
    f.group().innerHTML=radioMarkup(["Standard","Maximum"],1);
    await f.settle();
    assert.equal(f.range().max,"1");
    assert.equal(f.range().getAttribute("aria-valuetext"),"Maximum");
    stop();
    assert.equal(f.group().hasAttribute(SOURCE),false);
    assert.equal(f.card.querySelector('[data-bb-chat-ui-effort]'),null);
  } finally {stop();f.restore();}
});

// Advance the real waveform controller without depending on wall-clock timing.
function animationClock(f: ReturnType<typeof fixture>, reduced = false) {
  let now = 0, sequence = 0;
  const pending = new Map<number, FrameRequestCallback>();
  // Queue each requested visual frame until the test advances its clock.
  f.dom.window.requestAnimationFrame = callback => { pending.set(++sequence, callback); return sequence; };
  // Remove cancelled work so disposal can be checked at the animation boundary.
  f.dom.window.cancelAnimationFrame = id => { pending.delete(id); };
  // Use one clock for both wave impulses and frame integration.
  Object.defineProperty(f.dom.window.performance, "now", { value: () => now });
  // Supply the user's motion preference before the gauge mounts.
  f.dom.window.matchMedia = () => ({ matches: reduced } as MediaQueryList);
  // Deliver a deterministic animation frame and retain newly scheduled work.
  function advance(milliseconds = 16): void {
    now += milliseconds;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(now);
  }
  // Let the finite spring and ripple finish without leaving an idle animation loop.
  function finish(): void {
    for (let count = 0; count < 200 && pending.size; count++) advance();
    assert.equal(pending.size, 0, "the waveform stops scheduling frames when settled");
  }
  return { pending, advance, finish };
}

// Keep the scale fixed and carry interrupted pin motion smoothly to the final native step.
test("the compact waveform keeps tick positions fixed and settles interrupted pin motion", () => {
  const f = fixture();
  const clock = animationClock(f);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    const ticks = Array.from(f.card.querySelectorAll<HTMLElement>('[data-effort-tick]'));
    const pin = f.card.querySelector<HTMLElement>('[data-effort-pin]')!;
    assert.equal(ticks.length, 49, "the four-option waveform uses wider bar spacing");
    assert.equal(ticks.filter(tick => tick.hasAttribute('data-major')).length, LABELS.length,
      "every supported option retains its longer tick");
    const lefts = ticks.map(tick => tick.style.left);
    const resting = pin.style.transform;
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
    assert.equal(slider.value, "3", "the native selected value commits immediately");
    assert.equal(pin.style.transform, resting, "the pin starts from its visible position");
    clock.advance();
    const moving = pin.style.transform;
    assert.notEqual(moving, resting);
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    assert.equal(pin.style.transform, moving, "retargeting does not reset the moving pin");
    clock.finish();
    assert.equal(pin.style.transform, "translateX(0%)");
    assert.deepEqual(ticks.map(tick => tick.style.left), lefts);
    assert.deepEqual(f.clicks, [3, 0]);
  } finally { stop(); f.restore(); }
});

// Honor reduced motion and cancel pending work when a provider removes its gauge.
test("waveform motion respects reduced motion and is released on disposal", () => {
  for (const reduced of [false, true]) {
    const f = fixture();
    const clock = animationClock(f, reduced);
    const stop = injectComposerMenuGlass(f.document);
    try {
      const slider = f.range();
      const pin = f.card.querySelector<HTMLElement>('[data-effort-pin]')!;
      assert.ok(pin);
      slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
      if (reduced) {
        assert.equal(pin.style.transform, "translateX(100%)");
        assert.equal(clock.pending.size, 0);
      } else assert.equal(clock.pending.size, 1);
      stop();
      assert.equal(clock.pending.size, 0);
      clock.advance();
      assert.equal(f.card.querySelector('[data-effort-pin]'), null);
    } finally { stop(); f.restore(); }
  }
});

// Exercise the real pointer-to-step mapping on the fixed ruler rather than setting range values.
test("dragging the waveform maps its inset ruler to enabled native options", () => {
  const f = fixture({ disabled: [2] });
  const stop = injectComposerMenuGlass(f.document);
  try {
    const track = f.card.querySelector<HTMLElement>('[data-effort-track]')!;
    // Supply layout geometry that JSDOM cannot measure itself.
    track.getBoundingClientRect = () => ({ left: 10, width: 288 } as DOMRect);
    track.dispatchEvent(new f.dom.window.PointerEvent("pointerdown", { bubbles: true, isPrimary: true, button: 0, pointerId: 7, clientX: 114 }));
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointermove", { pointerId: 9, clientX: 274 }));
    assert.deepEqual(f.clicks, [], "another pointer cannot change the current effort");
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointermove", { pointerId: 7, clientX: 194 }));
    assert.deepEqual(f.clicks, [3], "the drag skips the disabled High option");
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointermove", { pointerId: 7, clientX: 34 }));
    assert.deepEqual(f.clicks, [3, 0]);
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointercancel", { pointerId: 7 }));
    assert.equal(f.range().value, "0");
    assert.equal(track.parentElement!.hasAttribute("data-dragging"), false);
  } finally { stop(); f.restore(); }
});

// Add an accessible gauge while leaving the provider's original controls in place.
test("the effort gauge starts at the native checked option without moving or deleting its source", () => {
  const f = fixture();
  const group = f.group();
  const parent = group.parentNode;
  const original = f.radios();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    assert.equal(slider.min, "0");
    assert.equal(slider.max, "3");
    assert.equal(slider.value, "1");
    assert.equal(slider.getAttribute("aria-valuetext"), "Medium");
    assert.ok(group.hasAttribute(SOURCE), "the original group is marked as the hidden source");
    assert.equal(group.parentNode, parent);
    assert.deepEqual(f.radios(), original, "native button identity and order remain intact");
    assert.deepEqual(f.clicks, [], "installing the gauge does not change provider settings");
  } finally { stop(); f.restore(); }
});

// Route pointer-style input through the host boundary and suppress duplicate settings writes.
test("input clicks the enabled native radio once and repeated values do not click again", async () => {
  const f = fixture();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    slider.value = "2";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [2]);
    assert.equal(f.radios()[2].getAttribute("aria-checked"), "true");
    assert.equal(slider.getAttribute("aria-valuetext"), "High");
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [2], "repeating the chosen value does not duplicate the native click");
  } finally { stop(); f.restore(); }
});

// Keep every drag target on a native step while preserving the active pointer's morph.
test("dragging keeps the indicator on native steps and pointercancel preserves the committed effort", async () => {
  const f = fixture();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    const gauge = slider.closest("[data-bb-chat-ui-effort]")!;
    slider.dispatchEvent(new f.dom.window.PointerEvent("pointerdown", { bubbles: true, isPrimary: true, button: 0, pointerId: 7 }));
    assert.ok(gauge.hasAttribute("data-dragging"));
    slider.value = "1.6";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.equal(slider.step, "1", "the range exposes discrete supported steps");
    assert.equal(slider.value, "2", "the visible thumb targets the selected native step during dragging");
    assert.equal(slider.getAttribute("aria-valuetext"), "High");
    assert.equal(f.radios()[2].getAttribute("aria-checked"), "true", "the host commits the nearest supported effort");
    assert.deepEqual(f.clicks, [2]);
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointerup", { pointerId: 9 }));
    await f.settle();
    assert.ok(gauge.hasAttribute("data-dragging"), "another pointer cannot end the active drag");
    assert.equal(slider.value, "2");
    f.dom.window.dispatchEvent(new f.dom.window.PointerEvent("pointercancel", { pointerId: 7 }));
    await f.settle();
    assert.equal(gauge.hasAttribute("data-dragging"), false);
    assert.equal(slider.value, "2", "cancellation settles the thumb at the host's committed option");
    assert.equal(slider.getAttribute("aria-valuetext"), "High");
    assert.deepEqual(f.clicks, [2], "ending the gesture does not repeat the settings write");
  } finally { stop(); f.restore(); }
});

// Match native range keyboard navigation while retaining host-owned radio updates.
test("arrow keys, Home, and End click the corresponding native effort options", async () => {
  const f = fixture();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    const moves = [["ArrowRight", 2], ["ArrowUp", 3], ["ArrowDown", 2], ["ArrowLeft", 1], ["Home", 0], ["End", 3]] as const;
    const expected: number[] = [];
    for (const [key, index] of moves) {
      slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      await f.settle();
      expected.push(index);
      assert.deepEqual(f.clicks, expected, `${key} reaches the original radio click handler`);
      assert.equal(f.radios()[index].getAttribute("aria-checked"), "true");
      assert.equal(slider.value, String(index));
      assert.equal(slider.getAttribute("aria-valuetext"), LABELS[index]);
    }
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    await f.settle();
    assert.deepEqual(f.clicks, expected, "a keyboard move to the current endpoint does not click again");
  } finally { stop(); f.restore(); }
});

// Snap drag requests to the nearest enabled radio instead of silently ignoring disabled values.
test("input skips disabled options and chooses the nearest enabled effort", async () => {
  const f = fixture({ selected: 0, disabled: [1, 2] });
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    slider.value = "2";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [3]);
    assert.equal(slider.value, "3");
    assert.equal(slider.getAttribute("aria-valuetext"), "Extra High");
    assert.equal(f.radios()[3].getAttribute("aria-checked"), "true");
  } finally { stop(); f.restore(); }
});

// Skip disabled interior options in each direction during keyboard navigation.
test("arrow keys skip disabled native effort options", async () => {
  const f = fixture({ selected: 0, disabled: [1, 2] });
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [3]);
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [3, 0]);
    assert.equal(slider.value, "0");
  } finally { stop(); f.restore(); }
});

// Reflect native unavailability instead of presenting an enabled gauge that cannot change state.
test("all disabled effort options disable the gauge and do not dispatch native clicks", async () => {
  const f = fixture({ disabled: [0, 1, 2, 3] });
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    assert.equal(slider.disabled, true);
    slider.value = "3";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    slider.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    await f.settle();
    assert.deepEqual(f.clicks, []);
  } finally { stop(); f.restore(); }
});

// Follow state changes produced by the host instead of retaining the gauge's previous value.
test("a native checked-state change updates the gauge value and accessible label", async () => {
  const f = fixture();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    const controls = f.radios();
    controls[1].setAttribute("aria-checked", "false");
    controls[3].setAttribute("aria-checked", "true");
    await f.settle();
    assert.equal(slider.value, "3");
    assert.equal(slider.getAttribute("aria-valuetext"), "Extra High");
    assert.deepEqual(f.clicks, [], "reading a host state change does not write it back");
  } finally { stop(); f.restore(); }
});

// Rebind to replacement native controls when a provider renders a different effort list.
test("re-rendered native options refresh the gauge bounds, label, and click targets", async () => {
  const f = fixture();
  const stop = injectComposerMenuGlass(f.document);
  try {
    f.range();
    const old = f.radios();
    f.group().innerHTML = radioMarkup(["Minimal", "Standard", "Maximum"], 2);
    await f.settle();
    const slider = f.range();
    assert.equal(slider.max, "2");
    assert.equal(slider.value, "2");
    assert.equal(slider.getAttribute("aria-valuetext"), "Maximum");
    slider.value = "0";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [0]);
    assert.equal(f.radios()[0].getAttribute("aria-checked"), "true");
    assert.equal(slider.getAttribute("aria-valuetext"), "Minimal");
    for (const radio of old) assert.equal(radio.isConnected, false, "the host's replaced nodes are not retained in the card");
  } finally { stop(); f.restore(); }
});

// Keep incomplete provider state on the native UI until it can be represented accurately.
test("a reasoning group without a checked option stays native", () => {
  const f = fixture({ selected: -1 });
  const original = f.group().outerHTML;
  const stop = injectComposerMenuGlass(f.document);
  try {
    assert.equal(f.card.querySelector(RANGE), null);
    assert.equal(f.group().outerHTML, original);
    assert.deepEqual(f.clicks, []);
  } finally { stop(); f.restore(); }
});

// A single native step uses the same ruler without inventing an adjustment.
for(const phone of [false,true])test(`a single-option provider keeps a centered one-step gauge (${phone?'phone':'desktop'})`,async()=>{
 const f=fixture({phone,labels:['High'],selected:0}),clock=animationClock(f),original=f.group().outerHTML,stop=injectComposerMenuGlass(f.document);
 try{
 const range=f.range(),gauge=range.closest('[data-bb-chat-ui-effort]'),pin=f.card.querySelector<HTMLElement>('[data-effort-pin]')!;
 assert.equal(range.min,'0');assert.equal(range.max,'0');assert.equal(range.value,'0');assert.equal(range.getAttribute('aria-valuetext'),'High');assert.equal(range.getAttribute('aria-readonly'),'true');assert.equal(pin.style.transform,'translateX(50%)');assert.equal(f.card.querySelectorAll('[data-effort-tick][data-major]').length,1);assert.equal(f.card.querySelector<HTMLElement>('[data-effort-label]')!.style.left,'50%');
 range.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.deepEqual(f.clicks,[]);
 f.group().innerHTML=radioMarkup(LABELS,2);await f.settle();assert.equal(f.range(),range);assert.equal(f.range().closest('[data-bb-chat-ui-effort]'),gauge);assert.equal(pin.style.transform,'translateX(50%)');assert.ok(clock.pending.size>0);clock.finish();assert.equal(pin.style.transform,`translateX(${2/3*100}%)`);assert.equal(range.getAttribute('aria-readonly'),'false');
 f.group().innerHTML=radioMarkup(['High'],0);await f.settle();assert.equal(f.range(),range);clock.finish();assert.equal(pin.style.transform,'translateX(50%)');assert.equal(f.card.querySelectorAll('[data-effort-label]').length,1);assert.deepEqual(f.clicks,[]);
 stop();assert.equal(f.group().outerHTML,original);assert.equal(f.card.querySelector('[data-effort-pin]'),null);
 }finally{stop();f.restore()}
});

// Release enhancement listeners and markers while preserving the host's original nodes and attributes.
test("dispose restores native effort markup and prevents detached gauge or observer writes", async () => {
  const f = fixture();
  const original = f.group().outerHTML;
  const controls = f.radios();
  const stop = injectComposerMenuGlass(f.document);
  try {
    const slider = f.range();
    stop();
    assert.equal(f.card.querySelector(RANGE), null);
    assert.equal(f.group().hasAttribute(SOURCE), false);
    assert.equal(f.group().outerHTML, original);
    assert.deepEqual(f.radios(), controls);
    slider.value = "3";
    slider.dispatchEvent(new f.dom.window.Event("input", { bubbles: true }));
    await f.settle();
    assert.deepEqual(f.clicks, [], "detached gauge listeners are released");
    controls[1].setAttribute("aria-checked", "false");
    controls[2].setAttribute("aria-checked", "true");
    await f.settle();
    assert.equal(f.card.querySelector(RANGE), null, "disposed observers cannot recreate the gauge");
    assert.equal(f.group().hasAttribute(SOURCE), false);
  } finally { stop(); f.restore(); }
});

for (const phone of [false,true]) test(`provider replacement keeps one Effort frame and animates High to its new position (${phone?'phone':'desktop'})`,async()=>{
 const f=fixture({phone,selected:2}),clock=animationClock(f),stop=injectComposerMenuGlass(f.document);
 try{
 const gauge=f.range().parentElement!.parentElement!,pin=f.card.querySelector<HTMLElement>('[data-effort-pin]')!,before=pin.style.transform;
 const high=[...f.card.querySelectorAll<HTMLElement>('[data-effort-label]')].find(n=>n.textContent==='High')!;
 const oldGroup=f.group();oldGroup.outerHTML='<div role="radiogroup" aria-label="Reasoning">'+radioMarkup(['Low','Medium','High'],2)+'</div>';await f.settle();
 assert.equal(f.range().parentElement!.parentElement,gauge,'native replacement retains the same gauge frame');assert.equal(f.card.querySelector('[data-effort-pin]'),pin);assert.equal(pin.style.transform,before,'changing counts starts at the visible selection');
 assert.ok(high.isConnected,'shared labels retain identity');assert.ok(clock.pending.size>0,'same selected index at a new count still moves');clock.advance();assert.notEqual(pin.style.transform,before);clock.finish();assert.equal(pin.style.transform,'translateX(100%)');assert.equal(high.style.left,'100%');assert.deepEqual(f.clicks,[],'provider display updates do not write settings');assert.equal(oldGroup.hasAttribute(SOURCE),false);
 const height=f.card.querySelector<HTMLElement>('[data-effort-tick]')!.style.height;f.group().innerHTML=radioMarkup(['Minimal','Standard','High'],2);await f.settle();assert.ok(clock.pending.size>0,'changed provider labels transition even at the same index and count');clock.finish();assert.equal(f.card.querySelector<HTMLElement>('[data-effort-tick]')!.style.height,height,'wave frames vary transform and opacity instead of layout height');
 stop();assert.equal(f.card.querySelector('[data-effort-pin]'),null);assert.equal(f.group().hasAttribute(SOURCE),false);assert.equal(clock.pending.size,0);
 }finally{stop();f.restore()}
});

test('provider changes transition even with identical Effort names and selection',async()=>{
 const f=fixture(),clock=animationClock(f);f.card.insertAdjacentHTML('afterbegin','<div><button title="A" aria-selected="true">A</button><button title="B" aria-selected="false">B</button></div>');const stop=injectComposerMenuGlass(f.document);
 try{const gauge=f.range().parentElement!.parentElement;f.card.querySelector('[title=A]')!.setAttribute('aria-selected','false');f.card.querySelector('[title=B]')!.setAttribute('aria-selected','true');await f.settle();assert.equal(f.range().parentElement!.parentElement,gauge);assert.ok(clock.pending.size>0);clock.advance();assert.ok(Number(f.card.querySelector<HTMLElement>('[data-effort-head]')!.style.opacity)<1);clock.finish();assert.equal(f.card.querySelector<HTMLElement>('[data-effort-head]')!.style.opacity,'1');assert.deepEqual(f.clicks,[])}finally{stop();f.restore()}
});
