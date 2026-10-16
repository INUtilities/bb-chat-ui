import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import {
  IDLE_SEND_HAPTIC,
  acceptJumpPulse,
  injectSendHaptic,
  isFileDiffBlockToggle,
  postHaptic,
  postSendHaptic,
  readHapticBridge,
  hasNewAssistantOutput,
  openResponseWatch,
  isStopRunButton,
  reduceResponseWatch,
  reduceSendHaptic,
  shineMeansAgentResponse,
} from "./send-haptic.ts";

test("pulses once when a pressed send finishes", () => {
  const pressed = reduceSendHaptic(IDLE_SEND_HAPTIC, "press");
  assert.equal(pressed.pulse, false);
  const busy = reduceSendHaptic(pressed.state, "busy");
  assert.equal(busy.pulse, false);
  const done = reduceSendHaptic(busy.state, "idle");
  assert.equal(done.pulse, true);
  assert.equal(reduceSendHaptic(done.state, "timeout").pulse, false);
});

test("pulses when the press finishes without a busy flag", () => {
  const pressed = reduceSendHaptic(IDLE_SEND_HAPTIC, "press");
  const done = reduceSendHaptic(pressed.state, "timeout");
  assert.equal(done.pulse, true);
  assert.equal(reduceSendHaptic(done.state, "idle").pulse, false);
});

test("stays quiet until the send button is pressed", () => {
  assert.equal(reduceSendHaptic(IDLE_SEND_HAPTIC, "idle").pulse, false);
  assert.equal(reduceSendHaptic(IDLE_SEND_HAPTIC, "timeout").pulse, false);
  assert.equal(reduceSendHaptic(IDLE_SEND_HAPTIC, "busy").pulse, false);
});

test("posts a soft selection haptic only when the shell can buzz", () => {
  const messages: unknown[] = [];
  const bridge = {
    capabilities: ["haptic"],
    post(message: unknown) {
      messages.push(message);
    },
  };
  assert.equal(postSendHaptic(bridge), true);
  assert.deepEqual(messages, [{ type: "haptic", kind: "selection" }]);
  assert.equal(postSendHaptic(null), false);
  assert.equal(
    postSendHaptic({
      capabilities: ["badge"],
      post() {},
    }),
    false,
  );
  assert.deepEqual(messages, [{ type: "haptic", kind: "selection" }]);
});

test("stays quiet when assistant text appears and pulses when the response ends", () => {
  assert.equal(hasNewAssistantOutput(["old"], new Set(["old"])), false);
  assert.equal(hasNewAssistantOutput(["old", "new"], new Set(["old"])), true);
  assert.deepEqual(
    openResponseWatch({ respondingAtPress: false, hasNewOutput: false }),
    { phase: "wait-output", sawWorking: false, pulse: null },
  );
  assert.deepEqual(
    openResponseWatch({ respondingAtPress: true, hasNewOutput: true }),
    { phase: "wait-finish", sawWorking: true, pulse: null },
  );
  const workingOnly = reduceResponseWatch(
    { phase: "wait-output", sawWorking: false },
    true,
    false,
  );
  assert.equal(workingOnly.pulse, null);
  assert.deepEqual(workingOnly.watch, {
    phase: "wait-output",
    sawWorking: true,
  });
  const started = reduceResponseWatch(
    { phase: "wait-output", sawWorking: true },
    true,
    true,
  );
  assert.equal(started.pulse, null);
  assert.deepEqual(started.watch, { phase: "wait-finish", sawWorking: true });
  const finished = reduceResponseWatch(
    { phase: "wait-finish", sawWorking: true },
    false,
    true,
  );
  assert.equal(finished.pulse, "finish");
  assert.equal(finished.watch, null);
  assert.deepEqual(
    reduceResponseWatch({ phase: "wait-finish", sawWorking: true }, true, true),
    { watch: { phase: "wait-finish", sawWorking: true }, pulse: null },
  );
});

