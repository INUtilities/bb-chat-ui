import { cardFaceCss, cardStyle } from "./info-card.ts";
import { SMALL_HIT_TARGET } from "./device-chrome.ts";

const STYLE_ID = "bb-chat-ui-queued-messages";
const QUEUE = 'section[aria-label="Queued messages"]';
const LEGACY_QUEUE = `${QUEUE}:not([data-bb-chat-ui-info-unit])`;
const MANAGED_QUEUE = `${QUEUE}[data-bb-chat-ui-info-unit]`;
const OPEN_QUEUE = `[data-promptbox-shell] > .grid[data-bb-chat-ui-info-stack] ${MANAGED_QUEUE}[data-bb-chat-ui-info-open]:not([hidden])`;
const LABEL_ATTR = "data-bb-chat-ui-queue-label";
const COLLAPSE_LABEL = "Collapse queued messages";
const AGENTATION = ".agentation-staging-shell";

export const queuedMessagesCss = `
${LEGACY_QUEUE}:has([data-queued-messages-mode]) {
  position: relative !important;
  align-self: stretch;
  width: 100%;
  margin: 0 !important;
  padding-right: 0 !important;
  padding-left: 0 !important;
  display: block !important;
  height: 32px !important;
  min-height: 32px !important;
  max-height: 32px !important;
  padding-bottom: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible !important;
}
${LEGACY_QUEUE}:has([data-queued-messages-mode]) [data-queued-messages-scroll-frame] {
  position: absolute !important;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 30;
  display: grid !important;
  width: var(--bb-chat-ui-queue-width, 100%);
  max-height: min(42dvh, 16rem);
  flex: none !important;
  grid-template-rows: 1fr;
  height: auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  opacity: 1;
  transition: grid-template-rows 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
${LEGACY_QUEUE}:has([data-queued-messages-mode="collapsed"]) [data-queued-messages-scroll-frame] {
  grid-template-rows: 0fr;
  opacity: 0;
  max-height: 0;
  pointer-events: none;
}
${LEGACY_QUEUE}:has([data-queued-messages-mode]) [data-queued-messages-scroll] {
  height: auto !important;
  min-height: 0 !important;
  padding: 4px;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
@media (prefers-reduced-motion: reduce) {
  ${LEGACY_QUEUE}:has([data-queued-messages-mode]) [data-queued-messages-scroll-frame] {
    transition: none;
  }
}
${LEGACY_QUEUE} header[data-queued-messages-mode] {
  position: absolute !important;
  right: 0;
  bottom: 0;
  z-index: 31;
  display: flex !important;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  height: 32px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 50% !important;
  background: var(--foreground) !important;
  opacity: 1;
  gap: 0;
}
${LEGACY_QUEUE} header[data-queued-messages-mode][data-bb-chat-ui-queue-label]::before {
  content: attr(data-bb-chat-ui-queue-label);
  position: absolute;
  pointer-events: none;
  color: var(--background);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}
${LEGACY_QUEUE} header[data-queued-messages-mode] > div:first-child,
${LEGACY_QUEUE} header[data-queued-messages-mode] > button {
  display: none !important;
}
${LEGACY_QUEUE} header[data-queued-messages-mode="drawer"]::before,
${LEGACY_QUEUE} header[data-queued-messages-mode="workspace"]::before {
  content: none;
}
${LEGACY_QUEUE} header[data-queued-messages-mode] > div:last-child {
  display: flex !important;
  width: 32px;
  min-width: 0;
  justify-content: center;
}
${LEGACY_QUEUE} header[data-queued-messages-mode="collapsed"] button[aria-expanded] svg {
  visibility: hidden;
}
${LEGACY_QUEUE} header[data-queued-messages-mode] > div:last-child button[aria-expanded] {
  display: inline-flex !important;
  width: 32px !important;
  height: 32px !important;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 50% !important;
  color: var(--background) !important;
  background: transparent !important;
  opacity: 1 !important;
}
${LEGACY_QUEUE} header[data-queued-messages-mode] button svg {
  opacity: 1 !important;
  color: var(--background) !important;
}
${LEGACY_QUEUE} header:not([data-queued-messages-mode="collapsed"]) button[aria-expanded] svg {
  display: none;
}
${LEGACY_QUEUE} header button[aria-expanded="true"]::after {
  content: "";
  width: 7px;
  height: 7px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
}
${LEGACY_QUEUE} [data-queued-message-group-divider] {
  display: none !important;
}
${LEGACY_QUEUE} [data-queued-message-row] button[aria-label^="Reorder"] {
  display: none !important;
}
${LEGACY_QUEUE} [data-queued-message-row] button[aria-label^="Queued message "][aria-label$=" actions"] {
  display: none !important;
}
${LEGACY_QUEUE} [data-queued-message-row] {
  border: 0 !important;
  background: transparent !important;
  padding: 4px 0 !important;
}
${LEGACY_QUEUE} [data-queued-message-row] > .flex {
  width: 100%;
  align-items: center !important;
  justify-content: flex-start;
  flex-direction: row-reverse;
  gap: 8px;
}
${LEGACY_QUEUE} [data-queued-message-row] > .flex > .min-w-0 {
  flex: 0 1 auto;
  max-width: 70%;
  overflow: visible !important;
  background: var(--surface-recessed-solid);
  color: var(--foreground);
  border: 1px solid var(--border-seam);
  border-radius: calc(var(--radius) + 4px);
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  line-height: 1.625;
  opacity: 1;
}
${LEGACY_QUEUE} [data-queued-message-row] .truncate:not(.prompt-mention-pill, .prompt-mention-pill *) {
  overflow: visible !important;
  text-overflow: unset !important;
  white-space: normal !important;
  font-size: 0.875rem !important;
  line-height: 1.625 !important;
}
${LEGACY_QUEUE} [data-queued-message-actions] {
  position: static !important;
  top: auto !important;
  right: auto !important;
  transform: none !important;
  translate: none !important;
  align-self: center !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  display: flex !important;
  background: var(--surface-raised-solid) !important;
}
${LEGACY_QUEUE} [data-queued-message-row] > .flex > .min-w-0,
${LEGACY_QUEUE} [data-queued-message-actions] {
  box-shadow: 0 4px 12px -4px color-mix(in oklab, var(--ink, var(--foreground)) 20%, transparent) !important;
}
.dark ${LEGACY_QUEUE} [data-queued-message-row] > .flex > .min-w-0,
.dark ${LEGACY_QUEUE} [data-queued-message-actions] {
  box-shadow: 0 4px 12px -4px color-mix(in oklab, black 50%, transparent) !important;
}
${LEGACY_QUEUE} [data-queued-message-actions] button[aria-label^="Delete"] {
  order: 1;
}
${LEGACY_QUEUE} [data-queued-message-actions] button[aria-label^="Send"],
${LEGACY_QUEUE} [data-queued-message-actions] button[aria-label^="Steer"] {
  order: 2;
}
${LEGACY_QUEUE} [data-queued-message-actions] button[aria-label^="Edit"] {
  order: 3;
}
${MANAGED_QUEUE} [data-queued-message-row] {
  ${cardStyle.rowBox}
  padding:6px 8px !important;
  ${cardStyle.rowGutter}
}
${MANAGED_QUEUE} [data-queued-message-row]:is(:hover, :focus-within) {
  ${cardStyle.rowHover}
}
${MANAGED_QUEUE} [data-queued-messages-scroll] > ul { display:flex; flex-direction:column; row-gap:0; }
/* Keep the hover gutter inside the clipped viewport; message content stays at the body edge. */
${OPEN_QUEUE} [data-queued-messages-scroll-frame] { width:calc(100% + 16px) !important; margin-left:-8px; margin-right:-8px; }
${OPEN_QUEUE} [data-queued-messages-scroll] { box-sizing:border-box; padding-left:8px !important; padding-right:8px !important; }
${MANAGED_QUEUE} [data-queued-message-row] > .flex {
  width: 100%;
  flex-direction: row;
  align-items: center !important;
}
/* These controls must beat the common glass-button rule, including hover. */
${OPEN_QUEUE} :is(button[aria-label^="Reorder"], button[aria-label="Messages above send together"]) {
  border:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}
${OPEN_QUEUE} button[aria-label="Messages above send together"] {
  opacity:.4;
  cursor:grab;
}
${OPEN_QUEUE} button[aria-label^="Reorder"] { margin-left:0 !important; margin-top:0; height:24px; min-height:24px; flex-shrink:0; }
${OPEN_QUEUE} button[aria-label="Messages above send together"][data-bb-chat-ui-queue-grouped="true"] {
  opacity:1 !important;
  color:var(--foreground) !important;
  background:color-mix(in oklab,var(--foreground) 8%,transparent) !important;
}
${OPEN_QUEUE} button[aria-label="Messages above send together"] :is(svg,[data-icon-root]) { opacity:1 !important; }
${OPEN_QUEUE} button[aria-label="Messages above send together"]:active { cursor:grabbing; }
${OPEN_QUEUE} button[aria-label="Messages above send together"]:disabled { cursor:default; }
${MANAGED_QUEUE} [data-bb-chat-ui-queue-end-boundary="true"] { padding-bottom:12px; }
${OPEN_QUEUE} button[aria-label^="Queued message "][aria-label$=" actions"] {
  display:inline-flex !important;
  position:relative !important;
  top:auto !important;
  right:auto !important;
  bottom:auto !important;
  left:auto !important;
  transform:none !important;
  translate:none !important;
  flex:none;
  align-self:center;
  border:0 !important;
  border-radius:999px !important;
  color:var(--subtle-foreground);
  background:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
  transition:background-color 150ms ease-out, color 150ms ease-out;
}
/* The row menu is the card's icon action (info-card.ts): flat, 6% only while pointed or open. */
${OPEN_QUEUE} button[aria-label^="Queued message "][aria-label$=" actions"]:is(:hover,:focus-visible,[aria-expanded="true"]) { ${cardStyle.hover} }
${OPEN_QUEUE} button[aria-label^="Queued message "][aria-label$=" actions"]::before {
  content:none !important;
}
${OPEN_QUEUE} button[aria-label^="Queued message "][aria-label$=" actions"] svg { width:14px; height:14px; position:relative; }
${MANAGED_QUEUE} [data-queued-message-row] > .flex > .min-w-0 {
  flex: 1 1 0%;
  max-width: none;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow-wrap: anywhere;
  ${cardStyle.prose}
}
${MANAGED_QUEUE} [data-queued-message-row] .truncate:not(.prompt-mention-pill, .prompt-mention-pill *) {
  /* The host's layered !text-xs takes priority over unlayered !important. */
  --text-xs: 12px;
  --text-xs--line-height: 16px;
  font-size: 12px !important;
  line-height: 16px !important;
}
${MANAGED_QUEUE} [data-queued-message-actions] {
  display: none !important;
  position: static !important;
  transform: none !important;
  translate: none !important;
  flex: none;
  align-self: center !important;
  background: transparent !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
${MANAGED_QUEUE} :is([data-queued-message-actions] button, button[aria-label^="Queued message "][aria-label$=" actions"]) {
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0 !important;
  border-radius: 999px !important;
}
${SMALL_HIT_TARGET} ${MANAGED_QUEUE} :is([data-queued-message-actions] button, button[aria-label^="Queued message "][aria-label$=" actions"]) {
  width: 24px;
  height: 24px;
  min-height: 24px;
}
${MANAGED_QUEUE} button[aria-label^="Queued message "][aria-label$=" actions"] {
  margin-top:0;
}
${MANAGED_QUEUE} [data-queued-message-actions]::before {
  content: none !important;
}
${MANAGED_QUEUE} [data-queued-message-row] > .flex > .min-w-0,
${MANAGED_QUEUE} [data-queued-message-actions],
.dark ${MANAGED_QUEUE} [data-queued-message-row] > .flex > .min-w-0,
.dark ${MANAGED_QUEUE} [data-queued-message-actions] {
  box-shadow: none !important;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-inline-actions="true"] button[aria-label^="Queued message "][aria-label$=" actions"] { display:none !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-inline-actions="true"] [data-queued-message-actions] { display:flex !important; gap:4px; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-inline-actions="true"] [data-queued-message-actions] button {
  border:0 !important; background:transparent !important;
  box-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
  transition:background-color 150ms ease-out;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-inline-actions="true"] [data-queued-message-actions] button:is(:hover,:focus-visible) { background:color-mix(in oklab,var(--foreground) 6%,transparent) !important; }
/* Keep the native rich editor mounted, but replace the queue list surface while editing. */
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] > :is([data-bb-chat-ui-info-close-heading],[data-bb-chat-ui-info-dismiss]),
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] :is([data-queued-message-row],[data-queued-message-group-divider]) { display:none !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-queued-message-inline-editor] {
  display:flex; flex-direction:column; flex:0 1 auto; min-height:0;
  margin:0; padding:0 !important; border:0 !important; list-style:none;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-bb-chat-ui-queue-editor-pass] { display:contents !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-bb-chat-ui-queue-editor-flow] {
  display:flex !important; flex-direction:column; flex:0 1 auto; min-height:0 !important; height:auto !important; max-height:none !important;
  border:0 !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important;
  backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] :is([data-bb-chat-ui-queue-editor-pass],[data-bb-chat-ui-queue-editor-flow])::before,
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] :is([data-bb-chat-ui-queue-editor-pass],[data-bb-chat-ui-queue-editor-flow])::after { display:none !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-queued-messages-scroll] > :not(ul),
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-queued-messages-scroll-frame] > :not([data-queued-messages-scroll]),
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-queued-message-inline-editor] > [data-overflow-fade] { display:none !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-inline-message-editor-frame] > div:first-child {
  display:flex; align-items:center; flex:none; min-height:28px; padding:0; margin-bottom:12px; ${cardStyle.text}
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-inline-message-editor-frame] > div:first-child button { margin-inline-start:auto; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-inline-message-editor-frame] > div:first-child > span { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox] {
  background:transparent !important; border:0 !important; border-radius:0 !important; box-shadow:none !important;
  backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-layout] { display:contents !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-main] { display:flex !important; flex-direction:column; flex:0 1 auto; min-height:0; overflow:hidden; opacity:1 !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-input-region] { flex:0 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-input-region] > [data-promptbox-standard-actions],
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] button[aria-label="Collapse prompt box"] { display:none !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-editor-scroll] { height:auto !important; min-height:68px !important; max-height:none !important; padding:0 !important; overflow:visible !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-editor-content],
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [contenteditable="true"] { height:auto !important; min-height:68px !important; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-promptbox-action-row] { position:relative; flex-shrink:0; margin-top:12px; padding:0 !important; gap:8px; }
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] :is([data-promptbox-action-row],[data-follow-up-composer-footer]) button {
  border:0 !important; box-shadow:none !important; background:transparent !important;
  backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
}
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] :is([data-promptbox-action-row],[data-follow-up-composer-footer]) button:is(:hover,:focus-visible) { background:color-mix(in oklab,var(--foreground) 6%,transparent) !important; }
/* Preserve the native editor layout while hiding settings that cannot be changed here. */
${OPEN_QUEUE}[data-bb-chat-ui-queue-editing="true"] [data-bb-chat-ui-queue-editor-toolbar] {
  display:grid !important; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:minmax(0,1fr) minmax(12px,auto) auto; column-gap:4px; container-type:inline-size;
}
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox] {
  display:grid !important; grid-column:1 / -1; grid-row:1 / 4; grid-template-columns:subgrid; grid-template-rows:subgrid; container-type:normal !important;
}
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-main] { display:contents !important; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-input-region] { grid-column:1 / -1; grid-row:1; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-main] > [data-promptbox-expanded-only] { grid-column:1 / -1; grid-row:2; padding-bottom:12px; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] { display:grid; grid-column:1 / -1; grid-row:3; grid-template-columns:subgrid; column-gap:4px; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] > [data-promptbox-standard-actions]:first-of-type { grid-column:1; min-width:0 !important; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] > [data-promptbox-standard-actions]:last-child { grid-column:2; flex-wrap:nowrap; }
${OPEN_QUEUE} [data-queued-message-inline-editor] [data-follow-up-composer-footer],
${OPEN_QUEUE} [data-queued-message-inline-editor] [data-promptbox-action-row] button[aria-label^="Provider, model and reasoning"] { display:none !important; }
${OPEN_QUEUE} [data-promptbox-action-row] button[aria-label="Prompt actions"] { display:inline-flex !important; flex-shrink:0; margin-left:0 !important; min-width:32px; opacity:1; }
${SMALL_HIT_TARGET} ${OPEN_QUEUE} [data-promptbox-action-row] button[aria-label="Prompt actions"] { min-width:24px; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] { align-items:center; min-height:32px; margin-top:0 !important; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] > [data-promptbox-standard-actions] { height:32px; min-height:32px; align-self:center; align-items:center; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] button { display:inline-flex; align-items:center; justify-content:center; height:32px !important; min-height:32px; min-width:32px; padding:0 !important; line-height:1; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-editor-toolbar] [data-promptbox-action-row] button svg { display:block; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-edit-save] { min-width:32px; min-height:32px; height:32px !important; flex-shrink:0; opacity:1 !important; color:var(--foreground) !important; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-edit-save] > :not([data-bb-chat-ui-queue-save-icon]) { display:none !important; }
${OPEN_QUEUE} [data-bb-chat-ui-queue-save-icon] { display:block; width:16px; height:16px; }

${cardFaceCss("[data-bb-chat-ui-queue-menu]")}
[data-bb-chat-ui-queue-menu] {
  position:fixed;
  z-index:56;
  display:flex;
  gap:4px;
  padding:8px;
}
[data-bb-chat-ui-queue-menu] button {
  display:inline-flex; align-items:center; justify-content:center;
  width:32px; height:32px; padding:0; border:0; border-radius:10px;
  color:inherit; background:transparent; cursor:pointer;
}
${SMALL_HIT_TARGET} [data-bb-chat-ui-queue-menu] button { width:24px; height:24px; }
[data-bb-chat-ui-queue-menu] button:is(:hover,:focus-visible) { background:color-mix(in oklab,var(--foreground) 6%,transparent); }
[data-bb-chat-ui-queue-menu] button:focus-visible { outline:1px solid var(--ring); }
[data-bb-chat-ui-queue-menu] button:disabled { opacity:.5; cursor:default; }
[data-bb-chat-ui-queue-menu] button[aria-label^="Delete"] { color:var(--destructive); }
[data-bb-chat-ui-queue-menu] button :is(svg,[data-icon-root]) { width:16px; height:16px; }
`;

