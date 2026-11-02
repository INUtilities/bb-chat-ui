import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectQuoteMentions } from "./quote-mention.ts";

// 인용 표시와 해제를 검사할 독립 문서를 만든다.
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

test("all quote kinds use their own glyph without a native Diff source", async () => {
  const f = fixture();
  const quotes = [f.quote("Quote"), f.quote("MessageSquare"), f.quote("FileDiff")];
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    const masks = quotes.map(quote => {
      const glyph = quote.querySelector<HTMLElement>("[data-bb-chat-ui-quote-glyph]");
      assert.ok(glyph, "each quote has an icon before any host Diff control exists");
      assert.match(glyph.style.mask, /data:image\/svg\+xml/);
      assert.equal(quote.querySelector<HTMLElement>("[data-icon-root]")?.style.display, "none");
      return glyph.style.mask;
    });
    assert.equal(new Set(masks).size, 3, "generic, whole-message and Diff glyphs stay distinct");
    assert.deepEqual(quotes.map(quote => quote.getAttribute("data-bb-chat-ui-quote-icon")),
      ["selection", "whole", "code"]);
  } finally { stop(); f.cleanup(); }
});

test("missing host icons and SDK resources still show the shared quote asset", async () => {
  const f = fixture();
  const generic = f.quote();
  generic.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", itemId: "quote:old", icon: null }));
  generic.replaceChildren(f.document.createTextNode("old quote"));
  const sdk = f.quote();
  sdk.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", pluginId: "bb-chat-ui", provider: "quote", id: "sdk", icon: "MessageSquare" }));
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    assert.ok(generic.querySelector("[data-bb-chat-ui-quote-glyph]"));
    assert.equal(generic.getAttribute("data-bb-chat-ui-quote-icon"), "selection");
    assert.equal(sdk.getAttribute("data-bb-chat-ui-quote-icon"), "whole");
    generic.insertAdjacentHTML("beforeend", '<span data-icon-root data-icon="Late"></span>');
    await f.tick();
    assert.equal(generic.querySelectorAll("[data-bb-chat-ui-quote-glyph]").length, 1);
    assert.equal(generic.querySelector<HTMLElement>("[data-icon-root]")?.style.display, "none");
  } finally { stop(); f.cleanup(); }
});

// 새 코드 인용과 이전 변경 내용 인용에 같은 자산을 표시한다.
test("new Code and saved FileDiff quotes share one code icon", async () => {
  const f = fixture();
  const quotes = [f.quote("Code"), f.quote("FileDiff")];
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    const glyphs = quotes.map(node => node.querySelector<HTMLElement>("[data-bb-chat-ui-quote-glyph]")!);
    assert.equal(quotes[0].getAttribute("data-bb-chat-ui-quote-icon"), "code");
    assert.equal(quotes[1].getAttribute("data-bb-chat-ui-quote-icon"), "code");
    assert.equal(glyphs[0].style.mask, glyphs[1].style.mask);
  } finally { stop(); f.cleanup(); }
});

// 실제 파일 멘션만 장식하고 인용 편집·열기 동작은 적용하지 않는다.
test("native file mentions get a shared glyph without becoming quotes", async () => {
  const f = fixture();
  const file = f.quote();
  file.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "path", entryKind: "file", source: "workspace", path: "example.ts", label: "example.ts" }));
  file.contentEditable = "true";
  const others = [
    { kind: "path", entryKind: "directory", label: "example.ts" },
    { kind: "attachment", path: "example.ts", label: "example.ts" },
    { kind: "plugin", itemId: "file:example.ts", label: "example.ts" },
  ].map(resource => {
    const node = f.quote();
    node.setAttribute("data-prompt-mention-resource", JSON.stringify(resource));
    return node;
  });
  const code = f.quote("Code");
  let clicks = 0;
  file.addEventListener("click", () => { clicks++; });
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    const glyph = file.querySelector<HTMLElement>("[data-bb-chat-ui-quote-glyph]");
    assert.ok(glyph);
    assert.equal(file.getAttribute("data-bb-chat-ui-quote-icon"), "file");
    assert.notEqual(glyph.style.mask, code.querySelector<HTMLElement>("[data-bb-chat-ui-quote-glyph]")!.style.mask);
    assert.equal(file.contentEditable, "true");
    assert.equal(file.hasAttribute("role"), false);
    assert.equal(file.hasAttribute("tabindex"), false);
    file.click();
    assert.equal(clicks, 1, "native file opening remains available");
    for (const node of others) assert.equal(node.querySelector("[data-bb-chat-ui-quote-glyph]"), null);
  } finally { stop(); f.cleanup(); }
});