test("reads only a visible working or thinking label as the agent response", () => {
  assert.equal(shineMeansAgentResponse("Working...", []), true);
  assert.equal(shineMeansAgentResponse("Thinking…", ["1"]), true);
  assert.equal(shineMeansAgentResponse("Working...", ["1", "0"]), false);
  assert.equal(shineMeansAgentResponse("Provisioning thread...", []), false);
  assert.equal(shineMeansAgentResponse("Background work running", []), false);
  assert.equal(shineMeansAgentResponse(null, []), false);
});

test("pulses a light impact for the jump button, once per press", () => {
  const messages: unknown[] = [];
  const bridge = {
    capabilities: ["haptic"],
    post(message: unknown) {
      messages.push(message);
    },
  };
  assert.equal(postHaptic(bridge, "impact-light"), true);
  assert.deepEqual(messages, [{ type: "haptic", kind: "impact-light" }]);
  assert.equal(acceptJumpPulse(null, 1000), 1000);
  assert.equal(acceptJumpPulse(1000, 1100), null);
  assert.equal(acceptJumpPulse(1000, 1400), 1400);
});

test("recognizes the composer stop button", () => {
  const stop = pressable("Stop run", null, false);
  const icon = { closest: (selector: string) => (selector === "button" ? stop : null) };
  assert.equal(isStopRunButton(stop), true);
  assert.equal(isStopRunButton(icon), true);
  assert.equal(isStopRunButton(pressable("Stop run", null, true)), false);
  assert.equal(isStopRunButton(pressable("Stop and transcribe recording", null, false)), false);
  assert.equal(isStopRunButton(pressable("Send", null, false)), false);
  assert.equal(isStopRunButton(null), false);
});

