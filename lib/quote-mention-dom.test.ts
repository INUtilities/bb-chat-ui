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

test("reprocessing unchanged quote contents does not rewrite styles or icon markers", async () => {
  const f = fixture();
  const quotes = [f.quote("MessageSquare"), f.quote("Quote"), f.quote("FileDiff")];
  const stop = injectQuoteMentions(f.document);
  const records: MutationRecord[] = [];
  const observer = new f.dom.window.MutationObserver(batch => records.push(...batch));
  try {
    await f.tick();
    for (const quote of quotes) observer.observe(quote, {
      attributes: true, subtree: true,
      attributeFilter: ["contenteditable", "style", "data-bb-chat-ui-quote-icon"],
    });
    // Host content changes must still be observed without rewriting the
    // already correct presentation of any of the three quote kinds.
    for (const quote of quotes) quote.append(f.document.createTextNode("updated label"));
    await f.tick();
    assert.deepEqual(records.map(record => record.attributeName), [],
      "an unchanged quote presentation must not invalidate styles again");
  } finally { observer.disconnect(); stop(); f.cleanup(); }
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
      if (selector.includes("[data-prompt-mention-resource]")) fullScans++;
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

test("one new quote is decorated once without rescanning its generated subtree", async () => {
  const f = fixture();
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    let queries = 0;
    const proto = f.dom.window.Element.prototype, query = proto.querySelector, all = proto.querySelectorAll;
    proto.querySelector = function(selector: string) { queries++; return query.call(this, selector); };
    proto.querySelectorAll = function(selector: string) { queries++; return all.call(this, selector); };
    const quote = f.quote('Quote');
    await f.tick();
    const count = queries;
    assert.equal(quote.contentEditable, 'false');
    assert.ok(quote.querySelector('[data-bb-chat-ui-quote-glyph]'));
    assert.ok(count <= 5, `one resource must need at most five selector queries, got ${count}`);
  } finally { stop(); f.cleanup(); }
});

test("late Diff source searches only code quotes still waiting for it", async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) f.quote('Quote');
  const code = f.quote('FileDiff');
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    let scans = 0;
    const proto = f.dom.window.Element.prototype, all = proto.querySelectorAll;
    proto.querySelectorAll = function(selector: string) {
      if (selector.includes('[data-prompt-mention-resource]')) scans++;
      return all.call(this, selector);
    };
    const source = f.document.createElement('button');
    source.id = 'thread-prompt-banner-git-toggle';
    source.innerHTML = '<span data-icon="FileDiff">Diff</span>';
    f.document.body.append(source); await f.tick();
    assert.equal(scans, 1, 'scan the added source subtree, never the document root');
    assert.equal(code.querySelector('[data-bb-chat-ui-code-icon]')?.textContent, 'Diff');
  } finally { stop(); f.cleanup(); }
});
