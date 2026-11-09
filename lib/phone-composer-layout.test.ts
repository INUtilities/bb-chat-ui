import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachPhoneComposerAdd, phoneComposerLayoutCss} from './phone-composer-layout.ts';

function fixture(device = 'phone') {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${device}"><head><style>${phoneComposerLayoutCss}</style></head><body>
    <div data-follow-up-composer><div data-composer-box><form data-promptbox data-promptbox-compact>
      <div data-promptbox-editor-scroll><div contenteditable tabindex="0">초안 유지</div></div><div data-promptbox-action-row></div>
    </form></div><div data-follow-up-composer-footer><button>Project</button><button>Permission</button></div></div>
    <div id="new" data-app-composer data-app-composer-role="primary"><div data-composer-box></div><div data-new-thread-footer><button>Project</button></div></div>
    </body></html>`, {pretendToBeVisual: true});
  const d = dom.window.document, form = d.querySelector<HTMLFormElement>('form')!, editor = form.querySelector<HTMLElement>('[contenteditable]')!;
  let opens = 0;
  const show = () => {
    form.removeAttribute('data-promptbox-compact');
    form.closest('[data-follow-up-composer]')!.setAttribute('data-follow-up-composer-expanded', '');
    const button = d.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', 'Prompt actions');
    button.addEventListener('click', () => opens++); form.querySelector('[data-promptbox-action-row]')!.append(button);
    return button;
  };
  const stop = attachPhoneComposerAdd(form);
  const flush = async () => {await new Promise(resolve => dom.window.setTimeout(resolve, 0)); await Promise.resolve(); await Promise.resolve();};
  return {dom, d, form, editor, show, stop, flush, opens: () => opens,
    add: () => form.querySelector<HTMLButtonElement>('[data-bb-chat-ui-compact-add]')!};
}

test('compact add expands through native editor focus and opens its own real menu once', async () => {
  const f = fixture();
  try {
    f.editor.addEventListener('focus', () => queueMicrotask(f.show), {once: true});
    const draft = f.editor.innerHTML, parent = f.editor.parentElement;
    assert.ok(f.add(), 'the compact composer must expose +');
    f.add().click(); await f.flush();
    assert.equal(f.opens(), 1);
    assert.equal(f.editor.innerHTML, draft); assert.equal(f.editor.parentElement, parent);
    assert.equal(f.dom.window.getComputedStyle(f.add()).display, 'none', 'expanded uses the real native +');
    f.stop(); assert.equal(f.form.querySelector('[data-bb-chat-ui-compact-add]'), null);
    assert.ok(f.form.querySelector('button[aria-label="Prompt actions"]'), 'disposal keeps the native action');
  } finally {f.stop(); f.dom.window.close();}
});

test('disposal cancels pending menu forwarding and never opens a later editor', async () => {
  const f = fixture();
  try {
    assert.ok(f.add()); f.add().click(); f.stop(); f.show(); await f.flush();
    assert.equal(f.opens(), 0);
  } finally {f.stop(); f.dom.window.close();}
});

test('desktop keeps native footer order and never activates the compact add enhancement', async () => {
  const f = fixture('desktop');
  try {
    f.editor.addEventListener('focus', f.show);
    f.add()?.click(); await f.flush();
    assert.equal(f.opens(), 0);
    assert.equal(f.dom.window.getComputedStyle(f.d.querySelector('[data-follow-up-composer-footer]')!).order, '0');
    if (f.add()) assert.equal(f.dom.window.getComputedStyle(f.add()).display, 'none');
  } finally {f.stop(); f.dom.window.close();}
});

test('phone moves original thread and new-thread metadata above the box without reparenting', () => {
  const f = fixture();
  try {
    for (const selector of ['[data-follow-up-composer-footer]', '[data-new-thread-footer]']) {
      const footer = f.d.querySelector<HTMLElement>(selector)!, parent = footer.parentElement;
      assert.equal(f.dom.window.getComputedStyle(footer).order, '-1');
      assert.equal(footer.parentElement, parent);
      assert.equal(f.dom.window.getComputedStyle(footer.querySelector('button')!).borderRadius, '999px', 'metadata becomes a floating pill');
      assert.equal(f.dom.window.getComputedStyle(parent!).display, 'flex');
    }
    assert.equal(f.dom.window.getComputedStyle(f.add()).display, 'inline-flex');
  } finally {f.stop(); f.dom.window.close();}
});

test('queued editor is excluded and rapid repeat activation still opens only one menu', async () => {
  const f = fixture();
  try {
    assert.ok(f.add());
    f.editor.addEventListener('focus', () => queueMicrotask(f.show), {once: true});
    f.add().click(); f.add().click(); await f.flush(); assert.equal(f.opens(), 1);
    f.stop(); f.form.setAttribute('data-queued-message-inline-editor', '');
    const stop = attachPhoneComposerAdd(f.form);
    assert.equal(f.add(), null); stop();
  } finally {f.stop(); f.dom.window.close();}
});

// BB suppresses expansion while a control pointer gesture is ending.
test('compact add waits for the native control gesture to finish before focusing', async () => {
  const f = fixture();
  try {
    let controlGesture = true;
    f.editor.addEventListener('focus', () => {if (!controlGesture) f.show();});
    f.add().click();
    queueMicrotask(() => {controlGesture = false;});
    await f.flush();
    assert.equal(f.opens(), 1, 'focus during the control gesture would be ignored by BB');
  } finally {f.stop(); f.dom.window.close();}
});

test('CSS-only compact waits for native expansion before invoking an existing menu control', async () => {
  const f = fixture();
  try {
    const native = f.show(), owner = f.form.closest('[data-follow-up-composer]')!;
    owner.removeAttribute('data-follow-up-composer-expanded');
    let openedBeforeExpansion = false;
    native.addEventListener('click', () => {if (!owner.hasAttribute('data-follow-up-composer-expanded')) openedBeforeExpansion = true;});
    f.editor.addEventListener('focus', () => queueMicrotask(() => owner.setAttribute('data-follow-up-composer-expanded', '')));
    f.add().click(); await f.flush();
    assert.equal(openedBeforeExpansion, false, 'opening during the layout commit can lose the native menu state');
    assert.equal(f.opens(), 1);
  } finally {f.stop(); f.dom.window.close();}
});

test('native roomy-layout menus receive pointer activation as well as drawer click', async () => {
  const f = fixture();
  try {
    const native = f.show(); let nativeMenuOpened = false;
    native.addEventListener('pointerdown', e => {if (e.button === 0 && !e.ctrlKey) nativeMenuOpened = true;});
    f.add().click(); await f.flush();
    assert.equal(nativeMenuOpened, true, 'a click alone does not open the native roomy-layout trigger');
    assert.equal(f.opens(), 1, 'drawer click still forwards once');
  } finally {f.stop(); f.dom.window.close();}
});
