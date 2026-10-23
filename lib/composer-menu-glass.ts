import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";
import { injectComposerModelMenus, MODEL_MENU_MARK } from "./composer-model-menu.ts";
import { EASE } from "./motion.ts";

const ACTIONS = '[data-bb-portaled-overlay][role="menu"][aria-label="Prompt actions"]';
const MODELS = `[data-bb-portaled-overlay][role="dialog"][${MODEL_MENU_MARK}]`;
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
${MODELS} div[class~="overflow-y-auto"] > div[class~="sticky"] {
  backdrop-filter:blur(14px) saturate(1.25);
  -webkit-backdrop-filter:blur(14px) saturate(1.25);
}
${MODELS} { width:20rem !important; max-width:min(20rem,calc(100dvw - .5rem)) !important; }
[data-bb-chat-ui-model-resizing] { overflow:hidden; border-radius:18px; }
[data-bb-chat-ui-effort-source], [data-bb-chat-ui-effort-heading] { display:none !important; }
[data-bb-chat-ui-effort] { min-width:0; padding:0 4px; color:var(--foreground); }
[data-bb-chat-ui-effort] [data-effort-caption], [data-bb-chat-ui-effort] [data-effort-ends] { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; line-height:16px; }
[data-bb-chat-ui-effort] [data-effort-caption] > span, [data-bb-chat-ui-effort] [data-effort-ends] { color:var(--muted-foreground); }
[data-bb-chat-ui-effort] output { font-weight:500; }
[data-bb-chat-ui-effort] [data-effort-track] { position:relative; height:32px; margin:2px 9px; }
[data-bb-chat-ui-effort] [data-effort-track]::before, [data-bb-chat-ui-effort] [data-effort-fill] { content:""; position:absolute; top:50%; left:0; width:100%; height:10px; transform:translateY(-50%); border-radius:999px; background:color-mix(in oklab,var(--foreground) 8%,transparent); transition:height 320ms ${EASE.out},transform 320ms ${EASE.out}; }
[data-bb-chat-ui-effort] [data-effort-fill] { background:color-mix(in oklab,var(--foreground) 22%,transparent); transform:translateY(-50%) scaleX(var(--bb-effort-progress)); transform-origin:left; }
[data-bb-chat-ui-effort] [data-effort-cursor] { position:absolute; inset:0; pointer-events:none; transform:translateX(calc(var(--bb-effort-progress) * 100%)); transition:transform 320ms ${EASE.out}; }
[data-bb-chat-ui-effort] [data-effort-thumb] { position:absolute; width:18px; height:18px; left:-9px; top:7px; border-radius:999px; background:var(--foreground); box-shadow:0 1px 3px color-mix(in oklab,var(--background) 22%,transparent); transition:transform 380ms ${EASE.overshoot}; }
[data-bb-chat-ui-effort] [data-effort-ticks] { position:absolute; inset:0; pointer-events:none; }
[data-bb-chat-ui-effort] [data-effort-ticks] > span { position:absolute; top:14px; width:4px; height:4px; margin-left:-2px; border-radius:999px; background:color-mix(in oklab,var(--foreground) 22%,transparent); }
[data-bb-chat-ui-effort] input { position:absolute; inset:0 -9px; width:calc(100% + 18px); height:32px; margin:0; padding:0; opacity:0; cursor:ew-resize; touch-action:pan-y; }
[data-bb-chat-ui-effort]:focus-within [data-effort-thumb] { outline:2px solid var(--ring); outline-offset:3px; }
[data-bb-chat-ui-effort][data-dragging] [data-effort-track]::before, [data-bb-chat-ui-effort][data-dragging] [data-effort-fill] { height:14px; transition:height 320ms ${EASE.out}; }
[data-bb-chat-ui-effort][data-dragging] [data-effort-cursor] { transition:none; }
[data-bb-chat-ui-effort][data-dragging] [data-effort-thumb] { transform:scale(1.25,.85); transition:transform 120ms ${EASE.out}; }
[data-bb-chat-ui-effort][data-disabled] { opacity:.5; }
[data-bb-chat-ui-effort][data-disabled] input { cursor:default; }
${MODELS} button[role="switch"][aria-label="Fast mode"] { width:40px !important; height:24px !important; padding:3px !important; border:0 !important; border-radius:999px !important; background:var(--muted) !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"][aria-checked="true"] { background:var(--foreground) !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"] > span { width:18px !important; height:18px !important; background:var(--foreground) !important; transform:translateX(0) !important; transition:transform 320ms ${EASE.out} !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"][aria-checked="true"] > span { background:var(--background) !important; transform:translateX(16px) !important; }
@media (prefers-reduced-motion:reduce) {
  [data-bb-chat-ui-effort] *, [data-bb-chat-ui-effort] [data-effort-track]::before, ${MODELS} button[role="switch"][aria-label="Fast mode"] > span { transition:none !important; }
}
`;

// Apply frost styling to the native composer menus without replacing their controls.
export function injectComposerMenuGlass(document: Document): () => void {
  const style = document.createElement("style");
  style.id = COMPOSER_MENU_GLASS_STYLE_ID;
  style.textContent = composerMenuGlassCss;
  document.head.appendChild(style);
  const stopMenus = injectComposerModelMenus(document);
  // Restore native portal markers and remove this generation's menu styles.
  return () => {
    stopMenus();
    style.remove();
  };
}
