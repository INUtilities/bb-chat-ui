import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";
import { LARGE_HIT_TARGET } from "./device-chrome.ts";

/**
 * One information card for everything that opens above the composer.
 * The card owns a single frost face and a fixed 28px head line. Plugin-built nodes carry the
 * slot attributes; native nodes that cannot be marked reuse the same declaration blocks
 * through `cardStyle`, so every card reads its geometry from this file.
 */
export const CARD = "data-bb-chat-ui-card";
export const cardSlot = {
  head: `${CARD}-head`,
  icon: `${CARD}-icon`,
  title: `${CARD}-title`,
  action: `${CARD}-action`,
  button: `${CARD}-button`,
  close: `${CARD}-close`,
  list: `${CARD}-list`,
  row: `${CARD}-row`,
  meta: `${CARD}-meta`,
  section: `${CARD}-section`,
} as const;

/** Fields that keep their own box inside a card. Everything else sits flat on the face. */
export const NESTED_SURFACE_EXEMPT = "input, textarea, select, pre, code, [contenteditable='true'], .cm-editor, .monaco-editor";

const FLAT = "background:transparent !important; box-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;";
export const CARD_HOVER = "color-mix(in oklab,var(--foreground) 6%,transparent)";

/** Declaration blocks shared by slots and by native nodes mapped onto a slot. */
export const cardStyle = {
  face: `--bb-chat-ui-card-face:${LIGHT_GLASS_FACE}; --bb-chat-ui-card-edge:color-mix(in oklab,var(--popover) 35%,transparent); --bb-chat-ui-card-shadow:color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent); border:0 !important; border-radius:18px !important; color:var(--foreground); background:var(--bb-chat-ui-card-face) !important; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 12px 32px -14px var(--bb-chat-ui-card-shadow),inset 0 1px 3px var(--bb-chat-ui-card-edge) !important;`,
  faceDark: `--bb-chat-ui-card-face:${DARK_GLASS_FACE}; --bb-chat-ui-card-edge:color-mix(in oklab,var(--foreground) 8%,transparent); --bb-chat-ui-card-shadow:color-mix(in oklab,black 60%,transparent);`,
  head: "display:flex; align-items:center; gap:8px; box-sizing:border-box; min-width:0; min-height:28px; margin:0 0 8px; padding:0 32px 0 0 !important; font-size:12px; line-height:16px; font-weight:600;",
  icon: "display:inline-flex; align-items:center; justify-content:center; flex:none; width:14px; height:14px;",
  title: "flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;",
  action: `display:inline-flex; align-items:center; justify-content:center; align-self:center; flex:none; box-sizing:border-box; width:24px; height:24px; min-width:24px; min-height:24px; margin:0; padding:0 !important; border:0 !important; border-radius:999px !important; color:var(--subtle-foreground); font-family:inherit; font-size:12px; font-weight:400; line-height:1; cursor:pointer; transition:background-color 150ms ease-out, color 150ms ease-out; ${FLAT}`,
  close: "position:absolute !important; top:18px !important; right:24px !important; z-index:1;",
  button: `display:inline-flex; align-items:center; justify-content:center; gap:4px; flex:none; box-sizing:border-box; height:28px; min-height:28px; margin:0; padding:0 12px !important; border-width:1px !important; border-style:solid !important; border-color:var(--border) !important; border-radius:999px !important; color:var(--foreground); font-family:inherit; font-size:11px !important; font-weight:500; line-height:16px !important; white-space:nowrap; cursor:pointer; transition:background-color 150ms ease-out; ${FLAT}`,
  hover: `color:var(--foreground); background-color:${CARD_HOVER} !important;`,
  list: "display:flex; flex-direction:column; row-gap:2px; margin:0; padding:0; list-style:none;",
  /** Row box: native rows keep their own layout and reuse only this. */
  rowBox: `box-sizing:border-box; min-height:32px; padding:8px !important; border:0 !important; border-radius:10px !important; font-size:12px; line-height:16px; transition:background-color 150ms ease-out; ${FLAT}`,
  /** Hover paint reaches 8px past the content edge without moving the content. */
  rowGutter: "width:calc(100% + 16px); margin-left:-8px !important; margin-right:-8px !important;",
  rowHover: `background-color:${CARD_HOVER} !important;`,
  meta: "font-size:11px; line-height:16px; font-weight:400; color:var(--subtle-foreground);",
  flat: FLAT,
} as const;

/** The frost face alone, for menus that float outside a card (no padding or slots). */
export function cardFaceCss(selector: string): string {
  return `${selector} { ${cardStyle.face} }\n.dark ${selector}, .dark${selector} { ${cardStyle.faceDark} }`;
}

export function infoCardCss(root = `[${CARD}]`): string {
  const card = `:is(${root})`;
  const s = Object.fromEntries(Object.entries(cardSlot).map(([key, attr]) => [key, `[${attr}]`])) as { [K in keyof typeof cardSlot]: string };
  const controls = `${s.action}, ${s.button}, ${s.close}, ${s.row}`;
  return `
${cardFaceCss(card)}
${card} { position:relative; box-sizing:border-box; padding:16px 24px !important; font-size:12px; line-height:16px; }
${card} :is(button, a):not(${controls}) { ${FLAT} }
${card} button:not(${controls}):not(:disabled):is(:hover, :focus-visible) { background-color:${CARD_HOVER} !important; }
${s.head} { ${cardStyle.head} }
${s.icon} { ${cardStyle.icon} }
${s.icon} > :is(svg, [data-icon-root]) { width:14px; height:14px; }
${s.title} { ${cardStyle.title} }
:is(${s.action}, ${s.close}) { ${cardStyle.action} }
:is(${s.action}, ${s.close}) :is(svg, [data-icon-root]) { width:14px; height:14px; }
${s.close} { ${cardStyle.close} }
${s.button} { ${cardStyle.button} }
/* A finger keeps the 32px hit target of the composer pills. */
${LARGE_HIT_TARGET} ${s.button} { height:32px; min-height:32px; }
:is(${s.action}, ${s.close}, ${s.button}):not(:disabled):is(:hover, :focus-visible) { ${cardStyle.hover} }
:is(${s.action}, ${s.close}, ${s.button}):is(:disabled, [aria-disabled="true"]) { opacity:.5; cursor:default; }
${s.list} { ${cardStyle.list} }
${s.row} { display:flex; align-items:center; gap:8px; min-width:0; margin:0; color:inherit; font-family:inherit; text-align:left; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
${s.row}:is(:hover, :focus-visible, :focus-within) { ${cardStyle.rowHover} }
:is(button, a)${s.row} { cursor:pointer; }
:is(${s.meta}, ${s.section}) { ${cardStyle.meta} }
${s.section} { margin:12px 0 4px; }
${s.section}:first-child { margin-top:0; }
${card} :focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
@media (prefers-reduced-motion:reduce) { ${card} :is(${controls}) { transition:none !important; } }
`;
}

export function createCardClose(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "×";
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