export function readQueueCount(text: string | null): string {
  const count = text?.trim() ?? "";
  return /^\d+$/.test(count) ? count : "";
}

export function queuePillLabel(
  mode: string | null,
  count: string,
  caret?: string | null,
): string {
  if (caret === COLLAPSE_LABEL) return "";
  if (mode === "drawer" || mode === "workspace") return "";
  return count.length > 0 ? count : "•";
}

export type ExpandablePanel = "agentation" | "queue";
export type ExclusiveExpansionAction =
  | "collapse-agentation"
  | "collapse-queue"
  | "block-agentation"
  | null;

export function exclusiveExpansionAction(input: {
  opening: ExpandablePanel;
  agentationExpanded: boolean;
  queueExpanded: boolean;
  queueEditing: boolean;
}): ExclusiveExpansionAction {
  if (input.opening === "queue" && input.agentationExpanded) {
    return "collapse-agentation";
  }
  if (input.opening === "agentation" && input.queueExpanded) {
    return input.queueEditing ? "block-agentation" : "collapse-queue";
  }
  return null;
}

export function shouldFoldQueue(input: {
  mode: string | null;
  canCollapse: boolean;
  editing: boolean;
  folded: boolean;
}): boolean {
  if (input.folded || input.editing || !input.canCollapse) return false;
  return input.mode === "drawer";
}

