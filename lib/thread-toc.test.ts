import assert from "node:assert/strict";
import test from "node:test";

import {
  injectThreadToc,
  listIndexForTick,
  threadTocCss,
  tickWidth,
} from "./thread-toc.ts";

test("frosts the toc card with the composer glass", () => {
  const card = String.raw`\[id\^="thread-toc-panel-"\] > \.rounded-lg`;
  assert.match(
    threadTocCss,
    new RegExp(
      `${card}\\s*\\{[^}]*backdrop-filter:\\s*blur\\(14px\\) saturate\\(1\\.25\\);`,
    ),
  );
  assert.match(
    threadTocCss,
    new RegExp(
      `${card}\\s*\\{[^}]*background:\\s*oklch\\(from var\\(--bb-chat-ui-glass-base, var\\(--background\\)\\) min\\(1, calc\\(l \\+ 0\\.075\\)\\) c h \/ 0\\.68\\) !important;`,
    ),
  );
  assert.match(threadTocCss, /oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.76\)/);
  assert.match(
    threadTocCss,
    /\.dark \[id\^="thread-toc-panel-"\] > \.rounded-lg\s*\{[^}]*background:\s*oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.76\) !important;/,
  );
});

test("gives the tick under the pointer the long hover length", () => {
  assert.equal(tickWidth(0), 32);
});

test("keeps a distant tick at the longer rest length", () => {
  assert.equal(tickWidth(48), 10);
  assert.equal(tickWidth(80), 10);
});

test("shortens ticks as they get farther from the pointer", () => {
  const near = tickWidth(8);
  const mid = tickWidth(24);
  assert.ok(near < 32);
  assert.ok(near > mid);
  assert.ok(mid > 10);
});

test("maps a tick onto the same list row when every message has a tick", () => {
  assert.equal(listIndexForTick(0, 5, 5), 0);
  assert.equal(listIndexForTick(2, 5, 5), 2);
  assert.equal(listIndexForTick(4, 5, 5), 4);
});

test("maps sampled ticks across a longer message list", () => {
  assert.equal(listIndexForTick(0, 3, 7), 0);
  assert.equal(listIndexForTick(1, 3, 7), 3);
  assert.equal(listIndexForTick(2, 3, 7), 6);
});

