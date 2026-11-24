import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from './glass-surface.ts';

const ADD = 'data-bb-chat-ui-compact-add';
const PHONE = 'html[data-bb-chat-ui-root-device="phone"]';
// 독립 Composer의 shell에는 슬롯을 꺼도 표시 속성이 남는다.
const NATIVE_FOOTER = `:is([data-follow-up-composer] > [data-follow-up-composer-footer],
  [data-app-composer][data-app-composer-role="primary"] > [data-new-thread-footer]):not([data-bb-chat-ui-fluid-details], [data-promptbox-shell][data-bb-chat-ui-slot-picker-open] *)`;

export const phoneComposerLayoutCss = `
[${ADD}] { display:none; }
${PHONE} ${NATIVE_FOOTER} > div { gap:6px; }
${PHONE} ${NATIVE_FOOTER} button {
  position:relative; height:32px !important; min-height:32px; margin:0 !important; padding:0 10px !important;
  border:0 !important; border-radius:999px !important; background:${LIGHT_GLASS_FACE};
  backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25);
  box-shadow:0 6px 18px -12px color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent), inset 0 1px 3px color-mix(in oklab,var(--popover) 35%,transparent);
}
${PHONE} ${NATIVE_FOOTER} button::before { content:''; position:absolute; inset:-6px 0; }
html.dark[data-bb-chat-ui-root-device="phone"] ${NATIVE_FOOTER} button { background:${DARK_GLASS_FACE}; box-shadow:0 6px 18px -12px color-mix(in oklab,var(--background) 60%,transparent), inset 0 1px 3px color-mix(in oklab,var(--foreground) 8%,transparent); }
${PHONE} [${ADD}] {
  position:absolute; left:4px; top:4px; z-index:21;
  align-items:center; justify-content:center; width:40px; height:40px; padding:0;
  border:0; border-radius:999px; background:transparent; color:var(--muted-foreground); cursor:pointer;
}
${PHONE} [data-promptbox][data-promptbox-compact]:not([data-promptbox-voice-active]) > [${ADD}] { display:inline-flex; }
${PHONE} [${ADD}]:hover { background:var(--accent); }
${PHONE} [${ADD}]:focus-visible { outline:2px solid var(--ring); outline-offset:-2px; }
${PHONE} [data-promptbox][data-promptbox-compact]:not([data-promptbox-voice-active]) [data-promptbox-editor-scroll] { padding-left:48px !important; }
@container follow-up-composer style(--follow-up-composer-container-compact: true) {
  ${PHONE} [data-follow-up-composer]:not([data-follow-up-composer-expanded]) [data-promptbox]:not([data-promptbox-voice-active]) > [${ADD}] { display:inline-flex; }
  ${PHONE} [data-follow-up-composer]:not([data-follow-up-composer-expanded]) [data-promptbox]:not([data-promptbox-voice-active]) [data-promptbox-editor-scroll] { padding-left:48px !important; }
}
`;

// Compact mode unmounts the host +. Focus expands through the native owner;
// then forward once to its newly mounted control instead of copying a menu.
export function attachPhoneComposerAdd(composer: HTMLElement): () => void {
  const doc = composer.ownerDocument, view = doc.defaultView;
  if (!view || composer.closest('[data-queued-message-inline-editor]')) return () => {};
  const button = doc.createElement('button');
  button.type = 'button'; button.setAttribute(ADD, '');
  button.setAttribute('aria-label', 'Prompt actions'); button.setAttribute('aria-haspopup', 'menu');
  button.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  let pending: MutationObserver | null = null, timer = 0, focusTimer = 0, disposed = false;
  const cancel = () => {pending?.disconnect(); pending = null; view.clearTimeout(timer); view.clearTimeout(focusTimer); timer = focusTimer = 0;};
  const forward = () => {
    if (!composer.isConnected || doc.documentElement.getAttribute('data-bb-chat-ui-root-device') !== 'phone') {cancel(); return;}
    const owner = composer.closest('[data-follow-up-composer]');
    if (owner && !owner.hasAttribute('data-follow-up-composer-expanded')) return;
    const native = composer.querySelector<HTMLButtonElement>(`button[aria-label="Prompt actions"]:not([${ADD}])`);
    if (!native) return;
    cancel();
    if (!native.disabled && native.getAttribute('aria-disabled') !== 'true' && native.getAttribute('aria-busy') !== 'true' && !native.closest('[inert]')) {
      // Roomy menus open on pointer/mouse down; phone drawers use click.
      // Forward the normal primary activation once for either host variant.
      const init = {bubbles:true, cancelable:true, button:0};
      const pointer = {...init, pointerType:'mouse', isPrimary:true};
      const proceed = !view.PointerEvent || native.dispatchEvent(new view.PointerEvent('pointerdown', pointer));
      if (proceed) native.dispatchEvent(new view.MouseEvent('mousedown', init));
      if (view.PointerEvent) native.dispatchEvent(new view.PointerEvent('pointerup', pointer));
      if (proceed) {
        native.dispatchEvent(new view.MouseEvent('mouseup', init));
        native.click();
      }
    }
  };
  button.addEventListener('click', () => {
    if (disposed || pending || !composer.isConnected || doc.documentElement.getAttribute('data-bb-chat-ui-root-device') !== 'phone' || composer.hasAttribute('data-promptbox-voice-active')) return;
    const editor = composer.querySelector<HTMLElement>('[data-promptbox-editor-content] [contenteditable], [data-promptbox-editor-scroll] [contenteditable], textarea');
    if (!editor || editor.getAttribute('contenteditable') === 'false' || editor.closest('[inert]')) return;
    pending = new view.MutationObserver(forward);
    pending.observe(composer, {childList:true, subtree:true, attributes:true, attributeFilter:['data-promptbox-compact']});
    const owner = composer.closest('[data-follow-up-composer]');
    if (owner) pending.observe(owner, {attributes:true, attributeFilter:['data-follow-up-composer-expanded']});
    timer = view.setTimeout(cancel, 1200);
    // BB ends its control-gesture guard after pointerup; focusing in click
    // itself would be ignored and leave the box compact.
    focusTimer = view.setTimeout(() => {focusTimer = 0; if (pending) {editor.focus({preventScroll:true}); forward();}}, 0);
  });
  composer.append(button);
  return () => {if (disposed) return; disposed = true; cancel(); button.remove();};
}
