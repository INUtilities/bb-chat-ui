import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";

const ACTIONS = '[data-bb-portaled-overlay][role="menu"][aria-label="Prompt actions"]';
// Limit :has() to native overlay cards, never a generic app-wide subject.
const MODELS = '[data-bb-portaled-overlay][role="dialog"]:has(input[aria-label="Search models"])';
const CARDS = `:is(${ACTIONS}, ${MODELS})`;

export const COMPOSER_MENU_GLASS_STYLE_ID = "bb-chat-ui-composer-menu-glass";
export const composerMenuGlassCss = `
${CARDS} {
  --bb-chat-ui-menu-face:${LIGHT_GLASS_FACE};
  --bb-chat-ui-menu-edge:color-mix(in oklab,var(--popover) 35%,transparent);
  --bb-chat-ui-menu-shadow:color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent);
  border-radius:18px !important;
  border-color:transparent !important;
  background:var(--bb-chat-ui-menu-face) !important;
  backdrop-filter:blur(14px) saturate(1.25);
  -webkit-backdrop-filter:blur(14px) saturate(1.25);
  box-shadow:0 6px 18px -12px var(--bb-chat-ui-menu-shadow),inset 0 1px 3px var(--bb-chat-ui-menu-edge);
}
.dark ${CARDS} {
  --bb-chat-ui-menu-face:${DARK_GLASS_FACE};
  --bb-chat-ui-menu-edge:color-mix(in oklab,var(--foreground) 8%,transparent);
  --bb-chat-ui-menu-shadow:color-mix(in oklab,var(--background) 60%,transparent);
}
/* Match the shared inner-row radius for hover, keyboard focus, and selected states. */
${ACTIONS} [role="menuitem"],
${MODELS} :is([role="option"],button[class~="hover:bg-state-hover"]) {
  border-radius:10px !important;
}
/* Keep the provider tabs and section headings on the card's single glass face. */
${MODELS} > div[class~="bg-background"],
${MODELS} div[class~="sticky"][class~="bg-background"] {
  background:transparent !important;
}
/* Blur models scrolling beneath the native sticky heading without adding a tint. */
${MODELS} [role="listbox"] > div[class~="sticky"] {
  backdrop-filter:blur(14px) saturate(1.25);
  -webkit-backdrop-filter:blur(14px) saturate(1.25);
}
`;

// Apply frost styling to the native composer menus without replacing their controls.
export function injectComposerMenuGlass(document: Document): () => void {
  const style = document.createElement("style");
  style.id = COMPOSER_MENU_GLASS_STYLE_ID;
  style.textContent = composerMenuGlassCss;
  document.head.appendChild(style);
  // Remove the menu styles when the content script is disposed.
  return () => style.remove();
}
