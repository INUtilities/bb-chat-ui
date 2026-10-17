import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { injectComposerGlass } from "./composer-glass.ts";
import { injectComposerInfo } from "./composer-info.ts";
import { injectMentionPills } from "./mention-pill.ts";
import { injectQuotePill } from "./quote-pill.ts";
import { injectQueuedMessages } from "./queued-messages.ts";
import { injectThreadToc } from "./thread-toc.ts";
import { injectUserAttachments } from "./user-attachments.ts";
import { injectWorkspaceDiffPill } from "./workspace-diff-pill.ts";

// Measured on BB 0.46.1: a selector that contains :has() and ends in a generic subject makes every
// timeline row insertion restyle the app while scrolling. Specific subjects measured free.
const GENERIC_CLASS = /^(flex|grid|block|contents|relative|absolute|sticky|hidden|truncate|break-words|rounded(-[a-z0-9]+)?|space-[xy]-\d+|m[trblxy]?-\d+|p[trblxy]?-\d+|gap-\d+|w-[a-z0-9]+|h-[a-z0-9]+|min-w-0|shrink-0|grow|items-[a-z]+|justify-[a-z]+|text-[a-z]+)$/;

function splitTop(text: string, separators: string): string[] {
  const parts: string[] = []; let depth = 0; let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (depth === 0 && separators.includes(char)) { parts.push(current); current = ""; continue; }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

// The rightmost compound with functional pseudo-classes and pseudo-elements removed.
function subjectOf(selector: string): string {
  const compounds = splitTop(selector.replace(/\s*([>+~])\s*/g, " $1 "), " >+~");
  let subject = compounds.at(-1) ?? "";
  subject = subject.replace(/::?(before|after|backdrop|placeholder|marker)\b/g, "");
  let previous = "";
  while (previous !== subject) { previous = subject; subject = subject.replace(/:(not|is|where|has)\((?:[^()]|\([^()]*\))*\)/g, ""); }
  return subject.replace(/:[a-z-]+(\([^)]*\))?/g, "");
}

export function isGenericSubject(selector: string): boolean {
  const subject = subjectOf(selector);
  if (/\[[^\]]+\]/.test(subject) || /#[\w-]/.test(subject)) return false;
  const classes = [...subject.matchAll(/\.((?:\\.|[\w-])+)/g)].map((match) => match[1].replace(/\\/g, ""));
  return classes.every((name) => GENERIC_CLASS.test(name));
}

export function offendingRules(cssText: string, window: JSDOM["window"]): string[] {
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync(cssText);
  const found: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) walk(nested);
      const text = (rule as CSSStyleRule).selectorText;
      if (!text) continue;
      for (const selector of splitTop(text, ",")) if (selector.includes(":has(") && isGenericSubject(selector)) found.push(selector);
    }
  };
  walk(sheet.cssRules);
  return found;
}

test("subject classification follows the measured rule", () => {
  assert.equal(isGenericSubject('[data-scroll-footer]:has(.chat-prompt-box) [data-promptbox-shell] > .grid > *'), true);
  assert.equal(isGenericSubject('[data-promptbox-shell] > .grid :has(> .agentation-staging-shell)'), true);
  assert.equal(isGenericSubject('[data-promptbox-compact-content] .ProseMirror:has(.prompt-mention-pill) > *'), true);
  assert.equal(isGenericSubject('.rounded-xl:has(> .mt-2.space-y-2) > .mt-2.space-y-2 > .flex:not(:has(img)) > :is(a, button, span)'), true);
  assert.equal(isGenericSubject('section[aria-label="Queued messages"]:has([data-queued-messages-mode]) [data-queued-messages-scroll-frame]'), false);
  assert.equal(isGenericSubject('[data-scroll-footer]:has(.chat-prompt-box) .chat-prompt-box'), false);
});

test("no injected rule pairs :has() with a generic subject", () => {
  const dom = new JSDOM("<html><head></head><body></body></html>", { pretendToBeVisual: true });
  const { document } = dom.window;
  dom.window.matchMedia = () => ({ matches: false } as MediaQueryList);
  const keys = ["document", "HTMLElement", "Element", "Node", "SVGElement", "MutationObserver", "getComputedStyle"] as const;
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) {
    const value = key === "document" ? document : key === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const stops = [injectComposerGlass, injectComposerInfo, injectMentionPills, injectQuotePill, injectQueuedMessages, injectThreadToc, injectUserAttachments, injectWorkspaceDiffPill]
    .map((inject) => inject(document));
  try {
    const offenders = Array.from(document.querySelectorAll("style"))
      .flatMap((style) => offendingRules(style.textContent ?? "", dom.window).map((selector) => `${style.id}: ${selector}`));
    assert.deepEqual(offenders, [], `:has() with a generic subject:\n${offenders.join("\n")}`);
  } finally {
    for (const stop of stops) stop();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    dom.window.close();
  }
});
