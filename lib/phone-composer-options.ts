const PHONE = 'html[data-bb-chat-ui-root-device="phone"]';
// 확인·문서 화면은 제외하고, 실제 모델 목록 또는 Effort가 있는 picker만 꾸민다.
const MODEL = `${PHONE} [data-persistent-drawer-content][data-bb-chat-ui-model-menu]:has([role="listbox"], [role="option"], [data-bb-chat-ui-effort], div[class~="overflow-y-auto"] > button > span[title]):not(#bb-chat-ui-drawer-contents)`;
const MODEL_ROWS = `${MODEL} :is([role="option"], div[class~="overflow-y-auto"] > button[class~="hover:bg-state-hover"]:not([role="switch"]))`;
const ACTIONS = `${PHONE} :is(
  [data-persistent-drawer-content][data-bb-chat-ui-pr-menu],
  [data-persistent-drawer-content][data-bb-plugin="bb-chat-ui"]:has([aria-label="Send options"]),
  [data-persistent-drawer-content]:has(> div[aria-label="Prompt actions"])
):not(#bb-chat-ui-drawer-contents)`;

/** phone 컴포저가 소유한 메뉴의 내부 규격만 맞춘다. 공통 frost·곡선·gesture는 그대로 둔다. */
export const phoneComposerOptionsCss = `
${MODEL} > div:not([data-persistent-drawer-handle]) {
  width:100% !important; min-width:0 !important; max-width:none !important;
  padding:0 16px !important;
}
${MODEL} [class~="text-xs"],
${MODEL_ROWS} {
  font-size:14px !important; line-height:20px !important; font-weight:400 !important;
}
${MODEL_ROWS} { min-height:36px; padding:8px !important; border-radius:14px !important; }
${MODEL_ROWS}:active:not(:disabled):not([aria-disabled="true"]):not([data-disabled]) {
  background-color:var(--state-active) !important; color:var(--foreground) !important;
}
${MODEL} div[class~="overflow-y-auto"] { padding-inline:0 !important; }
${MODEL} div[class~="sticky"] {
  font-size:13px !important; line-height:20px !important; font-weight:600 !important;
  padding:8px 8px 4px !important; color:var(--muted-foreground);
}
${MODEL} > div:not([data-persistent-drawer-handle]) > div:has(input[aria-label="Search models"]) {
  padding:0 !important;
}
${MODEL} input[aria-label="Search models"] {
  height:40px !important; min-height:40px; font-size:16px !important; line-height:24px !important;
  border-radius:0 !important; background:transparent !important; box-shadow:none !important;
}
${MODEL} [data-bb-chat-ui-effort] { padding:0 8px; }
${MODEL} div:has(> [data-bb-chat-ui-effort]) { padding-top:16px !important; }
${MODEL} [data-effort-caption] { font-size:14px; line-height:20px; margin-bottom:4px; }
${MODEL} [data-effort-caption] > span { font-size:13px; line-height:20px; font-weight:600; }
${MODEL} [data-effort-caption] > output { font-size:14px; line-height:20px; font-weight:400; }
${MODEL} h2:not([class~="sr-only"]) { font-size:16px; line-height:24px; font-weight:600; }
${ACTIONS} > div:is([class~="overflow-y-auto"], [aria-label="Send options"], [aria-label="Prompt actions"]) {
  padding:8px 16px 16px !important; gap:0 !important;
}
${ACTIONS} [role="menuitem"] {
  min-height:36px; padding:8px !important; border-radius:14px !important; font-size:14px !important; line-height:20px !important; font-weight:400;
}
`;
