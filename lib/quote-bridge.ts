import { registerQuoteReader } from "./quote-preview.ts";
import { useEffect, useRef } from "react";
import {
  experimental_usePluginId,
  useComposer,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { ComposerDraftSnapshot, ComposerMention } from "@get-bb/plugin-sdk";

import { quoteRpcContract } from "./quote-contract.ts";
import { firstQuoteSpan, replaceQuoteSpan } from "./quote-draft.ts";
import { inlineInsertedMentions, inlineQuoteMention } from "./mention-draft.ts";
import {
  QUOTE_GESTURE_ATTR,
  QUOTE_PROVIDER_ID,
  quoteItemId,
  quoteMentionIcon,
  readQuoteGesture,
} from "./quote-text.ts";

export function QuoteMentionBridge(): null {
  const composer = useComposer();
  const pluginId = experimental_usePluginId();
  const rpc = useRpc<typeof quoteRpcContract>();
  useEffect(() => registerQuoteReader(document, async id => (await rpc.call("readQuote", {id})).text), [rpc]);
  const draft = composer.draft;
  const scope = JSON.stringify(composer.scope);
  const previous = useRef<{ scope: string; draft: ComposerDraftSnapshot }>({ scope, draft });
  const before = previous.current;

  useEffect(() => {
    previous.current = { scope, draft };
    if (before.scope !== scope) return;
    const next = inlineInsertedMentions(before.draft, draft);
    if (!next) return;
    composer.replace((current) =>
      current.text === draft.text &&
      JSON.stringify(current.mentions) === JSON.stringify(draft.mentions)
        ? next : current,
    );
  }, [composer, draft, scope]);

  useEffect(() => {
    const gesture = readQuoteGesture(
      document.documentElement.getAttribute(QUOTE_GESTURE_ATTR),
    );
    const span = firstQuoteSpan(
      draft.text,
      draft.mentions,
      gesture ? "last" : "first",
    );
    if (!span || pluginId.length === 0) return;
    let cancelled = false;
    const id = quoteItemId();
    const icon = quoteMentionIcon(span.body, gesture);
    void rpc
      .call("saveQuote", { id, text: span.body })
      .then(() => {
        if (cancelled) return;
        let applied = false;
        composer.replace((current) => {
          const again = firstQuoteSpan(
            current.text,
            current.mentions,
            gesture ? "last" : "first",
          );
          if (!again || again.start !== span.start || again.body !== span.body) {
            return current;
          }
          const mention: ComposerMention = {
            from: again.start,
            to: again.start + again.label.length,
            label: again.label,
            icon,
            kind: "plugin",
            pluginId,
            provider: QUOTE_PROVIDER_ID,
            id,
          };
          const next = replaceQuoteSpan(current, again, mention);
          if (!next) return current;
          applied = true;
          if (!gesture) return next;
          return (before.scope === scope ? inlineInsertedMentions(before.draft, next) : null)
            ?? inlineQuoteMention(next, mention);
        });
        if (
          applied &&
          gesture &&
          readQuoteGesture(document.documentElement.getAttribute(QUOTE_GESTURE_ATTR)) ===
            gesture
        ) {
          document.documentElement.removeAttribute(QUOTE_GESTURE_ATTR);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [composer, draft, pluginId, rpc, scope]);

  return null;
}
