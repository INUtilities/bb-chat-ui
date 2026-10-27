import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolvedStyle } from "./test-style.ts";
import { COMPOSER_MENU_GLASS_STYLE_ID, injectComposerMenuGlass } from "./composer-menu-glass.ts";
import { cardStyle } from "./info-card.ts";
import { injectComposerModelMenus, MODEL_MENU_MARK, MODEL_SCROLL_MARK } from "./composer-model-menu.ts";

test("the shared row radius can be reused without replacing native menu row geometry", () => {
  const f = fixture('<div data-bb-portaled-overlay role="menu" aria-label="Prompt actions"><button role="menuitem" style="min-height:36px;padding:6px 12px">Attach</button></div>');
  const stop = injectComposerMenuGlass(f.document);
  try {
    assert.match(cardStyle.rowRadius, /border-radius:10px/);
    const item = f.document.querySelector('[role="menuitem"]')!;
    assert.equal(resolvedStyle(item).borderRadius, '10px');
    const s = resolvedStyle(item);
    assert.equal(s.padding, '6px 12px'); assert.equal(s.minHeight, '36px');
  } finally { stop(); f.restore(); }
});

test("composer menus share the card border reset while retaining their shallower shadow", () => {
  const f = fixture(TRIGGER + GROK);
  const host = f.document.createElement('style'); host.textContent = '[role="dialog"] { border:1px solid; }'; f.document.head.append(host);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const card = f.document.getElementById('radix-_r_2m_')!;
    assert.equal(resolvedStyle(card).borderTopWidth, '0px');
    assert.equal(declaration(f.document, card, 'border-radius'), '18px');
    assert.equal(declaration(f.document, card, 'backdrop-filter'), 'blur(14px) saturate(1.25)');
    assert.match(declaration(f.document, card, 'box-shadow'), /^0 6px 18px -12px/);
  } finally { stop(); f.restore(); }
});

const MARKER = "data-bb-chat-ui-model-menu";
const SUBMENU = "data-bb-chat-ui-model-submenu";
const TRIGGER = '<button aria-haspopup="dialog" aria-label="Provider, model and reasoning: Grok Build, Grok 4.7, Medium" aria-controls="radix-_r_2m_">Grok 4.7</button>';

// Reduced from grok-controls-before.html: Grok has plain model buttons and no search input.
const GROK = `
<div role="dialog" id="radix-_r_2m_" data-bb-portaled-overlay class="rounded-md bg-popover">
  <div class="bg-background"><button title="Codex">Codex</button><button title="Grok Build">Grok Build</button></div>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="overflow-y-auto max-h-64">
      <div class="sticky bg-background">Model</div>
      <button class="rounded-sm hover:bg-state-hover" id="_r_2l_-opt-0"><span title="Grok 4.7">Grok 4.7</span></button>
      <button class="rounded-sm hover:bg-state-hover" id="_r_2l_-opt-1"><span title="Grok 4.7 Fast">Grok 4.7 Fast</span></button>
    </div>
    <div><div class="sticky bg-background">Reasoning</div><div role="radiogroup" aria-label="Reasoning">
      <button role="radio" aria-label="Low" aria-checked="false">Low</button>
      <button role="radio" aria-label="Medium" aria-checked="true">Medium</button>
      <button role="radio" aria-label="High" aria-checked="false">High</button>
    </div></div>
    <div><span>Fast mode</span><button role="switch" aria-label="Fast mode" aria-checked="false"><span></span></button></div>
  </div>
</div>`;

// Reduced from codex-controls-before.html: Codex also has a search combobox and listbox.
const CODEX = `
<div role="dialog" id="radix-_r_2m_" data-bb-portaled-overlay class="rounded-md bg-popover">
  <div class="bg-background"><button title="Codex">Codex</button><button title="Grok Build">Grok Build</button></div>
  <div><input aria-label="Search models" role="combobox" aria-controls="_r_2l_-listbox"></div>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div role="listbox" id="_r_2l_-listbox" aria-label="Models">
      <div class="sticky bg-background">Model</div>
      <button role="option" aria-selected="true" class="rounded-sm hover:bg-state-hover">6.1-Sol</button>
    </div>
    <div><div class="sticky bg-background">Reasoning</div><div role="radiogroup" aria-label="Reasoning">
      <button role="radio" aria-label="Low" aria-checked="false">Low</button>
      <button role="radio" aria-label="High" aria-checked="true">High</button>
    </div></div>
    <div><span>Fast mode</span><button role="switch" aria-label="Fast mode" aria-checked="false"><span></span></button></div>
  </div>
</div>`;

