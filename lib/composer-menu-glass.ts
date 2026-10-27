import { cardFaceCss, cardStyle, nativeActionMenuCss } from "./info-card.ts";
import { injectComposerModelMenus, MODEL_MENU_MARK, MODEL_SUBMENU_MARK, MODEL_SCROLL_MARK } from "./composer-model-menu.ts";
import { EASE } from "./motion.ts";

const ACTIONS = '[data-bb-portaled-overlay][role="menu"][aria-label="Prompt actions"]';
const PHONE_ACTIONS = '[data-persistent-drawer-content] > div[aria-label="Prompt actions"]';
const ACTION_CONTENTS = `${ACTIONS}, ${PHONE_ACTIONS}`;
const ACTION_ITEMS = `${ACTIONS} > :is(div,button)[role="menuitem"], ${PHONE_ACTIONS} > button[role="menuitem"]`;
const MODELS = `[data-bb-portaled-overlay][role="dialog"][${MODEL_MENU_MARK}]`;
const SUBMODELS = `[data-bb-portaled-overlay][role="dialog"][${MODEL_SUBMENU_MARK}]`;
const CARDS = `:is(${ACTIONS}, ${MODELS}, ${SUBMODELS})`;

export const COMPOSER_MENU_GLASS_STYLE_ID = "bb-chat-ui-composer-menu-glass";
export const composerMenuGlassCss = `
${cardFaceCss(CARDS)}
${CARDS} {
  box-shadow:0 6px 18px -12px var(--bb-chat-ui-card-shadow),inset 0 1px 3px var(--bb-chat-ui-card-edge) !important;
}
.dark ${CARDS} {
  --bb-chat-ui-card-shadow:color-mix(in oklab,var(--background) 60%,transparent);
}
${nativeActionMenuCss(ACTION_CONTENTS, ACTION_ITEMS)}
/* Model rows retain their existing 10px radius. */
${SUBMODELS} button[class~="hover:bg-state-hover"],
${MODELS} :is([role="option"],button[class~="hover:bg-state-hover"]) {
  ${cardStyle.rowRadius}
}
/* Model content uses desktop typography in both containers; native touch padding stays intact. */
${MODELS} :is([class~="text-xs"],input[aria-label="Search models"]),
${SUBMODELS} [class~="text-xs"] {
  font-size:12px !important; line-height:16px !important;
}
/* Keep provider tabs on the card's single glass face. */
${MODELS} > div[class~="bg-background"] {
  background:transparent !important;
}
/* Add a second frost layer only while model rows pass under their sticky heading. */
${MODELS} div[class~="sticky"] {
  background:transparent !important;
  backdrop-filter:none;
  -webkit-backdrop-filter:none;
  transition:background 160ms ease-out,backdrop-filter 160ms ease-out;
}
${MODELS} [${MODEL_SCROLL_MARK}] > div[class~="sticky"] {
  background:var(--bb-chat-ui-card-face) !important;
  backdrop-filter:blur(24px) saturate(1.5);
  -webkit-backdrop-filter:blur(24px) saturate(1.5);
}
${MODELS} div[class~="sticky"]::after {
  content:""; position:absolute; inset-inline:0; top:100%; height:12px; pointer-events:none;
  background:linear-gradient(to bottom,var(--bb-chat-ui-card-face),transparent);
  mask-image:linear-gradient(to bottom,var(--foreground),transparent);
  -webkit-mask-image:linear-gradient(to bottom,var(--foreground),transparent);
  opacity:0; transition:opacity 160ms ease-out;
}
${MODELS} [${MODEL_SCROLL_MARK}] > div[class~="sticky"]::after {
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); opacity:1;
}
${MODELS} { width:20rem !important; max-width:min(20rem,calc(100dvw - .5rem)) !important; }
[data-bb-chat-ui-model-resizing] { overflow:clip !important; }
[data-bb-chat-ui-effort-source], [data-bb-chat-ui-effort-heading] { display:none !important; }
[data-bb-chat-ui-effort] { min-width:0; padding:0 4px; color:var(--foreground); }
[data-bb-chat-ui-effort] [data-effort-caption] { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; font-size:12px; line-height:16px; }
[data-bb-chat-ui-effort] [data-effort-caption] > span { color:var(--muted-foreground); }
[data-bb-chat-ui-effort] output { font-weight:500; }
[data-bb-chat-ui-effort] [data-effort-track] { position:relative; height:48px; user-select:none; -webkit-user-select:none; touch-action:pan-y; cursor:grab; }
[data-bb-chat-ui-effort][data-dragging] [data-effort-track] { cursor:grabbing; }
[data-bb-chat-ui-effort] [data-effort-viewport] { position:absolute; inset:0; overflow:hidden; pointer-events:none; mask-image:linear-gradient(to right,transparent,var(--foreground) 5%,var(--foreground) 95%,transparent); }
[data-bb-chat-ui-effort] [data-effort-scale], [data-bb-chat-ui-effort] [data-effort-pin] { position:absolute; left:24px; right:24px; top:0; height:48px; }
[data-bb-chat-ui-effort] [data-effort-tick] { position:absolute; top:18px; width:1px; margin-left:-.5px; border-radius:999px; background:var(--foreground); transform:translateY(-50%); }
[data-bb-chat-ui-effort] [data-effort-tick][data-major] { width:1.5px; margin-left:-.75px; }
[data-bb-chat-ui-effort] [data-effort-label] { position:absolute; top:32px; max-width:min(48px,calc(100% / var(--bb-effort-intervals))); padding:0 2px; overflow:hidden; text-overflow:ellipsis; text-align:center; transform:translateX(-50%); color:var(--muted-foreground); font-size:10px; line-height:15px; font-weight:550; white-space:nowrap; }
[data-bb-chat-ui-effort] [data-effort-label][data-current] { color:var(--foreground); }
[data-bb-chat-ui-effort] [data-effort-pin] { z-index:2; }
[data-bb-chat-ui-effort] [data-effort-head] { position:absolute; left:-.75px; top:6px; height:22px; width:1.5px; border-radius:999px; background:var(--foreground); box-shadow:0 0 0 1px color-mix(in oklab,var(--popover) 80%,transparent); }
[data-bb-chat-ui-effort] [data-effort-head]::before { content:""; position:absolute; top:-1px; left:-.5px; width:2.5px; height:2.5px; border-radius:999px; background:var(--foreground); }
[data-bb-chat-ui-effort] input { position:absolute; top:50%; left:50%; width:1px; height:1px; margin:0; padding:0; opacity:0; pointer-events:none; }
[data-bb-chat-ui-effort]:has(input:focus-visible) [data-effort-track] { outline:2px solid var(--ring); outline-offset:2px; border-radius:10px; }
[data-bb-chat-ui-effort][data-disabled] { opacity:.5; }
[data-bb-chat-ui-effort][data-disabled] [data-effort-track] { cursor:default; }
${MODELS} button[role="switch"][aria-label="Fast mode"] { width:40px !important; height:24px !important; padding:3px !important; border:0 !important; border-radius:999px !important; background:var(--muted) !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"][aria-checked="true"] { background:var(--foreground) !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"] > span { width:18px !important; height:18px !important; flex-shrink:0; background:var(--foreground) !important; translate:none !important; transform:translateX(0) !important; transition:transform 160ms ${EASE.out} !important; }
${MODELS} button[role="switch"][aria-label="Fast mode"][aria-checked="true"] > span { background:var(--background) !important; transform:translateX(16px) !important; }
@media (prefers-reduced-motion:reduce) {
  ${MODELS} div[class~="sticky"], ${MODELS} div[class~="sticky"]::after { transition:none !important; }
  ${MODELS} button[role="switch"][aria-label="Fast mode"] > span { transition:none !important; }
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