// 파일 재사용·호스트 아이콘 교체·분리 때 소유 glyph와 표시를 복구한다.
test("file glyphs follow host replacements and release reused or detached nodes", async () => {
  const f = fixture();
  const files = [f.quote(), f.quote()];
  for (const file of files) file.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "path", entryKind: "file", source: "thread-storage", path: "report.md", label: "report.md" }));
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    const replacement = f.document.createElement("span");
    replacement.setAttribute("data-icon-root", "");
    replacement.style.setProperty("display", "inline-flex", "important");
    files[0].querySelector("[data-icon-root]")!.replaceWith(replacement);
    await f.tick();
    assert.equal(replacement.style.display, "none");
    assert.equal(files[0].querySelectorAll("[data-bb-chat-ui-quote-glyph]").length, 1);
    files[0].setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "path", entryKind: "directory", label: "folder" }));
    files[1].remove();
    await f.tick();
    for (const node of files) {
      assert.equal(node.querySelector("[data-bb-chat-ui-quote-glyph]"), null);
      assert.equal(node.hasAttribute("data-bb-chat-ui-quote-icon"), false);
    }
    assert.equal(replacement.style.display, "inline-flex");
    assert.equal(replacement.style.getPropertyPriority("display"), "important");
  } finally { stop(); f.cleanup(); }
});

test("changing quote kinds and disposing preserves original host icon contents and display", async () => {
  const f = fixture();
  const quote = f.quote("Quote");
  const icon = quote.querySelector<HTMLElement>("[data-icon-root]")!;
  icon.innerHTML = "<svg><path></path></svg>";
  icon.style.setProperty("display", "inline-flex", "important");
  const original = icon.innerHTML;
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    for (const kind of ["MessageSquare", "FileDiff", "Quote"]) {
      quote.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", itemId: "quote:same", icon: kind }));
      await f.tick();
      assert.equal(quote.querySelectorAll("[data-bb-chat-ui-quote-glyph]").length, 1);
      assert.equal(icon.innerHTML, original);
    }
    stop();
    assert.equal(quote.querySelector("[data-bb-chat-ui-quote-glyph]"), null);
    assert.equal(quote.hasAttribute("data-bb-chat-ui-quote-icon"), false);
    assert.equal(icon.style.display, "inline-flex");
    assert.equal(icon.style.getPropertyPriority("display"), "important");
    assert.equal(icon.innerHTML, original);
  } finally { stop(); f.cleanup(); }
});

test("a reused or removed quote releases its owned glyph", async () => {
  const f = fixture();
  const quote = f.quote("MessageSquare");
  const detached = f.quote("FileDiff");
  const stop = injectQuoteMentions(f.document);
  try {
    await f.tick();
    quote.setAttribute("data-prompt-mention-resource", JSON.stringify({ kind: "plugin", itemId: "file:reused" }));
    detached.remove();
    await f.tick();
    for (const node of [quote, detached]) {
      assert.equal(node.querySelector("[data-bb-chat-ui-quote-glyph]"), null);
      assert.equal(node.hasAttribute("data-bb-chat-ui-quote-icon"), false);
      assert.equal(node.querySelector<HTMLElement>("[data-icon-root]")?.style.display, "");
    }
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

test("late host Diff controls cannot replace the shared code glyph", async () => {
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
    assert.ok(code.querySelector('[data-bb-chat-ui-quote-glyph]'));
    assert.equal(code.querySelector('[data-bb-chat-ui-code-icon]'), null);
    assert.equal(code.textContent?.includes('Diff'), false);
  } finally { stop(); f.cleanup(); }
});