// Provide browser globals and restore them when the isolated DOM is released.
function fixture(html: string) {
  const dom = new JSDOM(`<html><head></head><body>${html}</body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  // Keep reduced-motion probing deterministic in the DOM-only test.
  dom.window.matchMedia = () => ({ matches: false } as MediaQueryList);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ["HTMLElement", "Element", "Node", "MutationObserver"] as const) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  }
  // Restore the caller's globals after disconnecting the test DOM.
  function restore() {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
  // Flush portal mutation delivery without depending on wall-clock timing.
  async function settle() {
    await Promise.resolve();
    await Promise.resolve();
  }
  return { dom, document, restore, settle };
}

// Check that the live stylesheet supplies the frost declarations to this exact card.
function assertFrost(document: Document, card: Element) {
  const style = document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID) as HTMLStyleElement;
  assert.ok(style?.sheet, "the menu stylesheet is installed");
  let radius = "";
  let blur = "";
  for (const rule of Array.from(style.sheet.cssRules)) {
    const css = rule as CSSStyleRule;
    if (!css.selectorText || !card.matches(css.selectorText)) continue;
    radius = css.style.getPropertyValue("border-radius") || radius;
    blur = css.style.getPropertyValue("backdrop-filter") || blur;
  }
  assert.equal(radius, "18px", "the provider card keeps the agreed outer radius");
  assert.match(blur, /blur\(14px\)/, "the provider card keeps the frost blur");
}

// Read the final matching declaration for the native fixture without relying on unsupported DOM CSS rendering.
function declaration(document: Document, element: Element, property: string): string {
  const style = document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID) as HTMLStyleElement;
  let value = "";
  for (const rule of Array.from(style.sheet!.cssRules)) {
    const css = rule as CSSStyleRule;
    if (css.selectorText && element.matches(css.selectorText)) value = css.style.getPropertyValue(property) || value;
  }
  return value;
}

// Capture the alias picker shape rendered by the native More models portal.
function moreModels(id = "more-models"): string {
  return `<div id="${id}" role="dialog" data-bb-portaled-overlay data-side="right"><button class="relative rounded-sm hover:bg-state-hover"><span class="truncate" title="Sonnet 5.5 alias">Sonnet 5.5 alias</span><span><svg data-icon="Check"></svg></span></button></div>`;
}

// Match only headings inside the native model scroller, leaving static Reasoning transparent.
test("model headings frost only while their own list is scrolled", () => {
  for (const html of [GROK, CODEX]) {
    const f = fixture(TRIGGER + html);
    const stop = injectComposerMenuGlass(f.document);
    try {
      const scroller = f.document.querySelector<HTMLElement>('[role="listbox"],.overflow-y-auto')!;
      const heading = scroller.querySelector('.sticky')!;
      const reasoning = f.document.querySelector('[role="radiogroup"]')!.previousElementSibling!;
      assert.equal(declaration(f.document, heading, 'background'), 'transparent');
      assert.equal(declaration(f.document, heading, 'backdrop-filter'), 'none');
      scroller.scrollTop = 16; scroller.dispatchEvent(new f.dom.window.Event('scroll'));
      assert.ok(scroller.hasAttribute('data-bb-chat-ui-model-scrolled'));
      assert.equal(declaration(f.document, heading, 'background'), 'var(--bb-chat-ui-card-face)');
      assert.equal(declaration(f.document, heading, 'backdrop-filter'), 'blur(24px) saturate(1.5)');
      assert.equal(declaration(f.document, reasoning, 'backdrop-filter'), 'none');
      const css = f.document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID)!.textContent!;
      assert.match(css, /height:12px/);
      assert.match(css, /linear-gradient\(to bottom,var\(--bb-chat-ui-card-face\),transparent\)/);
      assert.match(css, /backdrop-filter:blur\(6px\)/);
      assert.match(css, /mask-image:linear-gradient\(to bottom,var\(--foreground\),transparent\)/);
      assert.match(css, /transition:background 160ms ease-out,backdrop-filter 160ms ease-out/);
      assert.match(css, /prefers-reduced-motion:reduce[\s\S]*sticky[\s\S]*transition:none !important/);
      scroller.scrollTop = 0; scroller.dispatchEvent(new f.dom.window.Event('scroll'));
      assert.equal(scroller.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
      assert.equal(declaration(f.document, heading, 'backdrop-filter'), 'none');
    } finally { stop(); f.restore(); }
  }
});

// Scroll handlers may read scrollTop only and must not write unchanged state.
test("model scroller uses one passive listener and writes only state changes", async () => {
  const f = fixture(TRIGGER + CODEX);
  const scroller = f.document.querySelector<HTMLElement>('[role="listbox"]')!;
  const added: unknown[] = [], removed: unknown[] = [];
  const add = scroller.addEventListener.bind(scroller), remove = scroller.removeEventListener.bind(scroller);
  scroller.addEventListener = ((type, listener, options) => { if (type === 'scroll') added.push(options); add(type, listener, options); }) as typeof scroller.addEventListener;
  scroller.removeEventListener = ((type, listener, options) => { if (type === 'scroll') removed.push(listener); remove(type, listener, options); }) as typeof scroller.removeEventListener;
  const stop = injectComposerMenuGlass(f.document);
  try {
    assert.deepEqual(added, [{ passive: true }]);
    const mutations: MutationRecord[] = [];
    const observer = new f.dom.window.MutationObserver(records => mutations.push(...records));
    observer.observe(scroller, { attributes: true, attributeFilter: ['data-bb-chat-ui-model-scrolled'] });
    for (const key of ['clientHeight', 'scrollHeight', 'offsetTop', 'offsetHeight']) Object.defineProperty(scroller, key, { get() { throw Error('scroll layout read: ' + key); } });
    scroller.getBoundingClientRect = () => { throw Error('scroll layout read'); };
    for (const top of [0, 0, 12, 18, 18, 0, 0]) { scroller.scrollTop = top; scroller.dispatchEvent(new f.dom.window.Event('scroll')); }
    await f.settle();
    assert.equal(mutations.length, 2);
    scroller.scrollTop = 10; scroller.dispatchEvent(new f.dom.window.Event('scroll'));
    stop();
    assert.equal(scroller.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    assert.equal(removed.length, 1);
    scroller.dispatchEvent(new f.dom.window.Event('scroll'));
    assert.equal(scroller.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    observer.disconnect();
  } finally { stop(); f.restore(); }
});

// Provider changes replace the scroll element without replacing the outer portal.
test("model scroller rebinds on native list replacement and cleans up on close", async () => {
  const f = fixture(TRIGGER + CODEX);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const old = f.document.querySelector<HTMLElement>('[role="listbox"]')!;
    old.scrollTop = 10; old.dispatchEvent(new f.dom.window.Event('scroll'));
    const next = old.cloneNode(true) as HTMLElement;
    next.removeAttribute('data-bb-chat-ui-model-scrolled'); next.scrollTop = 4;
    old.replaceWith(next); await f.settle();
    assert.equal(old.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    assert.equal(next.hasAttribute('data-bb-chat-ui-model-scrolled'), true);
    old.dispatchEvent(new f.dom.window.Event('scroll'));
    assert.equal(old.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    const trigger = f.document.querySelector('button[aria-controls]')!;
    trigger.setAttribute('aria-expanded', 'false'); await f.settle();
    assert.equal(next.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    next.dispatchEvent(new f.dom.window.Event('scroll'));
    assert.equal(next.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
    trigger.setAttribute('aria-expanded', 'true'); await f.settle();
    assert.equal(next.hasAttribute('data-bb-chat-ui-model-scrolled'), true);
    f.document.getElementById('radix-_r_2m_')!.remove(); await f.settle();
    assert.equal(next.hasAttribute('data-bb-chat-ui-model-scrolled'), false);
  } finally { stop(); f.restore(); }
});

// Keep the approved waveform compact and its bars round without a separate filled track.
test("the effort waveform uses a compact track, rounded bars, and an integrated pin", () => {
  const f = fixture(TRIGGER + GROK);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const track = f.document.querySelector('[data-effort-track]')!;
    const bar = track.querySelector('[data-effort-tick]')!;
    assert.equal(declaration(f.document, track, "height"), "48px");
    assert.equal(declaration(f.document, bar, "border-radius"), "999px");
    assert.equal(declaration(f.document, bar, "transform"), "translateY(-50%)");
    const head = track.querySelector('[data-effort-head]')!;
    const pin = track.querySelector('[data-effort-pin]')!;
    assert.equal(declaration(f.document, head, "height"), "22px");
    assert.equal(declaration(f.document, pin, "z-index"), "2");
    assert.equal(track.querySelector('[data-effort-fill]'), null);
  } finally { stop(); f.restore(); }
});

// Discover the child portal through the open More models control and preserve its native actions.
test("More models receives frost and row radius while unrelated alias dialogs stay untouched", async () => {
  const f = fixture(TRIGGER + GROK);
  const card = f.document.getElementById('radix-_r_2m_')!;
  card.insertAdjacentHTML('beforeend', '<button aria-haspopup="menu" aria-expanded="false">More models</button>');
  const stop = injectComposerMenuGlass(f.document);
  try {
    f.document.body.insertAdjacentHTML('beforeend', moreModels('unrelated'));
    await f.settle();
    assert.equal(f.document.getElementById('unrelated')!.hasAttribute(SUBMENU), false);
    const more = card.querySelector('[aria-haspopup="menu"]')!;
    more.setAttribute('aria-expanded', 'true');
    f.document.body.insertAdjacentHTML('beforeend', moreModels());
    await f.settle();
    const child = f.document.getElementById('more-models')!;
    const button = child.querySelector('button')!;
    let clicks = 0;
    // Observe the original native option handler without replacing its button.
    button.addEventListener('click', () => { clicks++; });
    assert.equal(child.hasAttribute(SUBMENU), true);
    assertFrost(f.document, child);
    assert.equal(declaration(f.document, button, 'border-radius'), '10px');
    button.click();
    assert.equal(clicks, 1);
    more.setAttribute('aria-expanded', 'false');
    await f.settle();
    assert.equal(child.hasAttribute(SUBMENU), false, 'closing the native parent releases child ownership');
    assert.equal(f.document.getElementById('unrelated')!.hasAttribute(SUBMENU), false);
  } finally { stop(); f.restore(); }
});

// Preserve an existing child marker through close, reused portal reopen, and plugin disposal.
test("More models ownership restores previous markers and supports a reused native portal", async () => {
  const f = fixture(TRIGGER + GROK);
  const card = f.document.getElementById('radix-_r_2m_')!;
  card.insertAdjacentHTML('beforeend', '<button aria-haspopup="menu" aria-expanded="true">More models</button>');
  f.document.body.insertAdjacentHTML('beforeend', moreModels());
  const child = f.document.getElementById('more-models')!;
  child.setAttribute(SUBMENU, 'previous-owner');
  const stop = injectComposerMenuGlass(f.document);
  try {
    const more = card.querySelector('[aria-haspopup="menu"]')!;
    assert.equal(child.getAttribute(SUBMENU), '');
    more.setAttribute('aria-expanded', 'false');
    await f.settle();
    assert.equal(child.getAttribute(SUBMENU), 'previous-owner');
    more.setAttribute('aria-expanded', 'true');
    await f.settle();
    assert.equal(child.getAttribute(SUBMENU), '');
    stop();
    assert.equal(child.getAttribute(SUBMENU), 'previous-owner');
    child.remove();
    f.document.body.insertAdjacentHTML('beforeend', moreModels('after-dispose'));
    await f.settle();
    assert.equal(f.document.getElementById('after-dispose')!.hasAttribute(SUBMENU), false);
  } finally { stop(); f.restore(); }
});

// Reproduce Grok's missing frost when its provider omits the search input.
test("Grok's trigger-linked dialog gets frost without a Search models input", () => {
  const f = fixture(TRIGGER + GROK);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const card = f.document.getElementById("radix-_r_2m_")!;
    assert.equal(card.querySelector('input[aria-label="Search models"]'), null);
    assert.ok(card.hasAttribute(MARKER), "the composer trigger identifies Grok's card immediately");
    assertFrost(f.document, card);
  } finally { stop(); f.restore(); }
});

// Preserve the same treatment for a provider that does include search.
test("Codex's trigger-linked dialog receives the same model menu marker and frost", () => {
  const f = fixture(TRIGGER + CODEX);
  const stop = injectComposerMenuGlass(f.document);
  try {
    const card = f.document.getElementById("radix-_r_2m_")!;
    assert.ok(card.hasAttribute(MARKER));
    assertFrost(f.document, card);
  } finally { stop(); f.restore(); }
});

// Keep provider discovery independent from optional effort controls.
test("a linked provider dialog still receives frost when reasoning controls are absent", () => {
  const f = fixture(TRIGGER + GROK);
  const card = f.document.getElementById("radix-_r_2m_")!;
  card.querySelector('[role="radiogroup"]')!.parentElement!.remove();
  const stop = injectComposerMenuGlass(f.document);
  try {
    assert.ok(card.hasAttribute(MARKER));
    assertFrost(f.document, card);
  } finally { stop(); f.restore(); }
});

// Exclude unrelated dialogs even when their contents resemble a model selector.
test("unrelated search dialogs and non-composer dialog triggers are not styled", () => {
  const f = fixture(`
    <button aria-haspopup="dialog" aria-label="Choose a model" aria-controls="other">Other</button>
    <div role="dialog" id="other" data-bb-portaled-overlay><input aria-label="Search models"></div>
    <div role="dialog" id="orphan" data-bb-portaled-overlay><input aria-label="Search models"></div>`);
  const stop = injectComposerMenuGlass(f.document);
  try {
    for (const card of f.document.querySelectorAll('[role="dialog"]')) {
      assert.equal(card.hasAttribute(MARKER), false);
      assert.notEqual(resolvedStyle(card).borderRadius, "18px", "unlinked lookalikes keep their native styling");
    }
  } finally { stop(); f.restore(); }
});

// Discover a native portal mounted after the content script starts.
test("a late Grok portal is marked through aria-controls and released on dispose", async () => {
  const f = fixture(TRIGGER);
  const stop = injectComposerMenuGlass(f.document);
  try {
    f.document.body.insertAdjacentHTML("beforeend", GROK);
    await f.settle();
    const card = f.document.getElementById("radix-_r_2m_")!;
    assert.ok(card.hasAttribute(MARKER), "late portals receive the marker after mutation delivery");
    assertFrost(f.document, card);
    stop();
    assert.equal(card.hasAttribute(MARKER), false);
    assert.equal(f.document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID), null);
    card.remove();
    f.document.body.insertAdjacentHTML("beforeend", GROK);
    await f.settle();
    assert.equal(f.document.getElementById("radix-_r_2m_")!.hasAttribute(MARKER), false, "disposed observers do not mark later portals");
  } finally { stop(); f.restore(); }
});

// Restore only attributes owned by this installation when the plugin unloads.
test("dispose removes new markers and preserves a pre-existing marker value", () => {
  const f = fixture(TRIGGER + GROK);
  const card = f.document.getElementById("radix-_r_2m_")!;
  card.setAttribute(MARKER, "existing-owner");
  const stop = injectComposerMenuGlass(f.document);
  try {
    stop();
    assert.equal(card.getAttribute(MARKER), "existing-owner");
    assert.equal(f.document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID), null);
  } finally { stop(); f.restore(); }
});

// QA-02: the phone model picker is a BB drawer whose trigger has no aria-controls.
test("the phone model drawer is found by its label and tracked for scroll frost", async () => {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="phone"><body>
    <button aria-haspopup="dialog" aria-expanded="true" aria-label="Provider, model and reasoning (⇧ ⌘ M)">6.1-Sol</button>
    <div id="drawer" data-bb-portaled-overlay data-bb-plugin="bb--composer" data-persistent-drawer-content data-state="open" role="dialog" aria-labelledby="t">
      <div data-persistent-drawer-handle></div><h2 id="t" class="sr-only">Model</h2>
      <div class="flex"><div id="list" class="overflow-y-auto"><div class="sticky">Model</div><button>6.1-Sol</button></div></div>
    </div>
    <div id="plus" data-persistent-drawer-content data-state="open" role="dialog" aria-labelledby="p"><h2 id="p">Prompt actions</h2></div>
  </body></html>`, { pretendToBeVisual: true });
  const d = dom.window.document, drawer = d.getElementById("drawer")!, list = d.getElementById("list")!;
  const stop = injectComposerModelMenus(d);
  try {
    assert.equal(drawer.hasAttribute(MODEL_MENU_MARK), true);
    assert.equal(d.getElementById("plus")!.hasAttribute(MODEL_MENU_MARK), false);
    list.scrollTop = 40; list.dispatchEvent(new dom.window.Event("scroll"));
    assert.equal(list.hasAttribute(MODEL_SCROLL_MARK), true);
    drawer.setAttribute("data-state", "closed");
    await new Promise(r => setTimeout(r, 0));
    assert.equal(drawer.hasAttribute(MODEL_MENU_MARK), false);
  } finally { stop(); dom.window.close(); }
});
