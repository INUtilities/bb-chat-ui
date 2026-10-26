import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";
import { LARGE_HIT_TARGET } from "./device-chrome.ts";

/**
 * One information card for everything that opens above the composer.
 * The card owns one frost face, with a device-scaled head or a compact navigation face. Plugin-built nodes carry the
 * slot attributes; native nodes that cannot be marked reuse the same declaration blocks
 * through `cardStyle`, so every card reads its geometry from this file.
 */
export const CARD = "data-bb-chat-ui-card";
/** Symmetric geometry shared by DOM/React closes and the native Agentation mask. */
export const CARD_CLOSE_ICON = "data-bb-chat-ui-card-close-icon";
export const CARD_CLOSE_PATH = "M2 2l8 8M10 2l-8 8";
export const CARD_CLOSE_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="${CARD_CLOSE_PATH}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`)}")`;

export const cardSlot = {
  layout: `${CARD}-layout`,
  head: `${CARD}-head`,
  body: `${CARD}-body`,
  prose: `${CARD}-prose`,
  icon: `${CARD}-icon`,
  title: `${CARD}-title`,
  action: `${CARD}-action`,
  button: `${CARD}-button`,
  endAction: `${CARD}-end-action`,
  buttonLabel: `${CARD}-button-label`,
  close: `${CARD}-close`,
  list: `${CARD}-list`,
  row: `${CARD}-row`,
  navigation: `${CARD}-navigation`,
  meta: `${CARD}-meta`,
  section: `${CARD}-section`,
} as const;

/** Fields that keep their own box inside a card. Everything else sits flat on the face. */
export const NESTED_SURFACE_EXEMPT = "input, textarea, select, pre, code, [contenteditable='true'], .cm-editor, .monaco-editor";

const FLAT = "background:transparent !important; box-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;";
const TEXT_TYPE = "font-size:var(--bb-chat-ui-card-text-size); line-height:var(--bb-chat-ui-card-line);";
const SECONDARY_TYPE = "font-size:var(--bb-chat-ui-card-secondary-size); line-height:var(--bb-chat-ui-card-meta-line);";
const PROSE_TYPE = "font-size:var(--bb-chat-ui-card-prose-size); line-height:var(--bb-chat-ui-card-prose-line);";
const TITLE_TYPE = "font-size:var(--bb-chat-ui-card-title-size); line-height:var(--bb-chat-ui-card-title-line); font-weight:600; text-align:left;";
/** Native composer menus keep their existing radius; information rows use the device token. */
const ROW_RADIUS = "border-radius:10px !important;";
export const CARD_HOVER = "color-mix(in oklab,var(--foreground) 6%,transparent)";

/** Declaration blocks shared by slots and by native nodes mapped onto a slot. */
export const cardStyle = {
  text: TEXT_TYPE,
  prose: PROSE_TYPE,
  titleText: TITLE_TYPE,
  secondaryText: SECONDARY_TYPE,
  face: `--bb-chat-ui-card-face:${LIGHT_GLASS_FACE}; --bb-chat-ui-card-edge:color-mix(in oklab,var(--popover) 35%,transparent); --bb-chat-ui-card-shadow:color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent); border:0 !important; border-radius:18px !important; color:var(--foreground); background:var(--bb-chat-ui-card-face) !important; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 12px 32px -14px var(--bb-chat-ui-card-shadow),inset 0 1px 3px var(--bb-chat-ui-card-edge) !important;`,
  faceDark: `--bb-chat-ui-card-face:${DARK_GLASS_FACE}; --bb-chat-ui-card-edge:color-mix(in oklab,var(--foreground) 8%,transparent); --bb-chat-ui-card-shadow:color-mix(in oklab,black 60%,transparent);`,
  head: `display:flex; align-items:center; gap:var(--bb-chat-ui-card-gap); box-sizing:border-box; min-width:0; height:var(--bb-chat-ui-card-head); min-height:var(--bb-chat-ui-card-head); margin:0 0 var(--bb-chat-ui-card-gap); padding:0 var(--bb-chat-ui-card-close-gutter) 0 0 !important; ${TITLE_TYPE}`,
  headOnly: "margin-bottom:0;",
  icon: "display:inline-flex; align-items:center; justify-content:center; flex:none; width:14px; height:14px;",
  title: `flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${TITLE_TYPE}`,
  action: `display:inline-flex; align-items:center; justify-content:center; align-self:center; flex:none; box-sizing:border-box; width:var(--bb-chat-ui-card-icon); height:var(--bb-chat-ui-card-icon); min-width:var(--bb-chat-ui-card-icon); min-height:var(--bb-chat-ui-card-icon); margin:0; padding:0 !important; border:0 !important; border-radius:999px !important; color:var(--subtle-foreground); font-family:inherit; font-size:12px; font-weight:400; line-height:1; cursor:pointer; transition:background-color 150ms ease-out, color 150ms ease-out; ${FLAT}`,
  closeIcon: "display:block; flex:none; width:var(--bb-chat-ui-card-close-glyph); height:var(--bb-chat-ui-card-close-glyph); pointer-events:none;",
  close: "position:absolute !important; top:var(--bb-chat-ui-card-close-top) !important; right:var(--bb-chat-ui-card-close-right) !important; z-index:1;",
  body: "min-width:0; margin-top:0 !important; margin-bottom:0 !important; padding-top:0 !important; padding-bottom:0 !important;",
  button: `display:inline-flex; align-items:center; justify-content:center; gap:4px; flex:none; box-sizing:border-box; height:var(--bb-chat-ui-card-button); min-height:var(--bb-chat-ui-card-button); margin:0; padding:0 var(--bb-chat-ui-card-button-pad) !important; border-width:1px !important; border-style:solid !important; border-color:var(--border) !important; border-radius:999px !important; color:var(--foreground); font-family:inherit; font-size:var(--bb-chat-ui-card-text-size) !important; font-weight:500; line-height:var(--bb-chat-ui-card-line) !important; white-space:nowrap; cursor:pointer; transition:background-color 150ms ease-out; ${FLAT}`,
  hover: `color:var(--foreground); background-color:${CARD_HOVER} !important;`,
  list: "display:flex; flex-direction:column; row-gap:var(--bb-chat-ui-info-row-gap); margin:0; padding:0; list-style:none;",
  rowRadius: ROW_RADIUS,
  /** Row box: native rows keep their own layout and reuse only this. */
  rowBox: `box-sizing:border-box; min-height:var(--bb-chat-ui-card-row-min); padding:var(--bb-chat-ui-card-row-pad) !important; border:0 !important; border-radius:var(--bb-chat-ui-card-row-radius) !important; ${TEXT_TYPE} transition:background-color 150ms ease-out; ${FLAT}`,
  /** Hover paint reaches 8px past the content edge without moving the content. */
  rowGutter: "width:calc(100% + 2 * var(--bb-chat-ui-card-row-pad)); margin-left:calc(-1 * var(--bb-chat-ui-card-row-pad)) !important; margin-right:calc(-1 * var(--bb-chat-ui-card-row-pad)) !important;",
  rowHover: `background-color:${CARD_HOVER} !important;`,
  meta: `${SECONDARY_TYPE} font-weight:400; color:var(--subtle-foreground);`,
  flat: FLAT,
} as const;

/** The frost face alone, for menus that float outside a card (no padding or slots). */
export function cardFaceCss(selector: string): string {
  return `${selector} { ${cardStyle.face} }\n.dark ${selector}, .dark${selector} { ${cardStyle.faceDark} }`;
}

export function infoCardCss(root = `[${CARD}]`, typographyScope = ""): string {
  const card = `:is(${root})`;
  const within = typographyScope ? `:where(${typographyScope}) ` : "";
  const s = Object.fromEntries(Object.entries(cardSlot).map(([key, attr]) => [key, `[${attr}]`])) as { [K in keyof typeof cardSlot]: string };
  const controls = `${s.action}, ${s.button}, ${s.close}, ${s.row}, ${s.navigation}`;
  const ownType = `${NESTED_SURFACE_EXEMPT}, ${s.title}, ${s.meta}, ${s.section}, ${s.action}, ${s.button}, ${s.close}`;
  const ownTypeTree = `${ownType}, ${ownType.split(", ").map(selector => `${selector} *`).join(", ")}`;
  const headingTypeTree = `${ownTypeTree}, ${s.head}, ${s.head} *`;
  // A mixed positive :where() list falls into Chrome's global candidate bucket.
  // Separate subjects keep zero specificity and use tag/class buckets. Native
  // roots also expose their common ancestor outside the multi-branch :is().
  return `