function syncSection(
  section: HTMLElement,
  folded: WeakSet<HTMLElement>,
): HTMLElement | null {
  if (section.hasAttribute("data-bb-chat-ui-info-unit")) return null;
  const header = section.querySelector("header[data-queued-messages-mode]");
  if (!(header instanceof HTMLElement)) return null;
  const mode = header.getAttribute("data-queued-messages-mode");
  // A section that starts collapsed has already reached its initial state.
  // Mark it now so the user's first expand is not immediately folded again.
  if (mode === "collapsed") folded.add(section);
  const count = readQueueCount(
    header.querySelector("span.tabular-nums")?.textContent ?? null,
  );
  const caret = header.querySelector("button[aria-expanded]");
  const label = queuePillLabel(mode, count, caret?.getAttribute("aria-label"));
  if (header.getAttribute(LABEL_ATTR) !== label) {
    header.setAttribute(LABEL_ATTR, label);
  }
  const editing =
    section.querySelector("[data-queued-message-inline-editor]") !== null;
  const canCollapse = caret instanceof HTMLButtonElement;
  if (
    !shouldFoldQueue({
      mode,
      canCollapse,
      editing,
      folded: folded.has(section),
    })
  ) {
    return null;
  }
  folded.add(section);
  return section;
}

function collapseQueue(section: Element): void {
  const collapse = section.querySelector(`button[aria-label="${COLLAPSE_LABEL}"]`);
  if (collapse instanceof HTMLButtonElement) {
    collapse.click();
    return;
  }
  // A drawer with many messages uses its caret to open a workspace.
  // The host's surface handle still supports Escape to collapse that drawer.
  const handle = section.querySelector("header > button");
  handle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

export function injectQueuedMessages(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = queuedMessagesCss;
  document.head.append(style);

  const folded = new WeakSet<HTMLElement>();
  let changingExpansion = false;
  const onClickCapture = (event: MouseEvent) => {
    if (changingExpansion || !(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest("[data-bb-chat-ui-info-stack]")) return;
    const expandedToggle = target.closest(QUEUE + ' header button[aria-expanded="true"]');
    if (expandedToggle && expandedToggle.getAttribute("aria-label") !== COLLAPSE_LABEL) {
      const section = expandedToggle.closest(QUEUE);
      if (!section || section.querySelector("[data-queued-message-inline-editor]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      collapseQueue(section);
      return;
    }
    const queueToggle = target.closest(
      QUEUE + ' header button[aria-expanded="false"]',
    );
    const agentationToggle = target.closest(
      AGENTATION + ' button[aria-expanded="false"]',
    );
    if (!queueToggle && !agentationToggle) return;

    const scope = target.closest("[data-scroll-footer]") ?? document;
    const agentationExpanded =
      scope.querySelector(AGENTATION + ".agentation-staging-shell--expanded") !==
      null;
    const expandedQueueButton = scope.querySelector(
      QUEUE + ' header button[aria-expanded="true"]',
    );
    const queueEditing =
      scope.querySelector(QUEUE + " [data-queued-message-inline-editor]") !==
      null;
    const action = exclusiveExpansionAction({
      opening: queueToggle ? "queue" : "agentation",
      agentationExpanded,
      queueExpanded: expandedQueueButton !== null,
      queueEditing,
    });

    if (action === "block-agentation") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    changingExpansion = true;
    try {
      if (action === "collapse-queue") {
        const section = expandedQueueButton?.closest(QUEUE);
        if (section) collapseQueue(section);
      } else if (action === "collapse-agentation") {
        const collapse = scope.querySelector(
          AGENTATION + '.agentation-staging-shell--expanded button[aria-label="Collapse staged annotations"]',
        );
        if (collapse instanceof HTMLButtonElement) collapse.click();
      }
    } finally {
      changingExpansion = false;
    }
  };
  document.addEventListener("click", onClickCapture, true);
  const sync = () => {
    const sections = document.querySelectorAll(QUEUE);
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections.item(index);
      if (!(section instanceof HTMLElement)) continue;
      if (!section.querySelector("[data-queued-messages-mode]")) continue;
      const collapse = syncSection(section, folded);
      if (collapse) collapseQueue(collapse);
    }
  };

  let mutations: MutationObserver | null = null;
  if (document.body && typeof MutationObserver !== "undefined") {
    // The queue lives in the composer; transcript batches (scroll, streaming) cannot change it.
    mutations = new MutationObserver((records) => {
      if (records.every((record) => {
        const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        return target?.closest("[data-timeline-items]") != null;
      })) return;
      sync();
    });
    mutations.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["data-queued-messages-mode", "aria-label", "aria-expanded"],
    });
  }
  sync();

  return () => {
    mutations?.disconnect();
    document.removeEventListener("click", onClickCapture, true);
    style.remove();
    const headers = document.querySelectorAll(`header[${LABEL_ATTR}]`);
    for (let index = 0; index < headers.length; index += 1) {
      headers.item(index)?.removeAttribute(LABEL_ATTR);
    }
  };
}
