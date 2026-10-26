import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { infoCardCss } from "./info-card.ts";
import { resolvedStyle } from "./test-style.ts";

import {
  queuePillLabel,
  queuedMessagesCss,
  exclusiveExpansionAction,
  readQueueCount,
  shouldFoldQueue,
} from "./queued-messages.ts";

test("managed user message previews use the smallest card size without resizing editors", () => {
  for (const phone of [false, true]) {
  const dom=new JSDOM(`<style>${infoCardCss("[data-bb-chat-ui-info-unit]")} .truncate { font-size:14px; line-height:20px; } ${queuedMessagesCss}</style><section aria-label="Queued messages" data-bb-chat-ui-info-unit><li data-queued-message-row><span data-preview class="truncate !text-xs">Queued text</span><div class="text-2xs"><span data-scheduled class="truncate">Scheduled for 8:46</span></div></li><div contenteditable="true"><span class="truncate" data-editor>Draft</span></div></section><section aria-label="Queued messages"><li data-queued-message-row><span class="truncate" data-standalone>Native queue</span></li></section>`);
  dom.window.document.documentElement.setAttribute('data-bb-chat-ui-root-device',phone?'phone':'desktop');
  const scheduled=resolvedStyle(dom.window.document.querySelector('[data-scheduled]')!);
  assert.equal(scheduled.fontSize,phone?'12px':'11px','scheduled metadata must not inherit the user message preview override');
  assert.equal(scheduled.lineHeight,'18px');
  const preview=resolvedStyle(dom.window.document.querySelector('[data-preview]')!);
  assert.equal(preview.getPropertyValue('--text-xs'),phone?'12px':'11px','native !text-xs reads the small prose token rather than the phone 14px token');
  assert.equal(preview.fontSize,phone?'12px':'11px');
  assert.equal(preview.lineHeight,'18px');
  for(const [selector,lineHeight] of [['[data-editor]','20px'],['[data-standalone]','1.625']]){
    const s=resolvedStyle(dom.window.document.querySelector(selector)!);
    assert.equal(s.fontSize,'14px');
    assert.equal(s.lineHeight,lineHeight,'existing editor and standalone queue line heights stay unchanged');
    assert.notEqual(s.getPropertyValue('--text-xs'),'12px');
  }
  dom.window.close();
  }
});

test("names the folded queue pill after the held count", () => {
  assert.equal(readQueueCount(" 2 "), "2");
  assert.equal(readQueueCount("Queue"), "");
  assert.equal(readQueueCount(null), "");
  assert.equal(queuePillLabel("collapsed", "2"), "2");
  assert.equal(queuePillLabel("drawer", "2"), "");
  assert.equal(queuePillLabel("workspace", "4"), "");
  assert.equal(queuePillLabel("collapsed", ""), "•");
  assert.equal(queuePillLabel("drawer", "5", "Expand queued messages"), "");
  assert.equal(
    queuePillLabel("drawer", "2", "Collapse queued messages"),
    "",
  );
});

test("allows only one of the queue and Agentation panels to expand", () => {
  assert.equal(
    exclusiveExpansionAction({
      opening: "queue",
      agentationExpanded: true,
      queueExpanded: false,
      queueEditing: false,
    }),
    "collapse-agentation",
  );
  assert.equal(
    exclusiveExpansionAction({
      opening: "agentation",
      agentationExpanded: false,
      queueExpanded: true,
      queueEditing: false,
    }),
    "collapse-queue",
  );
  assert.equal(
    exclusiveExpansionAction({
      opening: "agentation",
      agentationExpanded: false,
      queueExpanded: true,
      queueEditing: true,
    }),
    "block-agentation",
  );
  assert.equal(
    exclusiveExpansionAction({
      opening: "agentation",
      agentationExpanded: false,
      queueExpanded: false,
      queueEditing: false,
    }),
    null,
  );
});

