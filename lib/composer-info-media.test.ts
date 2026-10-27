import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { injectComposerInfo, composerInfoCss } from "./composer-info.ts";
import { publishInfoData } from "./composer-data.ts";

let pageDocument: PropertyDescriptor | undefined;
// Save the native document descriptor before a fixture provides its DOM.
beforeEach(() => { pageDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'); });
// Restore the shared document after each isolated scenario.
afterEach(() => {
  if (pageDocument) Object.defineProperty(globalThis, 'document', pageDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

// Create two independent mounted owners with native Goal and To-do details.
function fixture() {
  const dom = new JSDOM('<html><head></head><body></body></html>', { pretendToBeVisual:true, virtualConsole:new VirtualConsole() });
  const document = dom.window.document;
  Object.defineProperty(globalThis, 'document', { configurable:true, writable:true, value:document });
  for (const id of ['one', 'two']) {
    const shell = document.createElement('div'); shell.setAttribute('data-promptbox-shell', '');
    shell.innerHTML = `<div class="grid" data-pane="${id}"><span hidden data-bb-chat-ui-info-settings></span><section aria-label="Goal"><button aria-expanded="false" aria-controls="${id}-goal">Goal</button><div id="${id}-goal" hidden>Goal body</div></section><section aria-label="To-do list"><button aria-expanded="false" aria-controls="${id}-todo">To-do list</button><div id="${id}-todo" hidden>Todo body</div></section></div>`;
    document.body.append(shell);
    publishInfoData(shell.querySelector('[data-bb-chat-ui-info-settings]')!, { settings:{ showInactiveInfo:true }, children:[], parent:null });
    for (const toggle of shell.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')) {
      // Retain a native disclosure callback so enablement is checked before native work.
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        document.getElementById(toggle.getAttribute('aria-controls')!)!.hidden = !expanded;
      });
    }
  }
  return { dom, document };
}

// Select only the six explicit detail media groups, leaving reduced-motion media intact.
function groups(document: Document): CSSMediaRule[] {
  const style = document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info')!;
  return Array.from(style.sheet!.cssRules).filter(rule => rule.type === 4 && ['all', 'not all'].includes((rule as CSSMediaRule).media.mediaText)) as CSSMediaRule[];
}

// Compare the six group's activation without using simulated computed styles.
function assertEnabled(document: Document, enabled: boolean) {
  const media = groups(document);
  assert.equal(media.length, 6);
  assert.deepEqual(media.map(rule => rule.media.mediaText), Array(6).fill(enabled ? 'all' : 'not all'));
}

// Click a mounted owner's actual information pill or close action.
function click(document: Document, pane: string, selector: string) {
  const button = document.querySelector<HTMLButtonElement>(`[data-pane="${pane}"] ${selector}`);
  assert.ok(button, selector); button.click();
}

// Prove that media grouping keeps the complete selector/declaration order and common rules.
test('detail media preserves all original rules in place and keeps common CSS active', () => {
  const f = fixture(), stop = injectComposerInfo(f.document);
  try {
    assertEnabled(f.document, false);
    const media = groups(f.document);
    assert.equal(media.reduce((sum, rule) => sum + rule.cssRules.length, 0), 152);
    const style = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info')!;
    const common = Array.from(style.sheet!.cssRules).filter(rule => !media.includes(rule as CSSMediaRule));
    assert.equal(common.length, 241);
    const commonCss = common.map(rule => rule.cssText).join('\n');
    for (const selector of ['html', 'body > .bbk-drop', 'data-bb-chat-ui-pr-menu', 'data-bb-chat-ui-info-body-fade', 'data-bb-chat-ui-info-guard', 'prefers-reduced-motion']) assert.ok(commonCss.includes(selector), selector);
    const original = new f.dom.window.CSSStyleSheet(); original.replaceSync(composerInfoCss);
    const flattened = Array.from(style.sheet!.cssRules).flatMap(rule => media.includes(rule as CSSMediaRule) ? Array.from((rule as CSSMediaRule).cssRules) : [rule]);
    assert.deepEqual(flattened.map(rule => rule.cssText), Array.from(original.cssRules, rule => rule.cssText));
  } finally { stop(); f.dom.window.close(); }
});

// Exercise synchronous opening, document-wide OR, editing refusal, replacement and cleanup.
test('native detail owners enable before OPEN/native click and release only the last successful owner', async () => {
  const f = fixture(), stop = injectComposerInfo(f.document);
  try {
    const goal = f.document.querySelector<HTMLElement>('[data-pane="one"] section[aria-label="Goal"]')!;
    const setAttribute = goal.setAttribute.bind(goal);
    // Check enablement at the observable OPEN write, before any native disclosure or geometry work.
    goal.setAttribute = function observeOpen(name, value) {
      if (name === 'data-bb-chat-ui-info-open') assertEnabled(f.document, true);
      setAttribute(name, value);
    };
    // Verify the native callback sees the enabled detail rules.
    goal.querySelector('button')!.addEventListener('click', () => assertEnabled(f.document, true));
    click(f.document, 'one', '[data-bb-chat-ui-info-trigger="goal"]');
    assertEnabled(f.document, true);
    click(f.document, 'two', '[data-bb-chat-ui-info-trigger="goal"]');
    click(f.document, 'one', '[data-bb-chat-ui-card-close]');
    assertEnabled(f.document, true);
    click(f.document, 'two', '[data-bb-chat-ui-card-close]');
    assertEnabled(f.document, false);

    click(f.document, 'one', '[data-bb-chat-ui-info-trigger="goal"]');
    const writes: string[] = [];
    for (const rule of groups(f.document)) {
      const media = rule.media, descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(media), 'mediaText')!;
      Object.defineProperty(media, 'mediaText', {
        // Preserve the real CSSOM getter while recording attempted activation writes.
        get() { return descriptor.get!.call(media); },
        // Record the setter value to reject an unnecessary off/on during a card replacement.
        set(value: string) { writes.push(value); descriptor.set!.call(media, value); },
      });
    }
    click(f.document, 'one', '[data-bb-chat-ui-info-trigger="todos"]');
    assertEnabled(f.document, true); assert.deepEqual(writes, []);
    const editor = f.document.createElement('div'); editor.setAttribute('data-queued-message-inline-editor', '');
    f.document.querySelector('[data-pane="one"]')!.append(editor);
    click(f.document, 'one', '[data-bb-chat-ui-card-close]');
    assertEnabled(f.document, true);
    assert.ok(f.document.querySelector('[data-pane="one"] [data-bb-chat-ui-info-open="todos"]'));
    editor.remove(); click(f.document, 'one', '[data-bb-chat-ui-card-close]');
    assertEnabled(f.document, false);
    click(f.document, 'one', '[data-bb-chat-ui-info-all]');
    assertEnabled(f.document, false);
    click(f.document, 'one', '[data-bb-chat-ui-info-close]');
    click(f.document, 'two', '[data-bb-chat-ui-info-trigger="goal"]');
    f.document.querySelector('[data-pane="two"]')!.parentElement!.remove();
    await new Promise(resolve => f.dom.window.setTimeout(resolve, 60));
    assertEnabled(f.document, false);

    const shell = f.document.createElement('div'); shell.setAttribute('data-promptbox-shell', '');
    shell.innerHTML = '<div class="grid" data-pane="late"><span hidden data-bb-chat-ui-info-settings></span><section aria-label="Goal" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="goal"><button aria-expanded="false">Goal</button><p>Existing open owner</p></section></div>';
    const lateStack = shell.querySelector<HTMLElement>('.grid')!;
    let geometryReads = 0;
    // Check an already-open late mount before its first stack geometry read.
    lateStack.getBoundingClientRect = function checkMountedOwner() {
      if (lateStack.isConnected) { geometryReads++; assertEnabled(f.document, true); }
      return new f.dom.window.DOMRect();
    };
    publishInfoData(shell.querySelector('[data-bb-chat-ui-info-settings]')!, { settings:{ showInactiveInfo:true }, children:[], parent:null });
    f.document.body.append(shell);
    await new Promise(resolve => f.dom.window.setTimeout(resolve, 60));
    assertEnabled(f.document, true); assert.ok(geometryReads > 0);
    shell.remove(); await new Promise(resolve => f.dom.window.setTimeout(resolve, 60));
    assertEnabled(f.document, false);
  } finally {
    stop(); assert.equal(f.document.querySelector('#bb-chat-ui-composer-info'), null);
    f.dom.window.close();
  }
});

// Keep a later pane's preexisting private owner active throughout earlier request-driven classification.
test('initial reconciliation never disables a later existing open owner before all panes are classified', () => {
  const f = fixture();
  const first = f.document.querySelector<HTMLElement>('[data-pane="one"]')!;
  const later = f.document.querySelector<HTMLElement>('[data-pane="two"]')!;
  const existing = later.querySelector<HTMLElement>('section[aria-label="Goal"]')!;
  existing.setAttribute('data-bb-chat-ui-info-unit', '');
  existing.setAttribute('data-bb-chat-ui-info-open', 'goal');
  const request = f.document.createElement('div'); request.setAttribute('data-testid', 'user-question-banner');
  first.append(request);
  const writes: string[] = [];
  const geometry: { pane:string | null; media:string[] }[] = [];
  for (const stack of [first, later]) {
    // Record every layout boundary while the later private owner is still connected.
    stack.getBoundingClientRect = function recordInitialOwnerGeometry() {
      geometry.push({ pane:stack.getAttribute('data-pane'), media:groups(f.document).map(rule => rule.media.mediaText) });
      return new f.dom.window.DOMRect();
    };
  }
  const append = f.document.head.append.bind(f.document.head);
  // Observe real media writes without throwing inside the helper's capability-fallback boundary.
  f.document.head.append = function recordInitialMediaWrites(...nodes: (Node | string)[]) {
    append(...nodes);
    for (const rule of groups(f.document)) {
      const media = rule.media, descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(media), 'mediaText')!;
      Object.defineProperty(media, 'mediaText', {
        // Retain the real CSSOM getter for the original mounted media group.
        get() { return descriptor.get!.call(media); },
        // Record transitions while the exact later UNIT+OPEN consumer exists in the document.
        set(value: string) {
          if (existing.isConnected && existing.hasAttribute('data-bb-chat-ui-info-unit') && existing.hasAttribute('data-bb-chat-ui-info-open')) writes.push(value);
          descriptor.set!.call(media, value);
        },
      });
    }
  };
  const stop = injectComposerInfo(f.document);
  try {
    assert.equal(first.hasAttribute('data-bb-chat-ui-info-request'), true);
    assert.ok(existing.isConnected && existing.hasAttribute('data-bb-chat-ui-info-open'));
    assertEnabled(f.document, true);
    assert.deepEqual(writes.filter(value => value === 'not all'), [], 'an existing later owner must not lose media during the first pane request close');
    assert.ok(geometry.some(read => read.pane === 'one'));
    assert.ok(geometry.some(read => read.pane === 'two'));
    for (const read of geometry) assert.deepEqual(read.media, Array(6).fill('all'), `initial geometry in pane ${read.pane}`);
  } finally { stop(); f.dom.window.close(); }
});

// Keep conservative activation after classification fails and a later width-only sync succeeds.
test('classification failure keeps detail media active after a subsequent successful resize', () => {
  const f = fixture();
  const first = f.document.querySelector<HTMLElement>('[data-pane="one"]')!;
  const existing = f.document.querySelector<HTMLElement>('[data-pane="two"] section[aria-label="Goal"]')!;
  existing.setAttribute('data-bb-chat-ui-info-unit', '');
  existing.setAttribute('data-bb-chat-ui-info-open', 'goal');
  const failure = new Error('first state classification failed');
  const query = first.querySelector.bind(first);
  let armed = true;
  // Throw once after dirty sets are cleared but before either state's owned nodes are adopted.
  first.querySelector = function failFirstClassification(selector: string) {
    if (armed && selector.includes('data-bb-chat-ui-info-icon="annotations"')) { armed = false; throw failure; }
    return query(selector);
  };
  const scheduled: FrameRequestCallback[] = [];
  // Run the next width-only callback before observer delivery can enqueue replacement data work.
  f.dom.window.requestAnimationFrame = function queueReconcile(callback: FrameRequestCallback) {
    scheduled.push(callback); return scheduled.length;
  };
  try {
    assert.throws(() => injectComposerInfo(f.document), error => error === failure, 'classification error must still propagate');
    assert.equal(armed, false);
    assertEnabled(f.document, true);
    f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));
    const resize = scheduled.shift(); assert.ok(resize);
    assert.doesNotThrow(() => resize(0));
    assert.ok(existing.isConnected && existing.hasAttribute('data-bb-chat-ui-info-open'));
    assertEnabled(f.document, true);
  } finally { f.dom.window.close(); }
});

