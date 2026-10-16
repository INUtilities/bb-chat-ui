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
