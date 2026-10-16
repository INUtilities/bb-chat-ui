import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectQuoteMentions } from "./quote-mention.ts";

function fixture() {
  const dom = new JSDOM('<body><aside></aside><main></main></body>');
  const { document } = dom.window;
  const keys = ["Node", "Element", "HTMLElement", "SVGElement", "MutationObserver"] as const;
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  // jsdom does not reflect contentEditable. Use the native string reflection
  // contract so attribute observers see the writes made by the product code.
  Object.defineProperty(dom.window.HTMLElement.prototype, "contentEditable", {
    configurable: true,
    get() { return this.getAttribute("contenteditable") ?? "inherit"; },
    set(value: string) { this.setAttribute("contenteditable", value); },
  });
  const quote = (icon = "MessageSquare") => {
    const node = document.createElement("span");
    node.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", itemId: "quote:test", icon }));
    node.innerHTML = '<span><span data-icon-root data-icon="Native"></span></span>';
    document.querySelector("main")!.append(node);
    return node;
  };
  return { dom, document, quote, tick: () => new Promise<void>(resolve => setImmediate(resolve)), cleanup() {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  } };
}

test("unrelated document changes do not rewrite an already locked quote", async () => {
  const f = fixture();
  const quote = f.quote();
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    assert.equal(quote.contentEditable, "false");
    let writes = 0;
    const observer = new f.dom.window.MutationObserver(records => { writes += records.length; });
    observer.observe(quote, { attributes: true, attributeFilter: ["contenteditable"] });
    for (let i = 0; i < 3; i++) {
      f.document.querySelector("aside")!.append(f.document.createElement("div"));
      await f.tick();
    }
    assert.equal(writes, 0, "same-value locks must not notify other mention observers");
    observer.disconnect();
  } finally { stop(); f.cleanup(); }
});

test("sidebar mutations skip document-wide quote scans while nested new quotes are locked", async () => {
  const f = fixture();
  f.quote();
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    let fullScans = 0;
    const query = f.document.querySelectorAll.bind(f.document);
    f.document.querySelectorAll = ((selector: string) => {
      if (selector === "[data-prompt-mention-resource]") fullScans++;
      return query(selector);
    }) as typeof f.document.querySelectorAll;
    f.document.querySelector("aside")!.innerHTML = '<div><span>New sidebar row</span></div>';
    await f.tick();
    assert.equal(fullScans, 0);
    const nested = f.document.createElement("section");
    nested.innerHTML = '<span data-prompt-mention-resource=\'{"kind":"plugin","itemId":"quote:new","icon":"MessageSquare"}\'></span>';
    f.document.querySelector("main")!.append(nested);
    await f.tick();
    assert.equal(nested.querySelector("span")!.contentEditable, "false");
    assert.equal(fullScans, 0);
  } finally { stop(); f.cleanup(); }
});

test("resource replacement and host editable resets update only the affected quote", async () => {
  const f = fixture();
  const quote = f.quote();
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    quote.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", itemId: "quote:changed", icon: "Quote" }));
    await f.tick();
    assert.equal(quote.getAttribute("data-bb-chat-ui-quote-icon"), "selection");
    assert.ok(quote.querySelector("[data-bb-chat-ui-quote-glyph]"));
    quote.contentEditable = "true";
    await f.tick();
    assert.equal(quote.contentEditable, "false");
    const icon = quote.querySelector("[data-icon-root]")!;
    icon.parentElement!.innerHTML = '<span data-icon-root data-icon="Replacement"></span>';
    await f.tick();
    assert.ok(quote.querySelector("[data-bb-chat-ui-quote-glyph]"), "host icon replacement is decorated again");
    stop();
    quote.contentEditable = "true";
    await f.tick();
    assert.equal(quote.contentEditable, "true", "dispose stops observing");
  } finally { stop(); f.cleanup(); }
});

test("code quotes still receive a Diff icon when its native source arrives later", async () => {
  const f = fixture();
  const quote = f.quote("FileDiff");
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    assert.equal(quote.querySelector("[data-bb-chat-ui-code-icon]"), null);
    const toggle = f.document.createElement("button");
    toggle.id = "thread-prompt-banner-git-toggle";
    f.document.body.append(toggle);
    await f.tick();
    toggle.innerHTML = '<span data-icon="FileDiff">Diff</span>';
    await f.tick();
    assert.equal(quote.querySelector("[data-bb-chat-ui-code-icon]")?.textContent, "Diff");
  } finally { stop(); f.cleanup(); }
});

test("a new quote still deletes as one editor node with Backspace", async () => {
  const f = fixture();
  f.document.querySelector("main")!.className = "ProseMirror";
  const stop = injectQuoteMentions(f.document);
  try {
    const quote = f.quote("Quote");
    const deleted: number[][] = [];
    const sent: unknown[] = [];
    const transaction = { delete(from: number, to: number) { deleted.push([from, to]); return this; } };
    Object.assign(quote, { pmViewDesc: { posBefore: 2, posAfter: 3, view: {
      state: { tr: transaction }, dispatch(value: unknown) { sent.push(value); },
    } } });
    await f.tick();
    const event = new f.dom.window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    quote.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(deleted, [[2, 3]]);
    assert.deepEqual(sent, [transaction]);
  } finally { stop(); f.cleanup(); }
});
