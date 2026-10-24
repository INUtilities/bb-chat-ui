import type { BbPluginApi } from "@get-bb/plugin-sdk";

import { quoteRpcContract } from "./lib/quote-contract.ts";
import { QUOTE_PROVIDER_ID, quoteStorageKey } from "./lib/quote-text.ts";
import { composerInfoSettings } from "./lib/composer-info-settings.ts";

export default function plugin(bb: BbPluginApi) {
  bb.settings.define(composerInfoSettings);
  bb.rpc.register(quoteRpcContract, {
    async readQuote({ id }) {
      const text = await bb.storage.kv.get<string>(quoteStorageKey(id));
      return {text:typeof text === "string" ? text : null};
    },
    async saveQuote({ id, text }) {
      await bb.storage.kv.set(quoteStorageKey(id), text);
      return { saved: true as const };
    },
  });

  bb.ui.registerMentionProvider({
    id: QUOTE_PROVIDER_ID,
    label: "인용",
    triggers: ["~"],
    search() {
      return [];
    },
    async resolve(itemId) {
      const text = await bb.storage.kv.get<string>(quoteStorageKey(itemId));
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new Error("인용 내용을 찾지 못했습니다.");
      }
      return { context: text };
    },
  });
}