test("buzzes once when the stop button is pressed", () => {
  const messages: unknown[] = [];
  const listeners = new Map<string, Array<(event: Event) => void>>();
  const document = {
    body: {},
    defaultView: {
      bb: {
        native: {
          capabilities: ["haptic"],
          post(message: unknown) {
            messages.push(message);
          },
        },
      },
      performance: { now: () => 1000 },
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener() {},
  };
  const originalObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof MutationObserver;

  try {
    const cleanup = injectSendHaptic(document as unknown as Document);
    const stop = pressable("Stop run", null, false);
    const click = listeners.get("click")?.[0];
    const pointerup = listeners.get("pointerup")?.[0];
    click?.({ target: stop } as unknown as Event);
    pointerup?.({
      target: stop,
      pointerType: "touch",
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    } as unknown as Event);
    assert.deepEqual(messages, [{ type: "haptic", kind: "selection" }]);
    cleanup();
  } finally {
    globalThis.MutationObserver = originalObserver;
  }
});

test("recognizes a file diff code block toggle", () => {
  const toggle = pressable("Collapse src/app.ts", "true", false);
  const icon = { closest: (selector: string) => (selector === "button" ? toggle : null) };
  assert.equal(isFileDiffBlockToggle(toggle), true);
  assert.equal(isFileDiffBlockToggle(icon), true);
  assert.equal(isFileDiffBlockToggle(pressable("Expand src/app.ts", "false", false)), true);
  assert.equal(isFileDiffBlockToggle(pressable("Collapse src/app.ts", "true", true)), false);
  assert.equal(isFileDiffBlockToggle(pressable("Expand all files", null, false)), false);
  assert.equal(
    isFileDiffBlockToggle(pressable("src/app.ts has no changes to expand", null, true)),
    false,
  );
  assert.equal(isFileDiffBlockToggle(null), false);
});

test("buzzes once when a file diff block is toggled", () => {
  const messages: unknown[] = [];
  const listeners = new Map<string, Array<(event: Event) => void>>();
  const document = {
    body: {},
    defaultView: {
      bb: {
        native: {
          capabilities: ["haptic"],
          post(message: unknown) {
            messages.push(message);
          },
        },
      },
      performance: { now: () => 1000 },
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener() {},
  };
  const originalObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof MutationObserver;

  try {
    const cleanup = injectSendHaptic(document as unknown as Document);
    const toggle = pressable("Expand src/app.ts", "false", false);
    const click = listeners.get("click")?.[0];
    const pointerup = listeners.get("pointerup")?.[0];
    click?.({ target: toggle } as unknown as Event);
    pointerup?.({ target: toggle, pointerType: "touch", isPrimary: true } as unknown as Event);
    assert.deepEqual(messages, [{ type: "haptic", kind: "impact-light" }]);
    cleanup();
  } finally {
    globalThis.MutationObserver = originalObserver;
  }
});

function pressable(label: string | null, expanded: string | null, disabled: boolean) {
  const button = {
    getAttribute(name: string) {
      if (name === "aria-label") return label;
      if (name === "aria-expanded") return expanded;
      if (name === "disabled") return disabled ? "" : null;
      return null;
    },
    closest(selector: string) {
      return selector === "button" ? button : null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 40, bottom: 40 };
    },
  };
  return button;
}

test("reads the native bridge from the page", () => {
  const native = { capabilities: ["haptic"], post() {} };
  assert.equal(readHapticBridge({ bb: { native } }), native);
  assert.equal(readHapticBridge({}), null);
  assert.equal(readHapticBridge({ bb: { native: {} } }), null);
});

test("all composer information controls buzz once per user activation, including rapid changes", t => {
  const dom = new JSDOM(`<div data-bb-chat-ui-info-bar>
    <button data-bb-chat-ui-info-trigger="diff"><span>Diff</span></button>
    <button data-bb-chat-ui-info-trigger="children">Children</button>
    <button data-bb-chat-ui-info-trigger="annotations">Annotations</button>
    <button data-bb-chat-ui-info-trigger="goal">Goal</button>
    <button data-bb-chat-ui-info-all>All</button>
    <section data-bb-chat-ui-info-menu><button data-bb-chat-ui-info-choice="queue">Queue</button><button aria-label="Close">×</button></section>
    <button disabled>Disabled</button><button aria-disabled="true">Unavailable</button>
  </div><div data-bb-chat-ui-info-unit data-bb-chat-ui-info-open>
    <button aria-label="Collapse staged annotations" aria-expanded="true">×</button><button>Send all</button>
  </div><button>Unrelated</button>`);
  const originalElement = globalThis.Element;
  const originalButton = globalThis.HTMLButtonElement;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  t.after(() => { globalThis.Element = originalElement; globalThis.HTMLButtonElement = originalButton; dom.window.close(); });
  const messages: unknown[] = [];
  Object.assign(dom.window, { bb:{ native:{ capabilities:["haptic"], post:(message:unknown) => messages.push(message) } } });
  const listeners = new Map<string, (event:Event) => void>();
  const document = {
    body:null, defaultView:dom.window,
    addEventListener:(type:string, listener:(event:Event) => void) => listeners.set(type, listener),
    removeEventListener:(type:string) => listeners.delete(type),
  } as unknown as Document;
  const stop = injectSendHaptic(document);
  t.after(stop);
  const controls = dom.window.document.querySelectorAll('button:not([disabled]):not([aria-disabled])');
  const active = [...controls].filter(button => button.closest('[data-bb-chat-ui-info-bar], [data-bb-chat-ui-info-unit]'));
  for (const button of active) {
    const target = button.firstElementChild ?? button;
    listeners.get('pointerup')!({ target, isPrimary:true, pointerType:'touch' } as unknown as Event);
    listeners.get('click')!({ target, isTrusted:true } as unknown as Event);
    assert.equal(messages.length, active.indexOf(button) + 1);
    // Composer disclosures forward a synthetic click to their original host button.
    listeners.get('click')!({ target, isTrusted:false } as unknown as Event);
    assert.equal(messages.length, active.indexOf(button) + 1);
  }
  for (const button of dom.window.document.querySelectorAll('button[disabled], button[aria-disabled], body > button')) {
    listeners.get('click')!({ target:button, isTrusted:true } as unknown as Event);
  }
  assert.deepEqual(messages, active.map(() => ({ type:'haptic', kind:'impact-light' })));
  listeners.get('click')!({ target:active[0], isTrusted:true, detail:0 } as unknown as Event);
  assert.equal(messages.length, active.length + 1, 'keyboard activation also pulses');
  Object.assign(dom.window, { bb:{ native:{ capabilities:[], post:(message:unknown) => messages.push(message) } } });
  listeners.get('click')!({ target:active[0], isTrusted:true } as unknown as Event);
  assert.equal(messages.length, active.length + 1, 'unsupported shells stay quiet');
  stop();
  assert.equal(listeners.size, 0);
});

test("composer question controls buzz once per activation without affecting native answers", t => {
  const ids = ['tool-use-ask', 'plugin-request-banner', 'user-question-banner'];
  const dom = new JSDOM(`<div data-bb-chat-ui-info-stack>${ids.map(id => `<section data-testid="${id}">
    <button><span>Option</span></button><button>Next</button><button>Submit</button>
    <button aria-label="Expand question" aria-expanded="false">Expand</button><button aria-label="Collapse question" aria-expanded="true">Collapse</button>
    <button disabled>Disabled</button><button aria-disabled="true">Unavailable</button><textarea>Answer</textarea>
  </section>`).join('')}</div><section data-testid="tool-use-ask"><button>Past question</button></section><button>Unrelated</button>`);
  const originalElement = globalThis.Element;
  const originalButton = globalThis.HTMLButtonElement;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  t.after(() => { globalThis.Element = originalElement; globalThis.HTMLButtonElement = originalButton; dom.window.close(); });
  const messages: unknown[] = [];
  Object.assign(dom.window, { bb:{ native:{ capabilities:['haptic'], post:(message:unknown) => messages.push(message) } } });
  const listeners = new Map<string, (event:Event) => void>();
  const document = {
    body:null, defaultView:dom.window,
    addEventListener:(type:string, listener:(event:Event) => void) => listeners.set(type, listener),
    removeEventListener:(type:string) => listeners.delete(type),
  } as unknown as Document;
  const stop = injectSendHaptic(document);
  t.after(stop);
  const active = [...dom.window.document.querySelectorAll('[data-bb-chat-ui-info-stack] button:not([disabled]):not([aria-disabled])')];
  let answers = 0;
  for (const button of active) {
    const target = button.firstElementChild ?? button;
    const parent = button.parentElement;
    button.addEventListener('click', () => answers++);
    listeners.get('pointerup')!({ target, isPrimary:true, pointerType:'touch' } as unknown as Event);
    listeners.get('click')!({ target, isTrusted:true } as unknown as Event);
    assert.equal(messages.length, active.indexOf(button) + 1);
    button.click(); // Native and forwarded synthetic clicks keep their action, without another pulse.
    listeners.get('click')!({ target, isTrusted:false } as unknown as Event);
    assert.equal(button.parentElement, parent);
    assert.equal(messages.length, active.indexOf(button) + 1);
  }
  assert.equal(answers, active.length);
  assert.deepEqual(messages, active.map(() => ({ type:'haptic', kind:'selection' })));
  for (const target of dom.window.document.querySelectorAll('button[disabled], button[aria-disabled], body > section button, body > button, textarea')) {
    listeners.get('click')!({ target, isTrusted:true } as unknown as Event);
  }
  assert.equal(messages.length, active.length, 'disabled, unrelated and input interactions stay quiet');
  listeners.get('click')!({ target:active[0], isTrusted:true, detail:0 } as unknown as Event);
  assert.equal(messages.length, active.length + 1, 'keyboard activation also pulses');
  Object.assign(dom.window, { bb:{ native:{ capabilities:[], post:(message:unknown) => messages.push(message) } } });
  listeners.get('click')!({ target:active[0], isTrusted:true } as unknown as Event);
  assert.equal(messages.length, active.length + 1, 'unsupported shells stay quiet');
  stop();
  assert.equal(listeners.size, 0);
});

test("plan and approval controls buzz once per activation without affecting past cards", t => {
  const cards = [
    ["plan-review-banner", "Plan review"],
    ["approval-banner", "Approval needed"],
  ] as const;
  const dom = new JSDOM(`<div data-bb-chat-ui-info-stack>${cards.map(([id, label]) => `<section data-testid="${id}">
    <button aria-label="${label}"><span>${label}</span></button>
    <button aria-label="Hide details"><svg></svg></button>
    <button aria-label="Show details">Show</button>
    <div hidden><button>Approve</button><button>Deny</button></div>
    <button disabled>Disabled</button><button aria-disabled="true">Unavailable</button>
  </section>`).join("")}</div><section data-testid="plan-review-banner"><button>Past plan</button></section><button>Unrelated</button>`);
  const originalElement = globalThis.Element;
  const originalButton = globalThis.HTMLButtonElement;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  t.after(() => { globalThis.Element = originalElement; globalThis.HTMLButtonElement = originalButton; dom.window.close(); });
  const messages: unknown[] = [];
  Object.assign(dom.window, { bb:{ native:{ capabilities:["haptic"], post:(message:unknown) => messages.push(message) } } });
  const listeners = new Map<string, (event:Event) => void>();
  const document = {
    body:null, defaultView:dom.window,
    addEventListener:(type:string, listener:(event:Event) => void) => listeners.set(type, listener),
    removeEventListener:(type:string) => listeners.delete(type),
  } as unknown as Document;
  const stop = injectSendHaptic(document);
  t.after(stop);
  const active = [...dom.window.document.querySelectorAll("[data-bb-chat-ui-info-stack] button:not([disabled]):not([aria-disabled])")];
  assert.equal(active.length, 10);
  let answers = 0;
  for (const button of active) {
    const target = button.firstElementChild ?? button;
    const parent = button.parentElement;
    button.addEventListener("click", () => answers++);
    listeners.get("pointerup")!({ target, isPrimary:true, pointerType:"touch" } as unknown as Event);
    listeners.get("click")!({ target, isTrusted:true } as unknown as Event);
    assert.equal(messages.length, active.indexOf(button) + 1);
    button.click();
    listeners.get("click")!({ target, isTrusted:false } as unknown as Event);
    assert.equal(button.parentElement, parent);
    assert.equal(messages.length, active.indexOf(button) + 1);
  }
  assert.equal(answers, active.length);
  assert.deepEqual(messages, active.map(() => ({ type:"haptic", kind:"selection" })));
  for (const target of dom.window.document.querySelectorAll("button[disabled], button[aria-disabled], body > section button, body > button")) {
    listeners.get("click")!({ target, isTrusted:true } as unknown as Event);
  }
  assert.equal(messages.length, active.length, "disabled, past and unrelated controls stay quiet");
  listeners.get("click")!({ target:active[0], isTrusted:true, detail:0 } as unknown as Event);
  assert.equal(messages.length, active.length + 1, "keyboard activation also pulses");
  listeners.get("click")!({ target:active[1].querySelector("svg"), isTrusted:true } as unknown as Event);
  assert.equal(messages.length, active.length + 2, "a mouse click on the nested chevron icon pulses once");
  Object.assign(dom.window, { bb:{ native:{ capabilities:[], post:(message:unknown) => messages.push(message) } } });
  listeners.get("click")!({ target:active[0], isTrusted:true } as unknown as Event);
  assert.equal(messages.length, active.length + 2, "unsupported shells stay quiet");
  stop();
  assert.equal(listeners.size, 0);
});

test("removes the send listeners when the script stops", () => {
  let observed = false;
  let disconnected = false;
  const originalObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {
      observed = true;
    }
    disconnect() {
      disconnected = true;
    }
    takeRecords() {
      return [];
    }
  } as unknown as typeof MutationObserver;

  const listeners = new Map<string, Array<(event: Event) => void>>();
  const document = {
    body: {},
    defaultView: {
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      const bucket = listeners.get(type) ?? [];
      listeners.set(
        type,
        bucket.filter((item) => item !== listener),
      );
    },
  };

  try {
    const cleanup = injectSendHaptic(document as unknown as Document);
    cleanup();
  } finally {
    globalThis.MutationObserver = originalObserver;
  }

  assert.equal(observed, true);
  assert.equal(disconnected, true);
  assert.deepEqual([...listeners.values()].flat(), []);
});

