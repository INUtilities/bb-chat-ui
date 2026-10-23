import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { COMPOSER_MENU_GLASS_STYLE_ID, injectComposerMenuGlass } from "./composer-menu-glass.ts";

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

// Cover Grok's title outside the scroll node and Codex's title inside the listbox.
test("model sticky headings use the desktop section frost surface in both native layouts", () => {
  for (const html of [GROK, CODEX]) {
    const f = fixture(TRIGGER + html);
    const stop = injectComposerMenuGlass(f.document);
    try {
      const heading = f.document.querySelector('.sticky')!;
      // JSDOM drops srgb color-mix, so verify its scoped declaration alongside the matched native heading rule.
      assert.match(f.document.getElementById(COMPOSER_MENU_GLASS_STYLE_ID)!.textContent!, /div\[class~="sticky"\] \{\s*background:color-mix\(in srgb,var\(--popover\) 62%,transparent\) !important;/);
      assert.equal(declaration(f.document, heading, "backdrop-filter"), "blur(24px) saturate(1.5)");
    } finally { stop(); f.restore(); }
  }
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
    assert.ok(track.querySelector('[data-effort-head]'));
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
      assert.notEqual(f.dom.window.getComputedStyle(card).borderRadius, "18px", "unlinked lookalikes keep their native styling");
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
