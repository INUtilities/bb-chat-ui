const STYLE_ID = "bb-chat-ui-transcript-components";
const MARKDOWN = '[data-timeline-row-id*=":assistant:"] [data-markdown-preview]';
const CODE = `${MARKDOWN} div.bg-surface-recessed.rounded-md`;
const HEADER = `${CODE} > [data-clipboard-ignore]`;
// Lucide 0.300.0 icons/code.svg (ISC), alpha mask; see THIRD_PARTY_NOTICES.md.
const CODE_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`)}") center / contain no-repeat`;

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
`;

export function injectTranscriptComponents(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = transcriptComponentsCss;
  document.head.append(style);
  return () => style.remove();
}
