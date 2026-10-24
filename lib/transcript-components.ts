import { cardStyle } from "./info-card.ts";
import { attachInlineVisCollapse } from "./inline-vis-collapse.ts";

const STYLE_ID = "bb-chat-ui-transcript-components";
const MARKDOWN = '[data-timeline-row-id*=":assistant:"] [data-markdown-preview]';
const CODE = `${MARKDOWN} div.bg-surface-recessed.rounded-md`;
const HEADER = `${CODE} > [data-clipboard-ignore]`;
// Lucide 0.300.0 icons/code.svg (ISC), alpha mask; see THIRD_PARTY_NOTICES.md.
const CODE_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`)}") center / contain no-repeat`;

const FRAME = `${MARKDOWN} div[data-inline-vis-frame]`;
const LOADING = `${MARKDOWN} div[role="status"][aria-label^="Loading visualization"]`;
const OPEN = `${FRAME} > div > a[aria-label^="Open "]`;
const SOURCE = `${FRAME} > div > button[aria-label$=" source"]`;
// Lucide 0.300.0 icons/app-window.svg (ISC), alpha mask; see THIRD_PARTY_NOTICES.md.
const WINDOW_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>`)}") center / contain no-repeat`;

export const transcriptComponentsCss = `
${CODE} {
  margin-block:12px; border-color:var(--border-seam); border-radius:12px;
}
${HEADER} {
  box-sizing:border-box; min-height:32px; padding:0 6px 0 12px;
  border-bottom:1px solid var(--border-seam); background:var(--surface-raised);
}
${HEADER} > span {
  display:inline-flex; align-items:center; gap:6px; color:var(--muted-foreground);
  font-family:inherit; font-size:12px; font-weight:500; line-height:16px; text-transform:none;
}
${HEADER} > span::before {
  content:""; flex:none; width:13px; height:13px; background-color:currentColor;
  -webkit-mask:${CODE_MASK}; mask:${CODE_MASK}; opacity:.75;
}
${CODE} > pre.bb-code-highlight { padding:12px 16px 14px; }
${MARKDOWN} table {
  border:1px solid var(--border-seam); border-collapse:separate; border-spacing:0px; border-radius:10px;
}
${MARKDOWN} thead { background:transparent; }
${MARKDOWN} th, ${MARKDOWN} td {
  padding:5px 12px; border:0; border-bottom:1px solid var(--border-seam);
  vertical-align:top; word-break:keep-all;
}
${MARKDOWN} th {
  border-bottom-color:var(--border); color:var(--muted-foreground);
  font-size:12px; line-height:18px; font-weight:500; white-space:nowrap;
}
${MARKDOWN} tbody > tr:last-child > td { border-bottom:0; }
@container page (width < 36rem) {
  ${MARKDOWN} th, ${MARKDOWN} td { padding-inline:8px; }
}
${FRAME}, ${LOADING} {
  box-sizing:content-box; margin-block:12px; padding-top:32px;
  border:1px solid var(--border-seam); border-radius:12px; overflow:clip;
}
${LOADING} { position:relative; animation:bb-chat-ui-iv-breathe 1.4s ease-in-out infinite alternate; }
${FRAME}::before, ${LOADING}::before {
  content:"html"; position:absolute; top:0; left:0; right:0; box-sizing:border-box;
  height:32px; padding-left:31px; border-bottom:1px solid var(--border-seam);
  background:var(--surface-raised); color:var(--muted-foreground);
  font-size:12px; font-weight:500; line-height:31px; pointer-events:none;
}
${FRAME}::after, ${LOADING}::after {
  content:""; position:absolute; top:9.5px; left:12px; width:13px; height:13px;
  background-color:var(--muted-foreground); opacity:.75;
  -webkit-mask:${WINDOW_MASK}; mask:${WINDOW_MASK}; pointer-events:none;
}
${FRAME} > div { top:4px; right:6px; z-index:1; opacity:1; }
${OPEN}, ${SOURCE} {
  width:24px; height:24px; border:0; border-radius:999px; background-color:transparent;
  box-shadow:none; color:var(--muted-foreground);
  transition:background-color 150ms ease-out, color 150ms ease-out;
}
${OPEN}:hover, ${SOURCE}:hover, ${SOURCE}[aria-pressed="true"] {
  color:var(--foreground); background-color:color-mix(in oklab,var(--foreground) 6%,transparent);
}
${OPEN}:focus-visible, ${SOURCE}:focus-visible { outline:2px solid var(--ring); outline-offset:1px; }
@keyframes bb-chat-ui-iv-breathe { from { opacity:1; } to { opacity:.6; } }
@media (prefers-reduced-motion:reduce) {
  ${LOADING} { animation:none; }
  ${OPEN}, ${SOURCE} { transition:none; }
}
${FRAME} > div { display:flex; align-items:center; gap:2px; }
${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle] {
  display:inline-flex; align-items:center; justify-content:center; align-self:center; flex:none; box-sizing:border-box;
  width:var(--bb-chat-ui-card-icon); height:var(--bb-chat-ui-card-icon); min-width:var(--bb-chat-ui-card-icon);
  margin:0; padding:0; border:0; border-radius:999px; background:transparent; box-shadow:none;
  color:var(--subtle-foreground); font:inherit; cursor:pointer;
  transition:background-color 150ms ease-out,color 150ms ease-out;
}
${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle]:hover, ${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle]:focus-visible { ${cardStyle.hover} }
${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle]:focus-visible { outline:2px solid var(--ring); outline-offset:1px; }
${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle]::before {
  content:""; width:6px; height:6px; border:solid currentColor; border-width:1.5px 1.5px 0 0; transform:rotate(-45deg);
}
${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle][aria-expanded="false"]::before { transform:rotate(135deg); }
${FRAME}[data-bb-chat-ui-inline-vis-collapsed] { height:0 !important; min-height:0 !important; }
${FRAME}[data-bb-chat-ui-inline-vis-collapsed] > iframe { display:none !important; }
@media (prefers-reduced-motion:reduce) {
  ${FRAME} > div > button[data-bb-chat-ui-inline-vis-toggle] { transition:none !important; }
}
`;

export function injectTranscriptComponents(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = transcriptComponentsCss;
  document.head.append(style);
  const stopCollapse = attachInlineVisCollapse(document);
  return () => { stopCollapse(); style.remove(); };
}