test("the composer latest-event proxy buzzes once through the forwarded host jump", t => {
  const dom = new JSDOM(`<div data-bb-chat-ui-info-bar><span data-bb-chat-ui-info-dock><button data-bb-chat-ui-info-all>All</button><button data-bb-chat-ui-info-jump><span>최신으로</span></button></span></div>
    <button aria-label="Scroll to latest event" data-bb-chat-ui-info-jump-source>Jump</button>`);
  const originalElement = globalThis.Element;
  const originalButton = globalThis.HTMLButtonElement;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  t.after(() => { globalThis.Element = originalElement; globalThis.HTMLButtonElement = originalButton; dom.window.close(); });
  const messages: unknown[] = [];
  Object.assign(dom.window, { bb:{ native:{ capabilities:["haptic"], post:(message:unknown) => messages.push(message) } } });
  const listeners = new Map<string, (event:Event) => void>();
  const document = {
    body:null, defaultView:dom.window,
    addEventListener:(type:string, listener:(event:Event) => void) => listeners.set(type, listener),
    removeEventListener:(type:string) => listeners.delete(type),
  } as unknown as Document;
  const stop = injectSendHaptic(document);
  t.after(stop);
  const proxy = dom.window.document.querySelector('[data-bb-chat-ui-info-jump] span')!;
  const host = dom.window.document.querySelector('[aria-label="Scroll to latest event"]')!;
  listeners.get('pointerup')!({ target:proxy, isPrimary:true, pointerType:'touch' } as unknown as Event);
  listeners.get('click')!({ target:proxy, isTrusted:true } as unknown as Event);
  assert.equal(messages.length, 0, 'the proxy itself does not add an information buzz');
  listeners.get('click')!({ target:host, isTrusted:false } as unknown as Event);
  assert.deepEqual(messages, [{ type:'haptic', kind:'impact-light' }], 'the forwarded host click keeps the one jump haptic');
  listeners.get('click')!({ target:dom.window.document.querySelector('[data-bb-chat-ui-info-all]'), isTrusted:true } as unknown as Event);
  assert.equal(messages.length, 2, 'the all-information button in the capsule still buzzes');
});

