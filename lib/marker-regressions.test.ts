import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { injectMentionPills } from "./mention-pill.ts";
import { injectQuoteMentions } from "./quote-mention.ts";
import { injectComposerGlass } from "./composer-glass.ts";

// Scenarios from the review of the :has() → marker prototype. Each is a live-update path the
// old :has() rules covered for free and a marker must keep covering.
function setup(html: string) {
  const dom = new JSDOM(`<html><head></head><body>${html}</body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  dom.window.matchMedia = () => ({ matches: false } as MediaQueryList);
  const keys = ["document", "HTMLElement", "Element", "Node", "SVGElement", "MutationObserver", "ResizeObserver", "getComputedStyle"] as const;
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) {
    const value = key === "document" ? document : key === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : key === "ResizeObserver" ? undefined : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const restore = () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    dom.window.close();
  };
  const settle = () => new Promise<void>((resolve) => dom.window.setTimeout(resolve, 60));
  return { dom, document, restore, settle };
}

const PILL = '<span class="prompt-mention-pill" data-prompt-mention="" data-prompt-mention-resource=\'{"kind":"path","label":"a.ts"}\'><span class="truncate">a.ts</span></span>';

test("compact editor that already holds a pill gets the compact mention layout", async () => {
  const f = setup(`<div data-promptbox-editor-content><div class="ProseMirror" contenteditable="true"><p>${PILL}</p></div></div>`);
  const stop = injectMentionPills(f.document);
  try {
    await f.settle();
    const wrapper = f.document.querySelector("[data-promptbox-editor-content]")!;
    wrapper.setAttribute("data-promptbox-compact-content", "");
    await f.settle();
    const editor = f.document.querySelector(".ProseMirror")!;
    assert.equal(f.dom.window.getComputedStyle(editor).display, "flex", "compact mention line is applied after the editor turns compact");
    wrapper.removeAttribute("data-promptbox-compact-content");
    await f.settle();
    assert.notEqual(f.dom.window.getComputedStyle(editor).display, "flex", "leaving compact mode drops the layout");
  } finally { stop(); f.restore(); }
});

test("a code quote copies the Diff icon even when the Diff banner mounts after the quote", async () => {
  const resource = JSON.stringify({ kind: "plugin", itemId: "quote:1", icon: "Code", label: "diff --git a/x b/x" });
  const f = setup(`<div class="ProseMirror" contenteditable="true"><p><span class="prompt-mention-pill" data-prompt-mention="" data-prompt-mention-resource='${resource}'><span data-icon-root data-icon="Quote"></span><span class="truncate">x</span></span></p></div><div id="host"></div>`);
  const stop = injectQuoteMentions(f.document);
  try {
    await f.settle();
    f.document.getElementById("host")!.innerHTML = '<section><button id="thread-prompt-banner-git-toggle"><span data-icon="FileDiff"><svg></svg></span></button></section>';
    await f.settle();
    assert.ok(f.document.querySelector("[data-icon-root] [data-bb-chat-ui-code-icon]"), "late Diff icon is copied into the quote");
  } finally { stop(); f.restore(); }
});

test("every glass footer keeps live markers, not only the first", async () => {
  const footer = (extra: string) => `<div data-scroll-footer><div class="relative"></div><div class="chat-prompt-box"><div data-promptbox-shell><div class="grid">${extra}</div></div><form data-promptbox></form></div></div>`;
  const f = setup(footer("") + footer('<div class="wrap"><div class="agentation-staging-shell"></div></div>'));
  const stop = injectComposerGlass(f.document);
  try {
    await f.settle();
    const [, second] = Array.from(f.document.querySelectorAll("[data-scroll-footer]"));
    assert.ok(second.hasAttribute("data-bb-chat-ui-glass"), "second footer is glass");
    assert.ok(second.querySelector(".wrap")!.hasAttribute("data-bb-chat-ui-agentation-slot"), "second footer's agentation wrapper is marked");
    second.querySelector(".chat-prompt-box")!.remove();
    await f.settle();
    assert.equal(second.hasAttribute("data-bb-chat-ui-glass"), false, "a footer without a prompt box stops being glass");
  } finally { stop(); f.restore(); }
});
