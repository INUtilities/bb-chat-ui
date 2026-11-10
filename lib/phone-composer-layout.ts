import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from './glass-surface.ts';

const ADD = 'data-bb-chat-ui-compact-add';
const PHONE = 'html[data-bb-chat-ui-root-device="phone"]';

// 실험에서는 입력 기능을 교체하지 않고 native DOM과 선택 상태를 유지한다.
export const phoneComposerLayoutCss = `
[${ADD}] { display:none; }
${PHONE} [data-follow-up-composer],
${PHONE} [data-app-composer][data-app-composer-role="primary"]:has(> [data-new-thread-footer]) { display:flex; flex-direction:column; }
${PHONE} [data-follow-up-composer] > [data-follow-up-composer-footer],
${PHONE} [data-new-thread-footer] { order:-1; margin-top:0 !important; margin-bottom:8px; flex-shrink:0; padding-inline:0 !important; }
${PHONE} :is([data-follow-up-composer-footer], [data-new-thread-footer]) > div { gap:6px; }
${PHONE} :is([data-follow-up-composer-footer], [data-new-thread-footer]) button {
  position:relative; height:32px !important; min-height:32px; margin:0 !important; padding:0 10px !important;
  border:0 !important; border-radius:999px !important; background:${LIGHT_GLASS_FACE};
  backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25);
  box-shadow:0 6px 18px -12px color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent), inset 0 1px 3px color-mix(in oklab,var(--popover) 35%,transparent);
}
${PHONE} :is([data-follow-up-composer-footer], [data-new-thread-footer]) button::before { content:''; position:absolute; inset:-6px 0; }
html.dark[data-bb-chat-ui-root-device="phone"] :is([data-follow-up-composer-footer], [data-new-thread-footer]) button { background:${DARK_GLASS_FACE}; box-shadow:0 6px 18px -12px color-mix(in oklab,var(--background) 60%,transparent), inset 0 1px 3px color-mix(in oklab,var(--foreground) 8%,transparent); }
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
      native.dispatchEvent(new view.PointerEvent('pointerdown', {bubbles:true, button:0, pointerType:'mouse', isPrimary:true}));
      native.dispatchEvent(new view.MouseEvent('mousedown', {bubbles:true, button:0}));
      native.dispatchEvent(new view.PointerEvent('pointerup', {bubbles:true, button:0, pointerType:'mouse', isPrimary:true}));
      native.dispatchEvent(new view.MouseEvent('mouseup', {bubbles:true, button:0}));
      native.click();
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