// Prove that missing setters and replaced sheets retain the original always-active stylesheet.
test('detail media falls back to original CSS on setter failure or CSSOM replacement', () => {
  for (const failure of ['setter', 'replacement']) {
    const f = fixture();
    if (failure === 'setter') {
      const append = f.document.head.append.bind(f.document.head);
      // Fail the last setter after earlier groups have already changed their media conditions.
      f.document.head.append = function failMediaSetter(...nodes: (Node | string)[]) {
        append(...nodes);
        const last = groups(f.document).at(-1)?.media;
        if (last) Object.defineProperty(last, 'mediaText', { get:() => 'all', set() { throw new Error('read-only media list'); } });
      };
    }
    const stop = injectComposerInfo(f.document);
    try {
      const style = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info')!;
      if (failure === 'replacement') {
        click(f.document, 'one', '[data-bb-chat-ui-info-trigger="goal"]');
        style.textContent = style.textContent;
        click(f.document, 'one', '[data-bb-chat-ui-card-close]');
      }
      assert.equal(style.textContent, composerInfoCss, failure);
      click(f.document, 'one', '[data-bb-chat-ui-info-trigger="goal"]');
      assert.ok(f.document.querySelector('[data-bb-chat-ui-info-open="goal"]'));
      assert.equal(style.textContent, composerInfoCss, failure);
    } finally { stop(); f.dom.window.close(); }
  }
});