test("keeps rail clicks and leave working after the button is replaced", () => {
  const previous = {
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
    Node: globalThis.Node,
    MutationObserver: globalThis.MutationObserver,
  };
  let repaint: ((records: MutationRecord[]) => void) | null = null;
  class DomNode {
    parent: DomNode | null = null;
    contains(other: DomNode | null): boolean {
      let current: DomNode | null = other;
      while (current) {
        if (current === this) return true;
        current = current.parent;
      }
      return false;
    }
  }
  class DomElement extends DomNode {
    children: DomElement[] = [];
    attrs = new Map<string, string>();
    classList: string[];
    listeners: Array<{
      type: string;
      fn: (event: Event) => void;
      capture: boolean;
    }> = [];
    ownerDocument: unknown = null;
    textContent = "";
    id = "";
    styleWidth = "";
    top = 0;
    clicks = 0;
    tag: string;
    constructor(tag: string, className = "") {
      super();
      this.tag = tag;
      this.classList = className.split(/\s+/).filter(Boolean);
    }
    get isConnected() {
      let root: DomNode = this;
      while (root.parent) root = root.parent;
      return root === body;
    }
    get style() {
      const el = this;
      return {
        get width() {
          return el.styleWidth;
        },
        set width(value: string) {
          el.styleWidth = value;
        },
        removeProperty(name: string) {
          if (name === "width") el.styleWidth = "";
        },
      };
    }
    hasAttribute(name: string) {
      return this.attrs.has(name);
    }
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
    }
    removeAttribute(name: string) {
      this.attrs.delete(name);
    }
    getAttribute(name: string) {
      return this.attrs.get(name) ?? null;
    }
    append(child: DomElement) {
      child.parent = this;
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    }
    addEventListener(
      type: string,
      fn: (event: Event) => void,
      capture?: boolean,
    ) {
      this.listeners.push({ type, fn, capture: capture === true });
    }
    removeEventListener(
      type: string,
      fn: (event: Event) => void,
      capture?: boolean,
    ) {
      this.listeners = this.listeners.filter(
        (entry) =>
          !(
            entry.type === type &&
            entry.fn === fn &&
            entry.capture === (capture === true)
          ),
      );
    }
    closest(selector: string): DomElement | null {
      let current: DomNode | null = this;
      while (current instanceof DomElement) {
        if (matches(current, selector)) return current;
        current = current.parent;
      }
      return null;
    }
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    querySelectorAll(selector: string): DomElement[] {
      return queryAll(this, selector);
    }
    getBoundingClientRect() {
      return { top: this.top, height: 3 };
    }
    click() {
      this.clicks += 1;
    }
    remove() {
      const parent = this.parent;
      if (!(parent instanceof DomElement)) return;
      parent.children = parent.children.filter((child) => child !== this);
      this.parent = null;
    }
  }
  class DomButton extends DomElement {}
  globalThis.Node = DomNode as unknown as typeof Node;
  globalThis.HTMLElement = DomElement as unknown as typeof HTMLElement;
  globalThis.HTMLButtonElement = DomButton as unknown as typeof HTMLButtonElement;
  globalThis.MutationObserver = class {
    constructor(callback: (records: MutationRecord[]) => void) {
      repaint = callback;
    }
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof MutationObserver;

  const head = new DomElement("head");
  const body = new DomElement("body");
  const document = {
    head,
    body,
    activeElement: null,
    createElement(tag: string) {
      const el = new DomElement(tag);
      el.ownerDocument = this;
      return el;
    },
    querySelectorAll(selector: string) {
      return queryAll(body, selector);
    },
  };
  body.ownerDocument = document;
  const root = new DomElement("div");
  root.setAttribute("data-thread-toc", "");
  root.ownerDocument = document;
  const firstButton = new DomButton("button", "no-scrollbar");
  firstButton.append(new DomElement("span", "rounded-full"));
  root.append(firstButton);
  body.append(root);
  const card = new DomElement("div");
  root.append(card);

  try {
    const cleanup = injectThreadToc(document as unknown as Document);
    const liveButton = new DomButton("button", "no-scrollbar");
    const liveTick = new DomElement("span", "rounded-full");
    liveTick.style.width = "32px";
    liveButton.append(liveTick);
    firstButton.remove();
    root.append(liveButton);
    repaint?.([{ target: root, addedNodes: [liveButton] } as unknown as MutationRecord]);

    const middleTick = new DomElement("span", "rounded-full");
    middleTick.top = 10;
    const lastTick = new DomElement("span", "rounded-full");
    lastTick.top = 20;
    liveButton.append(middleTick);
    liveButton.append(lastTick);

    // A first click opens the host panel; navigate once its rows arrive.
    clickRail(liveButton, 11);
    const panel = new DomElement("div");
    panel.id = "thread-toc-panel-test";
    const list = new DomElement("ul");
    const targets = Array.from({ length: 7 }, () => new DomButton("button"));
    for (const target of targets) {
      const item = new DomElement("li");
      item.append(target);
      list.append(item);
    }
    panel.append(list);
    root.append(panel);
    repaint?.([{ target: root, addedNodes: [panel] } as unknown as MutationRecord]);
    assert.equal(targets[3].clicks, 1);
    repaint?.([{ target: root, addedNodes: [] } as unknown as MutationRecord]);
    assert.equal(targets[3].clicks, 1);

    clickRail(liveButton, 21);
    assert.equal(targets[6].clicks, 1);

    // Keyboard activation keeps the currently previewed target.
    clickRail(liveButton, 0, 0);
    assert.equal(targets[6].clicks, 2);
    clickRail(liveButton, 1);
    assert.equal(targets[0].clicks, 1);

    leave(root, new DomElement("div"));
    assert.equal(liveTick.style.width, "");

    liveTick.style.width = "32px";
    leave(root, card);
    assert.equal(liveTick.style.width, "32px");
    cleanup();
    clickRail(liveButton, 21);
    assert.equal(targets[6].clicks, 2);
  } finally {
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.HTMLButtonElement = previous.HTMLButtonElement;
    globalThis.Node = previous.Node;
    globalThis.MutationObserver = previous.MutationObserver;
  }

  function leave(root: DomElement, related: DomNode | null) {
    const event = { relatedTarget: related } as unknown as Event;
    for (const listener of root.listeners) {
      if (listener.type === "mouseleave") listener.fn(event);
    }
  }
  function clickRail(button: DomElement, clientY: number, detail = 1) {
    const event = { clientY, detail } as unknown as Event;
    for (const listener of button.listeners) {
      if (listener.type === "click") listener.fn(event);
    }
  }
  function queryAll(scope: DomElement, selector: string): DomElement[] {
    if (selector === "ul > li") {
      return queryAll(scope, "ul").flatMap((list) =>
        list.children.filter((child) => child.tag === "li"),
      );
    }
    const parts = selector.trim().split(/\s+/);
    const [first, ...rest] = parts;
    const found: DomElement[] = [];
    walk(scope, (el) => {
      if (!first || !matches(el, first)) return;
      if (rest.length === 0) found.push(el);
      else found.push(...queryAll(el, rest.join(" ")));
    });
    return found;
  }
  function walk(scope: DomElement, visit: (el: DomElement) => void) {
    for (const child of scope.children) {
      visit(child);
      walk(child, visit);
    }
  }
  function matches(el: DomElement, selector: string): boolean {
    const prefix = selector.match(/^\[([^=\]]+)\^="([^"]+)"\]$/);
    if (prefix) {
      const value =
        prefix[1] === "id" ? el.id : (el.getAttribute(prefix[1]) ?? "");
      return value.startsWith(prefix[2]);
    }
    const attr = selector.match(/^\[([^\]]+)\]$/);
    if (attr) return el.hasAttribute(attr[1]);
    const classed = selector.match(/^([a-z]+)\.([A-Za-z0-9_-]+)$/);
    if (classed) {
      return el.tag === classed[1] && el.classList.includes(classed[2]);
    }
    return el.tag === selector;
  }
});
