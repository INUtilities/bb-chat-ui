// BB strips license comments; this public export preserves the full icon notices in app.js.
export { thirdPartyIconNotices } from "./lib/third-party-icon-notices";

import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { Fragment, createElement } from "react";

import { DeviceChromeBridge } from "./lib/device-chrome";
import { QuoteMentionBridge } from "./lib/quote-bridge";
import { injectComposerViewport } from "./lib/composer-viewport";
import { injectComposerGlass } from "./lib/composer-glass";
import { injectComposerMenuGlass } from "./lib/composer-menu-glass";
import { injectQuoteMentions } from "./lib/quote-mention";
import { injectQuotePreview } from "./lib/quote-preview";
import { injectQuotePill } from "./lib/quote-pill";
import { injectPillStyles } from "./lib/pill";
import { injectMentionPills } from "./lib/mention-pill";
import { injectSendHaptic } from "./lib/send-haptic";
import { injectQueuedMessages } from "./lib/queued-messages";
import { injectTranscriptComponents } from "./lib/transcript-components";
import { injectThreadToc } from "./lib/thread-toc";
import { injectUserAttachments } from "./lib/user-attachments";
import { injectWorkspaceDiffPill } from "./lib/workspace-diff-pill";
import { WorkspaceDiffBridge } from "./lib/workspace-diff-bridge";
import { ComposerInfoBridge } from "./lib/composer-info-bridge";
import { injectComposerInfo } from "./lib/composer-info";
import { injectPhoneSheet } from "./lib/phone-sheet";
import "./lib/motion.css";
import { infoSettingsNotice } from "./lib/composer-info-settings";

function ComposerBridges() {
  return createElement(Fragment, null,
    createElement(DeviceChromeBridge), createElement(QuoteMentionBridge), createElement(WorkspaceDiffBridge), createElement(ComposerInfoBridge));
}

// Register composer bridges, content scripts, and locally attributed icons.
export default definePluginApp((app) => {
  app.contentScripts.register({ id:"pill-styles", mount:() => injectPillStyles(document) });
  app.contentScripts.register({ id:"quote-preview", mount:() => injectQuotePreview(document) });
  // phone에서만 stylesheet를 두고 정보 카드·인용 원문을 떠 있는 하단 시트로 띄운다.
  app.contentScripts.register({ id:"phone-sheet", mount:() => injectPhoneSheet(document) });
  // Lucide 0.300.0 icons/activity.svg (ISC), inherited Feather geometry; see THIRD_PARTY_NOTICES.md.
  app.experimental_icons.register({
    name:"bb-chat-ui-status",
    component:({ className }) => createElement("svg", { viewBox:"0 0 24 24", className, fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round", "aria-hidden":true },
      createElement("path", { d:"M22 12h-4l-3 9L9 3l-3 9H2" })),
  });
  // Hugeicons c1b280d3964e115dfdefb58241f6d93ca68f7b6d icons/message-delay-02.svg (MIT); see THIRD_PARTY_NOTICES.md.
  app.experimental_icons.register({
    name:"bb-chat-ui-queue",
    component:({ className }) => createElement("svg", { viewBox:"0 0 24 24", className, fill:"none", stroke:"currentColor", strokeWidth:1.5, strokeLinecap:"round", strokeLinejoin:"round", "aria-hidden":true },
      createElement("path", { d:"M22 11.9879C22 16.9645 19.1328 20.9988 12 20.9988C10.4991 20.9988 9.20689 20.852 8.0984 20.5797C7.50688 20.4345 6.88252 20.6134 6.39239 20.9754C5.70211 21.4852 4.61547 22 3 22C3.99253 21.3325 4.63281 19.497 3.37161 17.4946C2.37034 15.9718 2 14.0617 2 11.9879C2 7.22912 3.95026 3.33192 11 3" }),
      createElement("path", { d:"M12.1248 12H11.9998M8.125 12H8M12.2498 12C12.2498 12.1381 12.1379 12.25 11.9998 12.25C11.8618 12.25 11.7498 12.1381 11.7498 12C11.7498 11.8619 11.8618 11.75 11.9998 11.75C12.1379 11.75 12.2498 11.8619 12.2498 12ZM8.25 12C8.25 12.1381 8.13807 12.25 8 12.25C7.86193 12.25 7.75 12.1381 7.75 12C7.75 11.8619 7.86193 11.75 8 11.75C8.13807 11.75 8.25 11.8619 8.25 12Z" }),
      createElement("path", { d:"M18 6L19 5M22 6C22 8.20914 20.2091 10 18 10C15.7909 10 14 8.20914 14 6C14 3.79086 15.7909 2 18 2C20.2091 2 22 3.79086 22 6Z" })),
  });
  app.slots.settingsSection({
    id:"composer-info",
    title:"컴포저 위 정보",
    component:() => createElement("p", { className:"text-sm text-subtle-foreground" }, infoSettingsNotice),
  });
  app.composer.customize({
    id: "quote-mention",
    banners: [{ id: "convert", chrome: "bare", component: ComposerBridges }],
  });
  app.contentScripts.register({
    id: "workspace-diff-pill",
    mount() {
      return injectWorkspaceDiffPill(document);
    },
  });
  app.contentScripts.register({
    id: "quote-pill",
    mount() {
      const stopPill = injectQuotePill(document);
      const stopMention = injectQuoteMentions(document);
      return () => {
        stopPill();
        stopMention();
      };
    },
  });
  app.contentScripts.register({
    id: "composer-glass",
    mount() {
      const stopGlass=injectComposerGlass(document);
      const stopViewport=injectComposerViewport(document);
      return ()=>{stopViewport();stopGlass();};
    },
  });
  app.contentScripts.register({
    id: "composer-menu-glass",
    // Style the native attachment and model popovers for this plugin generation.
    mount() {
      return injectComposerMenuGlass(document);
    },
  });
  app.contentScripts.register({
    id: "mention-pills",
    mount() {
      return injectMentionPills(document);
    },
  });
  app.contentScripts.register({
    id: "send-haptic",
    mount() {
      return injectSendHaptic(document);
    },
  });
  app.contentScripts.register({
    id: "transcript-components",
    mount() { return injectTranscriptComponents(document); },
  });
  app.contentScripts.register({
    id: "thread-toc",
    mount() {
      return injectThreadToc(document);
    },
  });
  app.contentScripts.register({
    id: "user-attachments",
    mount() {
      return injectUserAttachments(document);
    },
  });
  app.contentScripts.register({
    id: "queued-messages",
    mount() {
      return injectQueuedMessages(document);
    },
  });
  app.contentScripts.register({
    id:"composer-info",
    mount() { return injectComposerInfo(document); },
  });
});
