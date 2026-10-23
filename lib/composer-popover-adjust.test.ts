import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { composerInfoCss } from "./composer-info.ts";
import { queuedMessagesCss } from "./queued-messages.ts";

function surface(kind: string, html: string, hit = "small", host = "") {
  const labels: Record<string, string> = { queue: "Queued messages", background: "Background activity", machine: "Machine status" };
  const label = labels[kind] ?? "Thread context before sending";
  const dom = new JSDOM(`<html data-bb-chat-ui-root-hit-target="${hit}"><head><style>${host}\n${composerInfoCss}\n${queuedMessagesCss}</style></head><body><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack><section aria-label="${label}" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="${kind}">${html}</section></div></div></body></html>`);
  const document = dom.window.document;
  const css = (selector: string) => dom.window.getComputedStyle(document.querySelector(selector)!);
  return { dom, document, css };
}

test("queued message rows keep a padded hover gutter and two-pixel rhythm without separators", () => {
  const f = surface("queue", '<div data-queued-messages-scroll-frame><div data-queued-messages-scroll><ul><li data-queued-message-row>First</li><li data-queued-message-row>Second</li><li data-queued-message-group-divider><button>Messages above send together</button></li></ul></div></div>', "small", '[data-queued-message-row]{border-bottom:1px solid; padding:4px 0}');
  try {
    const row = f.css("[data-queued-message-row]");
    assert.equal(row.minHeight, "32px");
    assert.equal(row.padding, "8px");
    assert.equal(row.borderRadius, "10px");
    assert.equal(row.borderBottomWidth, "0px");
    assert.equal(row.marginLeft, "-8px");
    assert.equal(row.transition, "background-color 150ms ease-out");
    assert.equal(f.css("ul").rowGap, "2px");
    assert.equal(f.css("[data-queued-messages-scroll]").paddingLeft, "8px");
    assert.equal(f.document.querySelectorAll("[data-queued-message-group-divider] button").length, 1);
  } finally { f.dom.window.close(); }
});

test("a native single background command shares row geometry without changing its action", () => {
  const f = surface("background", '<div class="flex"><div role="button" tabindex="0" class="px-3" aria-label="Background command: npm test"><span>npm test</span></div><button data-bb-chat-ui-card-head>Background</button></div>');
  try {
    const row = f.css('[role="button"]');
    assert.equal(row.padding, "8px");
    assert.equal(row.minHeight, "32px");
    assert.equal(row.borderRadius, "10px");
    assert.equal(row.marginLeft, "-8px");
    assert.equal(row.transition, "background-color 150ms ease-out");
    assert.equal(f.document.querySelector('[role="button"]')!.getAttribute("tabindex"), "0");
  } finally { f.dom.window.close(); }
});
