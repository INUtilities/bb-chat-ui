import assert from "node:assert/strict";
import test from "node:test";

import {
  queuePillLabel,
  queuedMessagesCss,
  exclusiveExpansionAction,
  readQueueCount,
  shouldFoldQueue,
} from "./queued-messages.ts";

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
