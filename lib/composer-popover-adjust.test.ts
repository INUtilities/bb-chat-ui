import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolvedStyle } from "./test-style.ts";
import { composerInfoCss } from "./composer-info.ts";
import { queuedMessagesCss } from "./queued-messages.ts";

function surface(kind: string, html: string, hit = "small", host = "", device = "desktop") {
  const labels: Record<string, string> = { queue: "Queued messages", background: "Background activity", machine: "Machine status" };
  const label = labels[kind] ?? "Thread context before sending";
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${device}" data-bb-chat-ui-root-hit-target="${hit}"><head><style>${host}\n${composerInfoCss}\n${queuedMessagesCss}</style></head><body><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack><section aria-label="${label}" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="${kind}">${html}</section></div></div></body></html>`);
  const document = dom.window.document;
  const css = (selector: string) => resolvedStyle(document.querySelector(selector)!);
  return { dom, document, css };
}

for (const device of ["desktop", "phone"]) {
const phone = device === "phone";
const makeSurface = (kind: string, html: string, hit = "small", host = "") => surface(kind, html, hit, host, device);

test(`queued message rows use the compact density exception without separators (${device})`, () => {
  const f = makeSurface("queue", '<div data-queued-messages-scroll-frame><div data-queued-messages-scroll><ul><li data-queued-message-row>First</li><li data-queued-message-row>Second</li><li data-queued-message-group-divider><button>Messages above send together</button></li></ul></div></div>', "small", '[data-queued-message-row]{border-bottom:1px solid; padding:4px 0}');
  try {
    const row = f.css("[data-queued-message-row]");
    assert.equal(row.minHeight, phone ? "32px" : "24px");
    assert.equal(row.padding, phone ? "4px 6px" : "2px 4px");
    assert.equal(row.borderRadius, phone ? "10px" : "8px");
    assert.equal(row.borderBottomWidth, "0px");
    assert.equal(row.marginLeft, phone ? "-6px" : "-4px");
    assert.equal(row.transition, "background-color 150ms ease-out");
    assert.equal(f.css("ul").rowGap, "0px");
    assert.equal(f.css("[data-queued-messages-scroll]").paddingLeft, phone ? "6px" : "4px");
    assert.equal(f.document.querySelectorAll("[data-queued-message-group-divider] button").length, 1);
  } finally { f.dom.window.close(); }
});

test(`the GitHub mask uses the common fourteen-pixel glyph inside its action (${device})`, () => {
  const f = makeSurface("pullRequest", '<div data-bb-chat-ui-info-pr-heading><a aria-label="Pull request 12: Open">PR</a></div>');
  try {
    const link = f.document.querySelector('a')!; resolvedStyle(link);
    const rule = Array.from(f.document.styleSheets[0].cssRules).find(rule => {
      const css = rule as CSSStyleRule;
      return css.selectorText?.endsWith('::after') && link.matches(css.selectorText.slice(0, -7));
    }) as CSSStyleRule;
    assert.ok(rule, 'the original PR link paints a GitHub mask');
    assert.equal(rule.style.width, phone ? '14px' : '12px'); assert.equal(rule.style.height, phone ? '14px' : '12px');
    assert.match(rule.style.getPropertyValue('mask'), /contain/);
  } finally { f.dom.window.close(); }
});

test(`Diff expansion controls are secondary list rows with the common gutter (${device})`, () => {
  const f = makeSurface("diff", '<div data-bb-chat-ui-info-diff><button data-bb-chat-ui-info-diff-toggle="files" aria-expanded="false"><span>7개 더 보기</span><svg /></button></div>', "large");
  try {
    const row = f.css("button");
    assert.equal(row.minHeight, phone ? "32px" : "24px"); assert.equal(row.padding, phone ? "6px" : "4px");
    assert.equal(row.borderRadius, phone ? "10px" : "8px"); assert.equal(row.marginLeft, phone ? "-6px" : "-4px");
    assert.equal(row.width, phone ? "calc(100% + 12px)" : "calc(100% + 8px)");
    assert.equal(row.fontSize, phone ? "13px" : "12px"); assert.equal(row.lineHeight, phone ? "16px" : "14px");
    assert.equal(f.document.querySelectorAll("button svg").length, 1);
  } finally { f.dom.window.close(); }
});

test(`Diff rows share the hover gutter while their zero-gap graph spans the padded row (${device})`, () => {
  const f = makeSurface("diff", '<div data-bb-chat-ui-info-diff-files><div data-bb-chat-ui-info-diff-file><svg/><code>path</code><span>+2</span></div></div><div data-bb-chat-ui-info-diff-commits><div data-bb-chat-ui-info-diff-commit><span data-bb-chat-ui-info-diff-graph><svg/></span><code>Commit</code></div><div data-bb-chat-ui-info-diff-commit><span data-bb-chat-ui-info-diff-graph><svg/></span><code>Next</code></div></div>');
  try {
    for (const selector of ['[data-bb-chat-ui-info-diff-file]', '[data-bb-chat-ui-info-diff-commit]']) {
      const row = f.css(selector);
      assert.equal(row.padding, phone ? '6px' : '4px'); assert.equal(row.borderRadius, phone ? '10px' : '8px');
      assert.equal(row.minHeight, phone ? '32px' : '24px'); assert.equal(row.marginLeft, phone ? '-6px' : '-4px');
      assert.equal(row.transition, 'background-color 150ms ease-out');
    }
    assert.equal(f.css('[data-bb-chat-ui-info-diff-commits]').rowGap, '0px');
    const graph = f.css('[data-bb-chat-ui-info-diff-graph]');
    assert.equal(graph.alignSelf, 'stretch');
    assert.equal(graph.marginTop, phone ? '-6px' : '-4px'); assert.equal(graph.marginBottom, phone ? '-6px' : '-4px');
    assert.equal(f.css('code').fontSize, phone ? '12px' : '11px'); assert.equal(f.css('[data-bb-chat-ui-info-diff-file] > span').fontSize, phone ? '12px' : '11px');
  } finally { f.dom.window.close(); }
});

test(`the PR GitHub link uses the shared circular action without replacing its URL (${device})`, () => {
  const f = makeSurface("pullRequest", '<div data-bb-chat-ui-info-pr-heading><a aria-label="Pull request 12: Open" href="https://example.com/pr/12" class="rounded">PR</a></div>', "small", '.rounded{border-radius:4px}');
  try {
    const action = f.css("a");
    assert.equal(action.borderRadius, "999px");
    assert.equal(action.width, phone ? "24px" : "20px"); assert.equal(action.height, phone ? "24px" : "20px");
    const mask = Array.from(f.document.styleSheets[0].cssRules).find(rule => {
      const css = rule as CSSStyleRule;
      return css.selectorText?.endsWith('::after') && f.document.querySelector('a')!.matches(css.selectorText.slice(0, -7));
    }) as CSSStyleRule;
    assert.equal((phone ? 16 : 12) + parseFloat(action.marginLeft) + (parseFloat(action.width) - parseFloat(mask.style.width)) / 2, phone ? 16 : 12, 'the visible GitHub mask starts at the Parent provider inset');
    assert.equal(f.document.querySelector("a")!.getAttribute("href"), "https://example.com/pr/12");
  } finally { f.dom.window.close(); }
});

test(`queue icon actions are circular at both hit target sizes while the drag handle stays separate (${device})`, () => {
  for (const hit of ["small", "large"]) {
    const f = makeSurface("queue", '<div data-queued-message-row><button aria-label="Reorder queued message 1" style="width:20px">Drag</button><button aria-label="Queued message 1 actions">More</button><div data-queued-message-actions><button aria-label="Send queued message">Send</button><button aria-label="Edit queued message">Edit</button><button aria-label="Delete queued message">Delete</button></div></div>', hit);
    f.document.querySelector("section")!.setAttribute("data-bb-chat-ui-queue-inline-actions", "true");
    try {
      for (const button of f.document.querySelectorAll('button:not([aria-label^="Reorder"])')) {
        const s = resolvedStyle(button);
        assert.equal(s.borderRadius, "999px");
        assert.equal(s.width, phone ? (hit === "large" ? "32px" : "24px") : "20px");
        assert.equal(s.height, phone ? (hit === "large" ? "32px" : "24px") : "20px");
      }
      assert.equal(f.css('[aria-label^="Reorder"]').width, "20px");
    } finally { f.dom.window.close(); }
  }
});

test(`Agentation list icon actions share 24px circular hit areas and 14px glyphs (${device})`, () => {
  const f = makeSurface("annotations", '<ul><li><button aria-label="Send annotation" class="h-7 w-7"><svg /></button></li></ul>', "large", '.h-7{height:28px}.w-7{width:28px}');
  f.document.querySelector("section")!.classList.add("agentation-staging-shell");
  try {
    const action = f.css("li button");
    assert.equal(action.width, phone ? "24px" : "20px"); assert.equal(action.height, phone ? "24px" : "20px");
    assert.equal(action.borderRadius, "999px");
    assert.equal(f.css("li svg").width, phone ? "14px" : "12px");
  } finally { f.dom.window.close(); }
});

test(`a native single background command shares row geometry without changing its action (${device})`, () => {
  const f = makeSurface("background", '<div class="flex"><div role="button" tabindex="0" class="px-3" aria-label="Background command: npm test"><span>npm test</span></div><button data-bb-chat-ui-card-head>Background</button></div>');
  try {
    const row = f.css('[role="button"]');
    assert.equal(row.padding, phone ? "6px" : "4px");
    assert.equal(row.minHeight, phone ? "32px" : "24px");
    assert.equal(row.borderRadius, phone ? "10px" : "8px");
    assert.equal(row.marginLeft, phone ? "-6px" : "-4px");
    assert.equal(row.transition, "background-color 150ms ease-out");
    assert.equal(f.document.querySelector('[role="button"]')!.getAttribute("tabindex"), "0");
  } finally { f.dom.window.close(); }
});

}