test("folds a drawer once, and leaves an open editor alone", () => {
  assert.equal(
    shouldFoldQueue({
      mode: "drawer",
      canCollapse: true,
      editing: false,
      folded: false,
    }),
    true,
  );
  assert.equal(
    shouldFoldQueue({
      mode: "drawer",
      canCollapse: true,
      editing: false,
      folded: true,
    }),
    false,
  );
  assert.equal(
    shouldFoldQueue({
      mode: "drawer",
      canCollapse: false,
      editing: false,
      folded: false,
    }),
    false,
  );
  assert.equal(
    shouldFoldQueue({
      mode: "drawer",
      canCollapse: true,
      editing: true,
      folded: false,
    }),
    false,
  );
  assert.equal(
    shouldFoldQueue({
      mode: "collapsed",
      canCollapse: true,
      editing: false,
      folded: false,
    }),
    false,
  );
  assert.equal(
    shouldFoldQueue({
      mode: "workspace",
      canCollapse: true,
      editing: false,
      folded: false,
    }),
    false,
  );
});

test("keeps the standalone legacy queue layout outside managed information popovers", () => {
  const css = queuedMessagesCss;
  assert.match(css, /section\[aria-label="Queued messages"\]:not\(\[data-bb-chat-ui-info-unit\]\):has\(\[data-queued-messages-mode\]\)/);
  assert.match(
    css,
    /section\[aria-label="Queued messages"\]:not\(\[data-bb-chat-ui-info-unit\]\):has\(\[data-queued-messages-mode\]\)\s*\{[^}]*position:\s*relative !important;/,
  );
  assert.match(
    css,
    /section\[aria-label="Queued messages"\]:not\(\[data-bb-chat-ui-info-unit\]\):has\(\[data-queued-messages-mode\]\)\s*\{[^}]*align-self:\s*stretch;/,
  );
  assert.match(
    css,
    /section\[aria-label="Queued messages"\]:not\(\[data-bb-chat-ui-info-unit\]\):has\(\[data-queued-messages-mode\]\)\s*\{[^}]*width:\s*100%;/,
  );
  assert.doesNotMatch(css, /min\(760px,\s*100%\)/);
  assert.match(css, /background:\s*transparent !important/);
  assert.match(
    css,
    /\[data-queued-messages-scroll-frame\]\s*\{[^}]*position:\s*absolute !important;[^}]*bottom:\s*calc\(100% \+ 8px\);/,
  );
  assert.match(
    css,
    /section\[aria-label="Queued messages"\]:not\(\[data-bb-chat-ui-info-unit\]\):has\(\[data-queued-messages-mode\]\)\s*\{[^}]*height:\s*32px !important;/,
  );
  assert.match(
    css,
    /header\[data-queued-messages-mode\]\s*\{[^}]*width:\s*32px !important;[^}]*height:\s*32px !important;[^}]*border-radius:\s*50% !important;/,
  );
  assert.match(
    css,
    /\[data-queued-messages-mode="collapsed"\]\) \[data-queued-messages-scroll-frame\]\s*\{[^}]*pointer-events:\s*none;/,
  );
  assert.match(
    css,
    /\[data-queued-messages-scroll-frame\]\s*\{[^}]*transition:[^;]*grid-template-rows 260ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/,
  );
  assert.match(
    css,
    /\[data-queued-messages-mode="collapsed"\]\) \[data-queued-messages-scroll-frame\]\s*\{[^}]*grid-template-rows:\s*0fr;/,
  );
  assert.match(css, /content:\s*attr\(data-bb-chat-ui-queue-label\)/);
  assert.match(
    css,
    /header\[data-queued-messages-mode\]\s*\{[^}]*position:\s*absolute !important;[^}]*width:\s*32px !important;[^}]*height:\s*32px !important;[^}]*border-radius:\s*50% !important;/,
  );
  assert.doesNotMatch(css, /margin-left:\s*auto/);
  // Only the floating row menu reads the shared card face; the legacy queue itself never becomes a card.
  for (const block of css.split("}").filter(block => block.includes('section[aria-label="Queued messages"]'))) assert.doesNotMatch(block, /border-radius:\s*18px !important/);
  assert.match(
    css,
    /header\[data-queued-messages-mode="drawer"\]::before,[\s\S]*?header\[data-queued-messages-mode="workspace"\]::before\s*\{\s*content:\s*none;/,
  );
  assert.match(
    css,
    /header\[data-queued-messages-mode="collapsed"\] button\[aria-expanded\] svg\s*\{\s*visibility:\s*hidden;/,
  );
  assert.doesNotMatch(css, /header\[data-queued-messages-mode="collapsed"\] > div:last-child\s*\{\s*display:\s*none/);
  assert.match(css, /\[data-queued-messages-scroll-frame\]\s*\{[^}]*width:\s*var\(--bb-chat-ui-queue-width, 100%\);/);
  assert.match(css, /\[data-queued-messages-scroll\]\s*\{[^}]*overflow-y:\s*auto !important;/);
  assert.match(
    css,
    /header\[data-queued-messages-mode\]\s*\{[^}]*opacity:\s*1;/,
  );
  assert.match(css, /button\[aria-label\^="Reorder"\]\s*\{[^}]*display:\s*none !important;/);
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex > \.min-w-0\s*\{[^}]*background:\s*var\(--surface-recessed-solid\);/,
  );
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex > \.min-w-0\s*\{[^}]*border:\s*1px solid var\(--border-seam\);/,
  );
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex > \.min-w-0\s*\{[^}]*border-radius:\s*calc\(var\(--radius\) \+ 4px\);/,
  );
  assert.doesNotMatch(css, /var\(--radius-xl\)/);
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex > \.min-w-0\s*\{[^}]*max-width:\s*70%;/,
  );
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex > \.min-w-0\s*\{[^}]*opacity:\s*1;/,
  );
  assert.doesNotMatch(css, /26px 26px 10px 26px/);
  assert.match(
    css,
    /\[data-queued-message-row\] > \.flex\s*\{[^}]*align-items:\s*center !important;/,
  );
  assert.match(
    css,
    /\[data-queued-message-actions\]\s*\{[^}]*position:\s*static !important;/,
  );
  assert.match(
    css,
    /\[data-queued-message-actions\]\s*\{[^}]*translate:\s*none !important;/,
  );
  assert.match(
    css,
    /\[data-queued-message-actions\]\s*\{[^}]*align-self:\s*center !important;/,
  );
  assert.match(
    css,
    /\[data-queued-message-actions\]\s*\{[^}]*opacity:\s*1 !important;/,
  );
  assert.match(
    css,
    /\[data-queued-message-actions\]\s*\{[^}]*background:\s*var\(--surface-raised-solid\) !important;/,
  );
});

test('managed queue line height beats the native important leading-4 in its utilities layer', () => {
  // JSDOM does not apply cascade-layer priority; inspect that boundary here and
  // verify the actual computed line height in the Chrome native-DOM harness.
  const d=new JSDOM(`<style>${queuedMessagesCss}</style>`);
  try {
    const layers=Array.from(d.window.document.styleSheets[0].cssRules).filter(r=>'name' in r&&r.name==='utilities');
    assert.equal(layers.length,1,'the important native utility and override must share a layer');
    const layer=layers[0] as CSSGroupingRule;
    const rule=Array.from(layer.cssRules).find(r=>'selectorText' in r&&r.selectorText.includes('.truncate:not(')) as CSSStyleRule;
    assert.ok(rule,'only managed message previews receive the override');
    assert.equal(rule.style.getPropertyValue('line-height'),'var(--bb-chat-ui-card-prose-line)');
    assert.equal(rule.style.getPropertyPriority('line-height'),'important');
    assert.match(rule.selectorText,/\[data-queued-message-row\]/);
  } finally {d.window.close();}
});
