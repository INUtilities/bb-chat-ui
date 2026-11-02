import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { injectMentionPills } from "./mention-pill.ts";
import { injectQuoteMentions } from "./quote-mention.ts";
import { injectQuotePill } from "./quote-pill.ts";
import { injectComposerGlass } from "./composer-glass.ts";
import { QUOTE_CODE_MASK } from "./quote-icons.ts";

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

// 접힌 상태 전환 뒤에도 필 주위 문장은 일반 글줄을 사용한다.
test("compact editor that already holds a pill gets normal text flow", async () => {
  const f = setup(`<div data-promptbox-editor-content><div class="ProseMirror" contenteditable="true"><p>${PILL}</p></div></div>`);
  const stop = injectMentionPills(f.document);
  try {
    await f.settle();
    const wrapper = f.document.querySelector("[data-promptbox-editor-content]")!;
    wrapper.setAttribute("data-promptbox-compact-content", "");
    await f.settle();
    const editor = f.document.querySelector(".ProseMirror")!;
    const paragraph = editor.querySelector("p")!;
    assert.equal(f.dom.window.getComputedStyle(editor).display, "block");
    assert.equal(f.dom.window.getComputedStyle(paragraph).display, "inline", "compact paragraphs flow around the pill without flex columns");
    assert.equal(f.dom.window.getComputedStyle(editor.querySelector(".prompt-mention-pill")!).display, "inline-flex");
    wrapper.removeAttribute("data-promptbox-compact-content");
    await f.settle();
    assert.equal(f.dom.window.getComputedStyle(paragraph).display, "block", "expanded paragraphs return to native layout");
  } finally { stop(); f.restore(); }
});

// 뒤늦게 붙은 호스트 배너가 공통 코드 자산을 바꾸지 않는지 확인한다.
test("a legacy code quote uses the shared code asset before and after a host banner mounts", async () => {
  const resource = JSON.stringify({ kind: "plugin", itemId: "quote:1", icon: "Code", label: "diff --git a/x b/x" });
  const f = setup(`<div class="ProseMirror" contenteditable="true"><p><span class="prompt-mention-pill" data-prompt-mention="" data-prompt-mention-resource='${resource}'><span data-icon-root data-icon="Quote"></span><span class="truncate">x</span></span></p></div><div id="host"></div>`);
  const stop = injectQuoteMentions(f.document);
  try {
    await f.settle();
    const glyph = f.document.querySelector<HTMLElement>("[data-bb-chat-ui-quote-glyph]");
    assert.ok(glyph, "a code quote has an icon without a host Diff banner");
    assert.equal(glyph.style.mask, QUOTE_CODE_MASK);
    f.document.getElementById("host")!.innerHTML = '<section><button id="thread-prompt-banner-git-toggle"><span data-icon="FileDiff"><svg></svg></span></button></section>';
    await f.settle();
    assert.equal(f.document.querySelector("[data-bb-chat-ui-quote-glyph]"), glyph, "late host icons keep the existing shared glyph");
    assert.equal(glyph.style.mask, QUOTE_CODE_MASK);
    assert.equal(f.document.querySelector("[data-bb-chat-ui-code-icon]"), null, "host artwork is not copied into the quote");
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


// 여러 문단의 원문과 명시적 줄바꿈은 접힘 전환 중에도 보존한다.
test("compact multiline drafts preserve text and native expanded paragraphs", async () => {
  for (const resource of [{ kind: "path", label: "file.ts" }, { kind: "plugin", itemId: "quote:multiline", label: "인용" }]) {
    const pill = `<span class="prompt-mention-pill" data-prompt-mention data-prompt-mention-resource='${JSON.stringify(resource)}'><span class="truncate">${resource.label}</span></span>`;
    const f = setup(`<div data-promptbox-editor-scroll><div data-promptbox-editor-content><div class="ProseMirror" contenteditable="true"><p>${pill} 첫째 줄 AAAA</p><p>둘째 줄 BBBB</p><p>셋째 줄 CCCC<br>넷째 줄 DDDD</p></div></div></div>`);
    const stopMention = injectMentionPills(f.document), stopQuote = injectQuotePill(f.document);
    try {
      const wrapper = f.document.querySelector("[data-promptbox-editor-content]")!;
      const editor = wrapper.querySelector(".ProseMirror")!;
      const paragraphs = Array.from(editor.children);
      const text = paragraphs.map(node => node.textContent);
      wrapper.setAttribute("data-promptbox-compact-content", "");
      await f.settle();
      assert.equal(f.dom.window.getComputedStyle(editor).display, "block");
      for (const paragraph of paragraphs) {
        assert.equal(f.dom.window.getComputedStyle(paragraph).display, "inline", "compact paragraphs share normal text flow instead of separate flex columns");
      }
      assert.equal(f.dom.window.getComputedStyle(editor.querySelector(".prompt-mention-pill")!).display, "inline-flex");
      assert.deepEqual(paragraphs.map(node => node.textContent), text, "the original multiline draft is preserved");
      assert.equal(editor.querySelectorAll("br").length, 1);
      wrapper.removeAttribute("data-promptbox-compact-content");
      await f.settle();
      for (const paragraph of paragraphs) assert.equal(f.dom.window.getComputedStyle(paragraph).display, "block", "expanded paragraphs keep native layout");
    } finally { stopQuote(); stopMention(); f.restore(); }
  }
});