test("send response scanning is skipped without haptic capability", t => {
  const dom = new JSDOM('<div data-thread-window><form data-promptbox><button type="submit" data-promptbox-submit-action>Send</button></form></div>');
  const keys=['Element','HTMLElement','HTMLButtonElement','HTMLFormElement'] as const;
  const previous=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
  t.after(()=>{for(const [key,d] of previous){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
  const root=dom.window.document.querySelector('[data-thread-window]')!;
  const query=root.querySelectorAll.bind(root);let scans=0;
  root.querySelectorAll=((s:string)=>{scans++;return query(s);}) as typeof query;
  for(const capabilities of [[],['badge'],['haptic']]) {
    Object.assign(dom.window,{bb:{native:{capabilities,post(){}}}});
    const listeners=new Map<string,(event:Event)=>void>();
    const doc={body:null,defaultView:dom.window,
      addEventListener:(type:string,listener:(event:Event)=>void)=>listeners.set(type,listener),
      removeEventListener:(type:string)=>listeners.delete(type),
    } as unknown as Document;
    const stop=injectSendHaptic(doc);scans=0;
    try {
      listeners.get('submit')!({target:root.querySelector('form'),submitter:root.querySelector('button')} as unknown as Event);
      if(capabilities.includes('haptic'))assert.ok(scans>0,'phone keeps response tracking');
      else assert.equal(scans,0,'incapable clients never inspect assistant output');
    }finally{stop();}
  }
});
