import assert from "node:assert/strict";
import test from "node:test";

import {
  injectQuotePill,
  quoteInputAction,
  quoteKeyAction,
  quotePointerAction,
  quotePillCss,
} from "./quote-pill.ts";

const outside = { quoteBeforeCaret: false, quoteAfterCaret: false };

test("blocks typing inside a quote and moves the caret out", () => {
  assert.equal(
    quoteKeyAction({ key: "a", insideQuote: true, ...outside }),
    "block",
  );
  assert.equal(
    quoteKeyAction({ key: "Enter", insideQuote: true, ...outside }),
    "block",
  );
  assert.equal(
    quoteKeyAction({ key: "ArrowLeft", insideQuote: true, ...outside }),
    "skip-before",
  );
  assert.equal(
    quoteKeyAction({ key: "ArrowRight", insideQuote: true, ...outside }),
    "skip-after",
  );
});

test("deletes a quote as one character from inside or from its edge", () => {
  assert.equal(
    quoteKeyAction({ key: "Backspace", insideQuote: true, ...outside }),
    "delete",
  );
  assert.equal(
    quoteKeyAction({
      key: "Backspace",
      insideQuote: false,
      quoteBeforeCaret: true,
      quoteAfterCaret: false,
    }),
    "delete",
  );
  assert.equal(
    quoteKeyAction({
      key: "Delete",
      insideQuote: false,
      quoteBeforeCaret: false,
      quoteAfterCaret: true,
    }),
    "delete",
  );
  assert.equal(
    quoteKeyAction({
      key: "ArrowLeft",
      insideQuote: false,
      quoteBeforeCaret: true,
      quoteAfterCaret: false,
    }),
    "skip-before",
  );
  assert.equal(
    quoteKeyAction({
      key: "ArrowRight",
      insideQuote: false,
      quoteBeforeCaret: false,
      quoteAfterCaret: true,
    }),
    "skip-after",
  );
});

test("leaves keys outside a quote alone", () => {
  assert.equal(
    quoteKeyAction({ key: "a", insideQuote: false, ...outside }),
    "ignore",
  );
  assert.equal(
    quoteKeyAction({ key: "Backspace", insideQuote: false, ...outside }),
    "ignore",
  );
});

test("removes a composer quote only from its real control", () => {
  assert.equal(
    quotePointerAction({
      insideQuote: true,
      removeButton: true,
    }),
    "remove",
  );
  assert.equal(
    quotePointerAction({
      insideQuote: true,
      removeButton: false,
    }),
    "block",
  );
  assert.equal(
    quotePointerAction({
      insideQuote: true,
      removeButton: false,
    }),
    "block",
  );
});

test("backspace on a touch keyboard deletes the whole quote", () => {
  const inside = {
    insideQuote: true,
    quoteBeforeCaret: false,
    quoteAfterCaret: false,
  };
  assert.equal(
    quoteInputAction({ inputType: "deleteContentBackward", ...inside }),
    "delete",
  );
  assert.equal(
    quoteInputAction({ inputType: "insertText", ...inside }),
    "block",
  );
  assert.equal(
    quoteInputAction({
      inputType: "deleteContentBackward",
      insideQuote: false,
      quoteBeforeCaret: true,
      quoteAfterCaret: false,
    }),
    "delete",
  );
  assert.equal(
    quoteInputAction({
      inputType: "insertText",
      insideQuote: false,
      quoteBeforeCaret: false,
      quoteAfterCaret: false,
    }),
    "ignore",
  );
});

test("ignores pointers outside a quote", () => {
  assert.equal(
    quotePointerAction({
      insideQuote: false,
      removeButton: true,
    }),
    "ignore",
  );
});

test("paints the pill without watching or rewriting the quote node", () => {
  const css = quotePillCss();
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /text-overflow:\s*ellipsis/);
  assert.match(css, /border-radius:\s*9999px/);
  assert.match(css, /padding:\s*0px 14px 0px var\(--bb-chat-ui-pill-reference-pad-left, 12px\) !important/);
  assert.doesNotMatch(css, /data-prompt-mention-resource\*=/);
  assert.match(css, /data-promptbox-editor-content\] \.ProseMirror blockquote/);
  const mentionAt = css.indexOf("[data-promptbox-editor-content] .ProseMirror blockquote");
  const mentionSelector = css.slice(css.lastIndexOf("\n", mentionAt), mentionAt);
  assert.doesNotMatch(mentionSelector, /:not\(\[data-promptbox-compact-content\]\)/);
  assert.match(
    css,
    /\[data-promptbox-compact-content\]\[data-bb-chat-ui-has-quote-mention\] \.ProseMirror\s*\{[^}]*display:\s*flex !important;[^}]*align-items:\s*center !important;/,
  );
  assert.match(
    css,
    /\[data-promptbox-compact-content\]\[data-bb-chat-ui-has-quote-mention\] \.ProseMirror > \*\s*\{[^}]*display:\s*flex !important;[^}]*align-items:\s*center !important;[^}]*height:\s*100%;/,
  );
  assert.match(css, /html\[data-bb-chat-ui-root-device="phone"\]/);
  assert.doesNotMatch(css, /max-height:\s*20px/);
  assert.doesNotMatch(css, /contenteditable/i);
  const sentQuote = css.match(/\[data-message-column\] > \.group\\\/message blockquote,[\s\S]*?\{[^}]*\}/);
  assert.ok(sentQuote);
  assert.match(sentQuote[0], /padding:\s*0px 12px 0px var\(--bb-chat-ui-pill-reference-pad-left, 10px\) !important/);
  assert.match(sentQuote[0], /min-height:\s*var\(--bb-chat-ui-pill-reference-min-height, 22px\)/);
  assert.match(sentQuote[0], /font-size:\s*var\(--bb-chat-ui-pill-reference-font-size, 13px\)/);
  assert.doesNotMatch(sentQuote[0], /itemId/);

  let observed = false;
  const originalObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {
      observed = true;
    }
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof MutationObserver;

  const listeners = new Map<string, Array<(event: Event) => void>>();
  const style = {
    id: "",
    textContent: "",
    remove() {},
  };
  const document = {
    createElement() {
      return style;
    },
    head: { append() {} },
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
    const cleanup = injectQuotePill(document as unknown as Document);
    cleanup();
  } finally {
    globalThis.MutationObserver = originalObserver;
  }

  assert.equal(observed, false);
  assert.deepEqual([...listeners.values()].flat(), []);
});
