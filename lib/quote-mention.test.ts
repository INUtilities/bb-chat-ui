import assert from "node:assert/strict";
import test from "node:test";

import {
  QUOTE_LABEL_MAX,
  isQuoteMentionResource,
  quoteItemId,
  QUOTE_CODE_ICON,
  QUOTE_SELECTION_ICON,
  QUOTE_WHOLE_ICON,
  quoteGestureFromControl,
  quoteLabel,
  quoteMentionAttrs,
  quoteMentionIcon,
  quoteStorageKey,
} from "./quote-text.ts";

test("shows only the file name for a code quote", () => {
  assert.equal(
    quoteLabel(
      "diff --git a/lib/quote-mention.test.ts b/lib/quote-mention.test.ts\n+++ b/lib/quote-mention.test.ts",
    ),
    "quote-mention.test.ts",
  );
  assert.equal(
    quoteLabel('diff --git a/old.ts b/new.ts'),
    "new.ts",
  );
  assert.equal(quoteLabel('diff --git "a/my file.ts" "b/my file.ts"'), "my file.ts");
});

test("shows only the front of the first quote line", () => {
  assert.equal(quoteLabel("  포인터가 떠난다  \n카드가 남는다"), "포인터가 떠난다");
  assert.equal(quoteLabel("\n\n"), null);
  const long = "가".repeat(QUOTE_LABEL_MAX + 5);
  const label = quoteLabel(long);
  assert.ok(label);
  assert.equal(label?.length, QUOTE_LABEL_MAX);
  assert.equal(label?.endsWith("…"), true);
});

test("builds a plugin mention whose id the host can resolve", () => {
  const id = quoteItemId("11111111-2222-4333-8444-555555555555");
  assert.equal(id, "11111111222243338444555555555555");
  assert.match(id, /^[a-zA-Z0-9_-]+$/);
  const attrs = quoteMentionAttrs("bb-chat-ui", id, "포인터가 떠난다");
  assert.equal(attrs.resource.itemId, `quote:${id}`);
  assert.equal(attrs.resource.label, "포인터가 떠난다");
  assert.equal(attrs.serializedText, "포인터가 떠난다");
  assert.equal(quoteStorageKey(id), `quote:${id}`);
});

test("uses the diff icon for code, the message icon for the button, and the quote icon for a drag", () => {
  const prose = "두 줄을 멘션했습니다.\n둘 다 직전 답입니다.";
  assert.equal(
    quoteMentionIcon("diff --git a/lib/quote-mention.test.ts b/lib/quote-mention.test.ts\n+++", "message"),
    QUOTE_CODE_ICON,
  );
  assert.equal(quoteMentionIcon(prose, "message"), QUOTE_WHOLE_ICON);
  assert.equal(quoteMentionIcon(prose, "selection"), QUOTE_SELECTION_ICON);
  assert.equal(
    quoteGestureFromControl({ role: null, ariaLabel: "Add to chat", text: "" }),
    "message",
  );
  assert.equal(
    quoteGestureFromControl({ role: "menuitem", ariaLabel: null, text: "Add to chat" }),
    "message",
  );
  assert.equal(
    quoteGestureFromControl({ role: null, ariaLabel: null, text: "Add to chat" }),
    "selection",
  );
});

test("recognizes only this plugin's quote mentions", () => {
  assert.equal(
    isQuoteMentionResource({ kind: "plugin", itemId: "quote:abc" }),
    true,
  );
  assert.equal(
    isQuoteMentionResource({ kind: "plugin", itemId: "file:abc" }),
    false,
  );
  // BB 0.47 (SDK 0.6.80) stores the mention as attrs.mention with provider and id.
  assert.equal(
    isQuoteMentionResource({ kind: "plugin", pluginId: "bb-chat-ui", provider: "quote", id: "abc" }),
    true,
  );
  assert.equal(
    isQuoteMentionResource({ kind: "plugin", pluginId: "other", provider: "quote", id: "abc" }),
    false,
  );
  assert.equal(
    isQuoteMentionResource({ kind: "plugin", pluginId: "bb-chat-ui", provider: "file", id: "abc" }),
    false,
  );
});
