import { PHONE_NARROW } from "./device-chrome.ts";

// 값과 선언만 소유한다. native 면·선택·삭제·저장은 각 adapter의 책임이다.
export const pillSlot = {
  reference: "data-bb-chat-ui-mention-pill",
  wide: "data-bb-chat-ui-mention-wide",
  remove: "data-bb-chat-ui-mention-remove",
  icon: "data-bb-chat-ui-quote-glyph",
  navigation: "data-bb-chat-ui-info-trigger",
  attachment: "data-bb-chat-ui-file-row",
} as const;

export const pillStyle = {
  legacyQuote: `  display: inline-flex !important;
  align-items: center;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  min-height: 28px;
  min-width: 0;
  gap: 6px;
  margin: 0.25rem 0 !important;
  border: 1px solid var(--pill-surface-border, var(--border)) !important;
  border-radius: 9999px !important;
  background: var(--pill-surface, var(--card));
  color: var(--pill-foreground, var(--muted-foreground));
  box-shadow: var(--pill-shadow);
  padding: 6px 14px 6px 12px !important;
  overflow: hidden;
  vertical-align: middle;
  white-space: nowrap !important;
  user-select: none;
  cursor: default;
`,
  legacyQuoteIcon: `  content: "";
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
`,
  nativeNavigation: `  width: fit-content;
  min-height: 32px;
  border-radius: 9999px !important;
  border: 1px solid var(--border);
  background: var(--card);
  padding: 4px 10px !important;
`,
  nativeNavigationIcon: `  width: 16px;
  height: 16px;
`,
  reference: `  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  max-width: min(140px, calc(100% - 6px)) !important;
  gap: 4px !important;
  margin: 3px !important;
  padding: 4px 12px 4px 10px !important;
  font-size: 12px !important;
  line-height: 16px !important;
`,
  referencePhone: `  height: 32px !important;
  min-height: 32px !important;
  max-height: 32px !important;
  max-width: min(240px, calc(100% - 8px)) !important;
  gap: 6px !important;
  margin: 4px !important;
  padding: 6px 14px 6px 12px !important;
  font-size: 14px !important;
  line-height: 18px !important;
`,
  label: `  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,
  remove: `  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--pill-icon, currentColor);
  cursor: pointer;
`,
  removePhone: `  right: 4px;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
`,
  navigation: `display:inline-flex; flex:none; align-items:center; justify-content:center; gap:6px; height:32px; max-width:100%; padding:4px 11px; border-radius:999px; font-size:12px !important; line-height:18px; white-space:nowrap; transition:transform 260ms cubic-bezier(.2,.9,.22,1.25);`,
  navigationFace: `background:var(--bb-chat-ui-info-face) !important; border:0 !important; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 6px 18px -12px var(--bb-chat-ui-info-shadow),inset 0 1px 3px var(--bb-chat-ui-info-edge) !important;`,
  attachment: `  box-sizing: border-box;
  gap: 6px;
  min-height: 40px;
  padding: 6px 14px 6px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.25;
`,
  attachmentPhone: `  min-height: 64px;
  border-radius: 20px;
`,
  attachmentIcon: `  flex: 0 0 18px;
  width: 18px;
  height: 18px;
`,
  attachmentIconPhone: `  flex: 0 0 28px;
  width: 28px;
  height: 28px;
`,
  referenceIcon: "flex: 0 0 var(--bb-chat-ui-pill-reference-icon, 14px) !important; width: var(--bb-chat-ui-pill-reference-icon, 14px) !important; height: var(--bb-chat-ui-pill-reference-icon, 14px) !important; margin: 0 !important; align-self: center;",
  referenceIconPhone: "flex-basis: 16px !important; width: 16px !important; height: 16px !important;",
  quoteGlyph: "display:inline-block;width:14px;height:14px;flex:0 0 14px;align-self:center;background-color:var(--pill-icon, currentColor);",
  wide: "max-width: calc(100% - 6px) !important;",
  widePhone: "max-width: calc(100% - 8px) !important;",
  removeReserve: "padding-right: 30px !important;",
  removeReservePhone: "padding-right: 34px !important;",
  removeGlyph: "width: 10px; height: 10px;",
  removeGlyphPhone: "width: 12px; height: 12px;",
  removeFocus: "outline: 1px solid var(--ring); outline-offset: -2px;",
} as const;

// reference 선언을 단일 원본으로 두고 같은 값을 device 변수로도 노출한다.
// fallback은 독립 CSS fixture와 adapter 단독 mount의 기존 규격을 보존한다.
function referenceVariables(declarations: string): string {
  return declarations.replace(/(height|min-height|max-height|gap|margin|font-size|line-height): (\d+px)/g,
    (_, property: string, value: string) => `${property}: var(--bb-chat-ui-pill-reference-${property}, ${value})`);
}
export const referenceVariableStyle = referenceVariables(pillStyle.reference);
export const referencePhoneVariableStyle = referenceVariables(pillStyle.referencePhone);

function referenceTokens(declarations: string): string {
  return [...declarations.matchAll(/(?:^|\n)  (height|min-height|max-height|gap|margin|font-size|line-height): (\d+px)/g)]
    .map(([, property, value]) => `--bb-chat-ui-pill-reference-${property}:${value};`).join("");
}
export function pillCss(): string {
  return `html { ${referenceTokens(pillStyle.reference)} --bb-chat-ui-pill-reference-icon:14px; }
${PHONE_NARROW} { ${referenceTokens(pillStyle.referencePhone)} --bb-chat-ui-pill-reference-icon:16px; }`;
}

// app.tsx 한 곳에서 설치한다. 독립 host의 중복 mount도 같은 sheet를 공유한다.
const styles = new WeakMap<Document, { style: HTMLStyleElement; owners: number }>();
export function injectPillStyles(doc: Document): () => void {
  let entry = styles.get(doc);
  if (!entry) {
    const style = doc.createElement("style");
    style.id = "bb-chat-ui-pill";
    style.textContent = pillCss();
    doc.head.append(style);
    styles.set(doc, entry = { style, owners: 0 });
  }
  entry.owners++;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--entry.owners === 0) { entry.style.remove(); styles.delete(doc); }
  };
}