/* Device owns the scale; absent or non-phone device uses desktop at every viewport width. */
html {
  --bb-chat-ui-card-title-size:13px;
  --bb-chat-ui-card-title-line:15px;
  --bb-chat-ui-card-text-size:12px;
  --bb-chat-ui-card-prose-size:11px;
  --bb-chat-ui-card-secondary-size:11px;
  --bb-chat-ui-card-line:14px;
  --bb-chat-ui-card-prose-line:18px;
  --bb-chat-ui-card-meta-line:18px;
  --bb-chat-ui-info-row-gap:6px;
  --bb-chat-ui-card-pad-y:12px;
  --bb-chat-ui-card-pad-x:16px;
  --bb-chat-ui-card-head:30px;
  --bb-chat-ui-card-gap:10px;
  --bb-chat-ui-card-close-gutter:34px;
  --bb-chat-ui-card-icon:20px;
  --bb-chat-ui-card-glyph:12px;
  --bb-chat-ui-card-close-glyph:8px;
  --bb-chat-ui-card-close-top:17px;
  --bb-chat-ui-card-close-right:10px;
  --bb-chat-ui-card-button:24px;
  --bb-chat-ui-card-button-pad:8px;
  --bb-chat-ui-card-button-large:24px;
  --bb-chat-ui-card-row-min:24px;
  --bb-chat-ui-card-row-pad:4px;
  --bb-chat-ui-card-row-radius:8px;
  --bb-chat-ui-card-nav-height:36px;
  --bb-chat-ui-card-nav-left:12px;
  --bb-chat-ui-card-nav-right:32px;
  --bb-chat-ui-card-queue-y:2px;
  --bb-chat-ui-card-queue-action:20px;
  --bb-chat-ui-card-queue-small:20px;
  --bb-chat-ui-card-workflow-min:24px;
  --bb-chat-ui-card-workflow-y:2px;
  --bb-chat-ui-card-workflow-dotbox:16px;
  --bb-chat-ui-card-workflow-top:16px;
  --bb-chat-ui-card-workflow-tail:14px;
  --bb-chat-ui-card-workflow-left:7px;
  --bb-chat-ui-card-workflow-center:8px;
  --bb-chat-ui-card-pr-offset:-4px;
  --bb-chat-ui-card-pr-trailing:0px;
  --bb-chat-ui-card-pr-menu-y:12px;
  --bb-chat-ui-card-pr-menu-x:16px;
  --bb-chat-ui-card-nav-close-right:6px;
  --bb-chat-ui-card-queue-inline-glyph:12px;
  --bb-chat-ui-card-workflow-title-reserve:52px;
}
html[data-bb-chat-ui-root-device="phone"] {
  --bb-chat-ui-card-title-size:14px;
  --bb-chat-ui-card-prose-size:12px;
  --bb-chat-ui-card-line:16px;
  --bb-chat-ui-card-prose-line:18px;
  --bb-chat-ui-card-meta-line:18px;
  --bb-chat-ui-info-row-gap:6px;
  --bb-chat-ui-card-close-top:15.5px;
  --bb-chat-ui-card-title-line:18px;
  --bb-chat-ui-card-text-size:13px;
  --bb-chat-ui-card-secondary-size:12px;
  --bb-chat-ui-card-head:32px;
  --bb-chat-ui-card-gap:10px;
  --bb-chat-ui-card-close-gutter:34px;
  --bb-chat-ui-card-icon:24px;
  --bb-chat-ui-card-glyph:14px;
  --bb-chat-ui-card-close-glyph:9px;
  --bb-chat-ui-card-close-right:8px;
  --bb-chat-ui-card-button:32px;
  --bb-chat-ui-card-button-pad:10px;
  --bb-chat-ui-card-button-large:32px;
  --bb-chat-ui-card-row-min:32px;
  --bb-chat-ui-card-row-pad:6px;
  --bb-chat-ui-card-row-radius:10px;
  --bb-chat-ui-card-nav-height:40px;
  --bb-chat-ui-card-nav-left:16px;
  --bb-chat-ui-card-nav-right:40px;
  --bb-chat-ui-card-queue-y:4px;
  --bb-chat-ui-card-queue-action:32px;
  --bb-chat-ui-card-queue-small:24px;
  --bb-chat-ui-card-workflow-min:28px;
  --bb-chat-ui-card-workflow-y:4px;
  --bb-chat-ui-card-workflow-dotbox:18px;
  --bb-chat-ui-card-workflow-top:18px;
  --bb-chat-ui-card-workflow-tail:16px;
  --bb-chat-ui-card-workflow-left:8px;
  --bb-chat-ui-card-workflow-center:9px;
  --bb-chat-ui-card-pr-offset:-5px;
  --bb-chat-ui-card-pr-trailing:-3px;
  --bb-chat-ui-card-pr-menu-y:12px;
  --bb-chat-ui-card-pr-menu-x:16px;
  --bb-chat-ui-card-nav-close-right:8px;
  --bb-chat-ui-card-queue-inline-glyph:16px;
  --bb-chat-ui-card-workflow-title-reserve:62px;
}
${cardFaceCss(card)}
${card} { position:relative; box-sizing:border-box; padding:var(--bb-chat-ui-card-pad-y) var(--bb-chat-ui-card-pad-x) !important; ${cardStyle.text} }
/* One scoped stylesheet consumes the device scale without duplicating card selectors. */
${[".text-xs", ".text-sm"].map(subject => `${within}${card} :where(${subject}):not(:where(${headingTypeTree})) { ${cardStyle.text} }`).join("\n")}
${within}${card} :where(.text-2xs):not(:where(${ownTypeTree})) { ${cardStyle.secondaryText} }
${s.prose}, ${within}${card} :where(p):not(:where(${headingTypeTree})) { ${cardStyle.prose} }
${["span", "a", "strong", "em", "b", "i", "li", ".text-xs", ".text-sm"].map(subject => `${within}:is(${s.prose}, ${card} p) :where(${subject}):not(:where(${headingTypeTree})) { ${cardStyle.prose} }`).join("\n")}
${card} :is(button, a):not(${controls}) { ${FLAT} }
${card} button:not(${controls}):not(:disabled):is(:hover, :focus-visible) { background-color:${CARD_HOVER} !important; }
${s.head} { ${cardStyle.head} }
${card}[${cardSlot.layout}="with-actions"] { display:grid !important; grid-template-columns:minmax(0,1fr) auto var(--bb-chat-ui-card-icon); grid-template-rows:var(--bb-chat-ui-card-head) auto; grid-template-areas:"heading actions close" "body body body"; align-items:center; gap:var(--bb-chat-ui-card-gap); }
${card}[${cardSlot.layout}="with-actions"] > ${s.head} { grid-area:heading; margin-bottom:0; padding-right:0 !important; }
${card}[${cardSlot.layout}="with-actions"] > :not(${s.head}):not(${s.close}):not(${s.endAction}) { grid-area:body; }
${card}[${cardSlot.layout}="heading-only"] > ${s.head} { ${cardStyle.headOnly} }
${card}[${cardSlot.layout}="single-row"] { min-height:var(--bb-chat-ui-card-nav-height) !important; padding:0 !important; box-shadow:0 12px 32px -14px var(--bb-chat-ui-card-shadow) !important; }
${card}[${cardSlot.layout}="single-row"] > ${s.head} { position:static; height:var(--bb-chat-ui-card-nav-height); min-height:var(--bb-chat-ui-card-nav-height); margin:0; padding:4px var(--bb-chat-ui-card-nav-right) 4px var(--bb-chat-ui-card-nav-left) !important; }
${s.body} { ${cardStyle.body} }
${s.body} > :first-child { margin-top:0 !important; }
${s.body} > :last-child { margin-bottom:0 !important; }
${s.icon} { ${cardStyle.icon} }
${s.icon} > :is(svg, [data-icon-root]) { width:14px; height:14px; }
${s.title} { ${cardStyle.title} }
:is(${s.action}, ${s.close}) { ${cardStyle.action} }
:is(${s.action}, ${s.close}) :is(svg, [data-icon-root]) { width:var(--bb-chat-ui-card-glyph); height:var(--bb-chat-ui-card-glyph); }
${s.close} { ${cardStyle.close} }
${s.close} > svg[${CARD_CLOSE_ICON}] { ${cardStyle.closeIcon} }
${s.button} { ${cardStyle.button} }
${s.endAction} { grid-area:actions; margin-left:auto; }
${s.button}${s.endAction} { gap:0; font-size:0 !important; }
${s.button}${s.endAction} > :not(${s.buttonLabel}) { display:none !important; }
${s.button}${s.endAction} > ${s.buttonLabel} { ${cardStyle.text} }
/* A finger keeps the 32px hit target of the composer pills. */
${LARGE_HIT_TARGET} ${s.button} { height:var(--bb-chat-ui-card-button-large); min-height:var(--bb-chat-ui-card-button-large); }
:is(${s.action}, ${s.close}, ${s.button}):not(:disabled):is(:hover, :focus-visible) { ${cardStyle.hover} }
:is(${s.action}, ${s.close}, ${s.button}):is(:disabled, [aria-disabled="true"]) { opacity:.5; cursor:default; }
${s.list} { ${cardStyle.list} }
${s.row} { display:flex; align-items:center; gap:var(--bb-chat-ui-card-gap); min-width:0; margin:0; color:inherit; font-family:inherit; text-align:left; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
${s.row}:is(:hover, :focus-visible, :focus-within) { ${cardStyle.rowHover} }
${card}[${cardSlot.layout}="single-row"] > ${s.row} { width:100%; min-height:var(--bb-chat-ui-card-nav-height); margin:0 !important; padding:8px var(--bb-chat-ui-card-nav-right) 8px var(--bb-chat-ui-card-nav-left) !important; border-radius:18px !important; ${cardStyle.titleText} font-weight:400; background:transparent !important; }
${card}[${cardSlot.layout}="single-row"] > ${s.close} { top:8px !important; right:var(--bb-chat-ui-card-nav-close-right) !important; }
/* Stretch the original action across the face; sibling close/Merge controls sit above it. */
${card}[${cardSlot.layout}="single-row"] ${s.navigation} { position:static !important; overflow:visible !important; cursor:pointer; ${FLAT} }
${card}[${cardSlot.layout}="single-row"] ${s.navigation}::before { content:""; position:absolute; inset:0; z-index:0; border-radius:18px; transition:background-color 150ms ease-out; }
${card}[${cardSlot.layout}="single-row"] ${s.navigation}:hover::before { background-color:${CARD_HOVER}; }
${card}[${cardSlot.layout}="single-row"] ${s.navigation}:focus-visible { outline:0; }
${card}[${cardSlot.layout}="single-row"] ${s.navigation}:focus-visible::before { outline:2px solid var(--ring); outline-offset:-2px; }
:is(button, a)${s.row} { cursor:pointer; }
:is(${s.meta}, ${s.section}) { ${cardStyle.meta} }
${s.section} { margin:12px 0 4px; }
${s.section}:first-child { margin-top:0; }
${card} :focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
@media (prefers-reduced-motion:reduce) { ${card} :is(${controls}), ${card} ${s.navigation}::before { transition:none !important; } }
`;
}

export function createCardClose(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({ [CARD_CLOSE_ICON]:"", viewBox:"0 0 12 12", fill:"none", stroke:"currentColor", "stroke-width":"1.5", "stroke-linecap":"round", "aria-hidden":"true", focusable:"false" })) icon.setAttribute(name, value);
  const path = document.createElementNS(icon.namespaceURI, "path");
  path.setAttribute("d", CARD_CLOSE_PATH);
  icon.append(path);
  button.append(icon);
  button.setAttribute(cardSlot.close, "");
  button.setAttribute("aria-label", label);
  button.title = label;
  return button;
}

/** A 24px icon action; `path` is one 24×24 stroke path. */
export function createCardAction(document: Document, label: string, path: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(cardSlot.action, "");
  button.setAttribute("aria-label", label);
  button.title = label;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({ viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", "stroke-width":"1.5", "stroke-linecap":"round", "stroke-linejoin":"round", "aria-hidden":"true" })) icon.setAttribute(name, value);
  const stroke = document.createElementNS(icon.namespaceURI, "path");
  stroke.setAttribute("d", path);
  icon.append(stroke);
  button.append(icon);
  return button;
}

export function createCardHead(document: Document, { title, icon, actions = [] }: { title: string; icon: Element | null; actions?: readonly Element[] }): HTMLElement {
  const head = document.createElement("header");
  head.setAttribute(cardSlot.head, "");
  if (icon) {
    const box = document.createElement("span");
    box.setAttribute(cardSlot.icon, "");
    box.setAttribute("aria-hidden", "true");
    box.append(icon);
    head.append(box);
  }
  const text = document.createElement("span");
  text.setAttribute(cardSlot.title, "");
  text.textContent = title;
  head.append(text, ...actions);
  return head;
}
