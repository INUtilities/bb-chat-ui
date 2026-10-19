import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectComposerInfo } from "./composer-info.ts";
import { injectQueuedMessages } from "./queued-messages.ts";

function fixture(expanded = false) {
  const dom = new JSDOM(`<html><head></head><body><div data-scroll-footer><div class="chat-prompt-box"><div data-promptbox-shell><div class="grid">
    <span hidden data-bb-chat-ui-info-settings='{"showQueue":"상단 표시"}'></span>
    <section aria-label="Thread context before sending"><button id="thread-prompt-banner-git-toggle">+1 −0 · 1 file</button></section>
    <section aria-label="Queued messages"><header data-queued-messages-mode="${expanded ? 'drawer' : 'collapsed'}"><button aria-label="Toggle queued messages" aria-expanded="${expanded}" aria-controls="queue-frame">Queue <span class="tabular-nums">2</span></button></header>
      <div id="queue-frame" data-queued-messages-scroll-frame ${expanded ? '' : 'inert aria-hidden="true"'}><div data-queued-messages-scroll><ul><li data-queued-message-row><div class="flex"><div class="min-w-0"><div class="truncate">Draft</div></div><div data-queued-message-actions><button data-edit>Edit</button><button data-send>Send</button></div></div></li></ul></div></div>
      <div data-collapse ${expanded ? '' : 'hidden'}><button aria-label="Collapse queued messages" aria-controls="queue-frame">Collapse</button></div>
    </section>
  </div><div data-follow-up-composer-anchor><textarea>composer draft</textarea></div></div></div></div></body></html>`, { pretendToBeVisual:true });
  const { document } = dom.window;
  const globals = ['Element', 'HTMLElement', 'HTMLButtonElement', 'MutationObserver', 'KeyboardEvent'] as const;
  const saved = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of globals) Object.defineProperty(globalThis, key, { value:dom.window[key], configurable:true });
  const queue = document.querySelector<HTMLElement>('section[aria-label="Queued messages"]')!;
  const toggle = queue.querySelector<HTMLButtonElement>('header button')!;
  const setExpanded = (value: boolean) => {
    toggle.setAttribute('aria-expanded', String(value));
    queue.querySelector('header')!.setAttribute('data-queued-messages-mode', value ? 'drawer' : 'collapsed');
    queue.querySelector('[data-queued-messages-scroll-frame]')!.toggleAttribute('inert', !value);
    queue.querySelector<HTMLElement>('[data-collapse]')!.hidden = !value;
  };
  toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
  queue.querySelector('[data-collapse] button')!.addEventListener('click', () => setExpanded(false));
  let sent = 0;
  queue.querySelector('[data-send]')!.addEventListener('click', () => sent++);
  queue.querySelector('[data-edit]')!.addEventListener('click', () => {
    const editor = document.createElement('li');
    editor.setAttribute('data-queued-message-inline-editor', '');
    editor.innerHTML = '<textarea>unsaved queue draft</textarea><button data-cancel>Cancel</button>';
    editor.querySelector('button')!.addEventListener('click', () => editor.remove());
    queue.querySelector('ul')!.append(editor);
  });
  const tick = () => new Promise<void>(resolve => dom.window.setTimeout(resolve, 40));
  const click = (selector: string) => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    assert.ok(button, selector); button.click();
  };
  return { dom, document, queue, toggle, click, tick, sent:() => sent, cleanup() {
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  } };
}

test("managed queue has one entry point and stays usable alongside the legacy queue script", async () => {
  for (const infoFirst of [false, true]) for (const expanded of [false, true]) {
    const f = fixture(expanded);
    const stops = infoFirst ? [injectComposerInfo(f.document), injectQueuedMessages(f.document)] : [injectQueuedMessages(f.document), injectComposerInfo(f.document)];
    try {
      await f.tick();
      assert.equal(f.dom.window.getComputedStyle(f.queue).display, 'none', 'the old queue button is hidden');
      assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-trigger="queue"]').length, 1);
      for (let round = 0; round < 3; round++) {
        f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
        assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'));
        assert.equal(f.toggle.getAttribute('aria-expanded'), 'true', 'the first click really opens the native list');
        assert.equal(f.dom.window.getComputedStyle(f.queue).display, 'flex');
        assert.equal(f.dom.window.getComputedStyle(f.queue).height, 'auto');
        assert.equal(f.dom.window.getComputedStyle(f.toggle.closest('header')!).display, 'none', 'the old header button does not duplicate the new entry point');
        f.click('[data-bb-chat-ui-info-trigger="diff"]'); await f.tick();
        assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff]'), 'other pills remain usable after opening the queue');
        assert.equal(f.queue.hasAttribute('data-bb-chat-ui-info-open'), false);
        f.click('[data-bb-chat-ui-info-all]');
        f.click('[data-bb-chat-ui-info-choice="queue"]'); await f.tick();
        assert.equal(f.toggle.getAttribute('aria-expanded'), 'true');
        f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
        assert.equal(f.queue.hasAttribute('data-bb-chat-ui-info-open'), false);
      }
    } finally { stops.reverse().forEach(stop => stop()); f.cleanup(); }
  }
});

test("managed queue uses plain list rows and leaves standalone message bubbles intact", async () => {
  const f = fixture();
  const row = f.queue.querySelector<HTMLElement>('[data-queued-message-row]')!;
  const text = row.querySelector<HTMLElement>('.min-w-0')!;
  const actions = row.querySelector<HTMLElement>('[data-queued-message-actions]')!;
  const send = actions.querySelector('[data-send]');
  const stopQueue = injectQueuedMessages(f.document);
  const stopInfo = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    const style = (node: Element) => f.dom.window.getComputedStyle(node);
    assert.equal(style(row.querySelector('.flex')!).flexDirection, 'row', 'text precedes the actions');
    assert.equal(style(text).flex, '1 1 0%');
    assert.equal(style(text).maxWidth, 'none', 'message text uses the available row width');
    assert.equal(style(text).padding, '8px 0px');
    assert.equal(style(text).borderWidth, '0px');
    assert.equal(style(text).backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(style(actions).backgroundColor, 'rgba(0, 0, 0, 0)');
    for (const dark of [false, true]) {
      f.document.documentElement.classList.toggle('dark', dark);
      assert.equal(style(text).boxShadow, 'none');
      assert.equal(style(actions).boxShadow, 'none');
    }
    assert.equal(style(text.querySelector('.truncate')!).fontSize, '12px');
    assert.equal(actions.querySelector('[data-send]'), send, 'native actions remain on their original nodes');
    f.click('[data-send]'); assert.equal(f.sent(), 1);
    stopInfo();
    assert.equal(style(row.querySelector('.flex')!).flexDirection, 'row-reverse');
    assert.equal(style(text).maxWidth, '70%', 'standalone queues retain their previous message layout');
    assert.notEqual(style(text).boxShadow, 'none');
  } finally { stopInfo(); stopQueue(); f.cleanup(); }
});

test("queue actions stay vertically centered in compact rows with appropriate hit targets", async () => {
  for (const small of [true,false]) {
    const f=fixture();
    f.document.body.insertAdjacentHTML('beforeend',`<span hidden data-bb-chat-ui-hit-target="${small?'small':'large'}"></span>`);
    f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target',small?'small':'large');
    const row=f.queue.querySelector('[data-queued-message-row]')!;
    const text=row.querySelector('.min-w-0')!;
    text.querySelector('.truncate')!.textContent='A longer queued message that wraps across multiple lines.';
    const actions=row.querySelector('[data-queued-message-actions]')!;
    const original=actions.parentElement;
    const stopQueue=injectQueuedMessages(f.document); const stopInfo=injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
      const style=(node:Element)=>f.dom.window.getComputedStyle(node);
      assert.equal(style(row).padding,'4px 0px','rows no longer carry eight pixels above and below');
      assert.equal(style(row.querySelector('.flex')!).alignItems,'center','controls follow the entire message row, including wrapped text');
      assert.equal(style(actions).alignSelf,'center');
      assert.equal(style(actions.querySelector('button')!).height,small?'24px':'32px','mobile retains a larger touch target');
      assert.equal(style(text).padding,small?'4px 0px':'8px 0px','existing message body padding is preserved');
      assert.equal(style(f.queue.querySelector('[data-queued-messages-scroll]')!).padding,'4px 0px','the list has compact vertical spacing');
      assert.equal(style(f.queue).maxHeight,'var(--bb-chat-ui-info-max-height)');
      assert.equal(actions.parentElement,original,'native action controls retain their parent');
      f.click('[data-send]'); assert.equal(f.sent(),1);
      f.click('[data-edit]'); await f.tick(); assert.equal(f.queue.querySelector('textarea')!.value,'unsaved queue draft');
    } finally { stopInfo(); stopQueue(); f.cleanup(); }
  }
});

test("queue count changes update the same pill while the native toggle label stays fixed", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  try {
    const pill = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="queue"]')!;
    const count = f.toggle.querySelector('.tabular-nums')!;
    assert.equal(pill.textContent, '2');
    for (const value of ['3', '1']) {
      count.textContent = value; await f.tick();
      assert.equal(pill.textContent, value, 'add/send/delete are reflected without another user interaction');
      assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]'), pill);
      assert.ok(pill.getAttribute('aria-label')!.includes(value), 'accessible count stays current');
      assert.equal(f.toggle.getAttribute('aria-label'), 'Toggle queued messages');
    }
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    count.textContent = '4'; await f.tick();
    assert.equal(pill.textContent, '4', 'an open popover also receives count updates');
    assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'));
  } finally { stop(); f.cleanup(); }
});

test("queue count reads the current value without the hidden native roll-out number", async () => {
  const f = fixture();
  const count = f.toggle.querySelector('.tabular-nums')!;
  count.setAttribute('data-queued-messages-count', '');
  count.innerHTML = '<span aria-hidden="true" data-queued-messages-previous-count>2</span><span>3</span>';
  f.toggle.insertAdjacentHTML('afterbegin', '<span class="tabular-nums">· 30s</span>');
  const stop = injectComposerInfo(f.document);
  try {
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!;
    assert.equal(pill.textContent, '3');
    count.lastElementChild!.textContent = '4'; await f.tick();
    assert.equal(pill.textContent, '4');
    count.firstElementChild!.remove(); await f.tick();
    assert.equal(pill.textContent, '4', 'finishing the native animation never changes the displayed count');
  } finally { stop(); f.cleanup(); }
});

test("queue count ignores a legacy animated previous value without splitting real multi-digit counts", async () => {
  const f = fixture();
  const count = f.toggle.querySelector('.tabular-nums')!;
  count.innerHTML = '<span aria-hidden="true" class="bb-count-roll-out">1</span><span class="bb-count-roll-in">2</span>';
  f.toggle.insertAdjacentHTML('afterbegin', '<span class="tabular-nums">· 30s</span>');
  const stop = injectComposerInfo(f.document);
  try {
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!;
    assert.equal(pill.textContent, '2', 'previous 1 and current 2 never become 12');
    count.innerHTML = '<span class="bb-count-roll-out">1</span><span class="bb-count-roll-in">2</span>';
    await f.tick();
    assert.equal(pill.textContent, '2', 'legacy roll-out classes also identify the outgoing number');
    count.innerHTML = '<span aria-hidden="true" class="bb-count-roll-out">2</span><span class="bb-count-roll-in">12</span>';
    await f.tick();
    assert.equal(pill.textContent, '12', 'a genuine twelve-item queue retains both digits');
    count.innerHTML = '<span aria-hidden="true">12</span><span>0</span>';
    await f.tick();
    assert.equal(pill.textContent, '0');
  } finally { stop(); f.cleanup(); }
});

test("native queue editing protects the draft and releasing it restores every information control", async () => {
  const f = fixture();
  const stopQueue = injectQueuedMessages(f.document);
  const stopInfo = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    f.click('[data-send]'); assert.equal(f.sent(), 1);
    f.click('[data-edit]'); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'));
    assert.equal(f.queue.querySelector('textarea')!.value, 'unsaved queue draft');
    f.click('[data-cancel]'); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff]'));
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    assert.equal(f.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(f.document.querySelector('[data-follow-up-composer-anchor] textarea')!.textContent, 'composer draft');
  } finally { stopInfo(); stopQueue(); f.cleanup(); }
});

test("managed queue hides the redundant native collapse handle and restores it on unload", async () => {
  const f = fixture();
  const handle = f.queue.querySelector<HTMLElement>('[data-collapse]')!;
  const button = handle.querySelector('button')!;
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    assert.equal(f.dom.window.getComputedStyle(handle).display, 'none');
    assert.equal(button.parentElement, handle, 'the native handler remains available');
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(f.toggle.getAttribute('aria-expanded'), 'false');
    stop();
    f.toggle.click();
    assert.notEqual(f.dom.window.getComputedStyle(handle).display, 'none', 'the standalone queue keeps its handle');
  } finally { stop(); f.cleanup(); }
});

test("managed queue confines overflow to the native message list without replacing its controls", async () => {
  const f = fixture();
  const frame = f.queue.querySelector<HTMLElement>('[data-queued-messages-scroll-frame]')!;
  const list = f.queue.querySelector<HTMLElement>('[data-queued-messages-scroll]')!;
  const send = f.queue.querySelector('[data-send]');
  const stopQueue = injectQueuedMessages(f.document);
  const stopInfo = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
    const style = (node: Element) => f.dom.window.getComputedStyle(node);
    assert.equal(style(f.queue).overflow, 'hidden', 'the popover is not a second scroll container');
    assert.equal(style(frame).overflow, 'hidden', 'the native animation frame clips the list');
    assert.equal(style(list).overflowY, 'auto', 'only the native message list scrolls');
    assert.equal(style(list).overflowX, 'hidden');
    assert.equal(style(list).minHeight, '0px', 'the list can shrink inside the bounded frame');
    assert.equal(style(list).overscrollBehavior, 'contain');
    assert.equal(f.queue.querySelector('[data-queued-messages-scroll]'), list);
    assert.equal(f.queue.querySelector('[data-send]'), send);
    f.click('[data-send]'); assert.equal(f.sent(), 1);
    f.click('[data-edit]'); await f.tick();
    assert.equal(f.queue.querySelector('textarea')!.value, 'unsaved queue draft');
  } finally { stopInfo(); stopQueue(); f.cleanup(); }
});


test("managed queue preserves native reorder and grouping controls and reveals actions only through ellipsis", async () => {
  const f=fixture();
  const row=f.queue.querySelector<HTMLElement>('[data-queued-message-row]')!;
  const line=row.querySelector('.flex')!;
  line.insertAdjacentHTML('afterbegin','<button aria-label="Reorder queued message 1"><svg></svg></button>');
  line.insertAdjacentHTML('beforeend','<button aria-label="Queued message 1 actions" aria-expanded="false">…</button>');
  row.insertAdjacentHTML('afterend','<li data-queued-message-group-divider><button aria-label="Messages above send together">Group</button></li>');
  const more=line.querySelector<HTMLButtonElement>('[aria-label$=" actions"]')!;
  const reorder=line.querySelector('[aria-label^="Reorder"]')!;
  const divider=f.queue.querySelector('[data-queued-message-group-divider]')!;
  const actions=line.querySelector('[data-queued-message-actions]')!;
  more.addEventListener('click',()=>more.setAttribute('aria-expanded','true'));
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    const style=(node:Element)=>f.dom.window.getComputedStyle(node);
    assert.notEqual(style(reorder).display,'none','native drag activator remains available');
    assert.equal(style(reorder).borderWidth,'0px','drag activator has no decorative box');
    assert.equal(style(reorder).boxShadow,'none');
    assert.notEqual(style(divider).display,'none','native grouping boundary remains available');
    assert.notEqual(style(more).display,'none','ellipsis is available on every device');
    assert.equal(style(actions).display,'none','send/edit/delete are not always visible');
    more.click();await f.tick();
    assert.equal(style(actions).display,'none','inline actions remain hidden behind the separate menu');
    assert.ok(f.document.querySelector('[data-bb-chat-ui-queue-menu]'));
    assert.notEqual(style(more).display,'none','ellipsis remains a toggle while the popup is open');
    f.click('[data-send]');assert.equal(f.sent(),1,'original send handler still runs');
    more.setAttribute('aria-expanded','false');await f.tick();
    assert.equal(style(actions).display,'none','closing native actions restores ellipsis');
    assert.notEqual(style(more).display,'none');
    assert.equal(line.querySelector('[aria-label^="Reorder"]'),reorder,'native drag node is not replaced');
  } finally {stopInfo();stopQueue();f.cleanup();}
});

test("queue ellipsis opens a separate action popover without a glass drag handle", async () => {
  const f=fixture();
  const row=f.queue.querySelector<HTMLElement>('[data-queued-message-row]')!;
  const line=row.querySelector('.flex')!;
  line.insertAdjacentHTML('afterbegin','<button aria-label="Reorder queued message 1"><svg></svg></button>');
  line.insertAdjacentHTML('beforeend','<button aria-label="Queued message 1 actions" aria-expanded="false">…</button>');
  const nativeSend=line.querySelector<HTMLButtonElement>('[data-send]')!;
  nativeSend.setAttribute('aria-label','Send queued message 1 now');
  line.querySelector('[data-edit]')!.setAttribute('aria-label','Edit queued message 1');
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    const drag=line.querySelector('[aria-label^="Reorder"]')!;
    assert.equal(f.dom.window.getComputedStyle(drag).backdropFilter,'none','common glass buttons must not repaint the drag handle');
    f.click('[aria-label="Queued message 1 actions"]');await f.tick();
    const menu=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-queue-menu]');
    assert.ok(menu,'actions live in their own popup');
    assert.equal(menu.getAttribute('role'),'menu');
    assert.equal(menu.querySelectorAll('button').length,2,'only native actions actually available are included');
    assert.equal(f.dom.window.getComputedStyle(menu.querySelector('button')!).borderRadius,'10px','inner action corners follow the popover gutter');
    assert.equal(f.dom.window.getComputedStyle(line.querySelector('[data-queued-message-actions]')!).display,'none','native inline toolbar stays hidden');
    menu.querySelector<HTMLButtonElement>('[aria-label="Send queued message 1 now"]')!.click();
    assert.equal(f.sent(),1,'a menu action calls the original native button');
    assert.equal(f.document.querySelector('[data-bb-chat-ui-queue-menu]'),null);
    assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'),'action does not dismiss the queue');
    f.click('[aria-label="Queued message 1 actions"]');await f.tick();
    f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(f.document.querySelector('[data-bb-chat-ui-queue-menu]'),null);
    assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'),'Escape closes the nested menu first');
  } finally {stopInfo();stopQueue();f.cleanup();}
});

test("queue ellipsis is a bordered button in its row, without a displaced pseudo background", async () => {
  for (const small of [false,true]) {
    const f=fixture();
    f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target',small?'small':'large');
    const style=f.document.createElement('style');
    style.textContent='.native-more { right:10px; top:50%; border:0; background-image:linear-gradient(transparent,red); }';
    f.document.head.append(style);
    f.queue.querySelector('[data-queued-message-row] > .flex')!.insertAdjacentHTML('beforeend','<button class="native-more bg-surface-raised-solid" aria-label="Queued message 1 actions">…</button>');
    const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
      const more=f.queue.querySelector('[aria-label$=" actions"]')!;
      for (const dark of [false,true]) {
        f.document.documentElement.classList.toggle('dark',dark);
        const s=f.dom.window.getComputedStyle(more);
        assert.equal(s.right,'auto','native absolute positioning must not displace the button');
        assert.equal(s.top,'auto');
        assert.equal(s.borderTopWidth,'1px');
        assert.equal(s.borderTopStyle,'solid');
        assert.equal(s.borderRadius,'6px');
        assert.equal(s.backgroundImage,'none');
        assert.equal(s.width,'24px','ellipsis box stays compact on both devices');
        assert.equal(s.height,'24px');
        assert.equal(s.marginTop,'0px','the row centers the action button without first-line offsets');
      }
      for (const sheet of Array.from(f.document.styleSheets)) for (const rule of Array.from(sheet.cssRules)) {
        const r=rule as CSSStyleRule;
        if(r.selectorText?.includes('[class~="bg-surface-raised-solid"]')&&r.style.borderColor==='transparent')assert.equal(more.matches(r.selectorText),false,'common surface flattening must not erase the button face or border color');
      }
      const css=Array.from(f.document.querySelectorAll('style')).map(s=>s.textContent).join('\n');
      assert.match(css,/button\[aria-label\^="Queued message "\]\[aria-label\$=" actions"\]::before\s*\{\s*content:\s*none\s*!important/,'the real button owns its entire face');
    }finally{stopInfo();stopQueue();f.cleanup();}
  }
});


test("queue boundary clicks and drag keys reach native handlers without a custom pair toggle", async () => {
  const f=fixture();
  const row=f.queue.querySelector('[data-queued-message-row]')!;
  row.insertAdjacentHTML('afterend','<li data-queued-message-group-divider><button aria-label="Messages above send together" aria-disabled="false" aria-describedby="native-drag-instructions"><svg></svg></button></li><li data-queued-message-row></li>');
  const group=f.queue.querySelector<HTMLButtonElement>('[aria-label="Messages above send together"]')!;
  const keys:string[]=[],pointers:number[]=[];let clicks=0;
  group.addEventListener('keydown',event=>{assert.equal(event.defaultPrevented,false);keys.push(event.key);});
  group.addEventListener('pointerdown',()=>pointers.push(1));
  group.addEventListener('click',()=>clicks++);
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    assert.equal(group.getAttribute('aria-disabled'),'false','no plugin SDK registration is required for the native handle');
    assert.equal(group.getAttribute('aria-describedby'),'native-drag-instructions');
    assert.equal(group.hasAttribute('aria-pressed'),false,'a draggable boundary is not a toggle button');
    assert.equal(f.dom.window.getComputedStyle(group).cursor,'grab');
    for(const key of [' ','ArrowDown',' ','ArrowUp','Enter','Escape'])group.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
    group.dispatchEvent(new f.dom.window.Event('pointerdown',{bubbles:true,cancelable:true}));
    group.click();await f.tick();
    assert.deepEqual(keys,[' ','ArrowDown',' ','ArrowUp','Enter','Escape']);
    assert.deepEqual(pointers,[1]);assert.equal(clicks,1,'keyboard events do not synthesize a grouping click');
    assert.equal(f.queue.querySelector('[aria-busy]'),null);
    assert.equal(group.closest('li')!.previousElementSibling,row,'clicking does not move the divider to a hardcoded pair');
  }finally{stopInfo();stopQueue();f.cleanup();}
});

test("Escape cancels the native queue boundary drag before closing its popover", async () => {
  const f=fixture();
  f.queue.querySelector('[data-queued-message-row]')!.insertAdjacentHTML('afterend','<li data-queued-message-group-divider><button aria-label="Messages above send together"></button></li>');
  const group=f.queue.querySelector<HTMLButtonElement>('[aria-label="Messages above send together"]')!;
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  let cancellations=0;
  const nativeCancel=(event:KeyboardEvent)=>{if(event.key==='Escape'&&group.getAttribute('aria-pressed')==='true'){cancellations++;event.preventDefault();group.removeAttribute('aria-pressed');}};
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    // dnd-kit installs its document listener after the keyboard sensor activates.
    f.document.addEventListener('keydown',nativeCancel);
    group.setAttribute('aria-pressed','true');group.focus();
    group.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(cancellations,1);
    assert.ok(f.queue.hasAttribute('data-bb-chat-ui-info-open'),'the first Escape belongs to the active native drag');
    group.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(f.queue.hasAttribute('data-bb-chat-ui-info-open'),false,'another Escape still closes the popover');
  }finally{f.document.removeEventListener('keydown',nativeCancel);stopInfo();stopQueue();f.cleanup();}
});

test("queue boundary appearance follows native one-to-four message ranges and restores on unload", async () => {
  const f=fixture(),row=f.queue.querySelector('[data-queued-message-row]')!;
  row.insertAdjacentHTML('afterend','<li data-queued-message-group-divider><button aria-label="Messages above send together" title="Native boundary"><svg class="native-group-icon"></svg></button></li><li data-queued-message-row></li><li data-queued-message-row></li><li data-queued-message-row></li>');
  const style=f.document.createElement('style');style.textContent='.native-group-icon {opacity:.55}';f.document.head.append(style);
  const divider=f.queue.querySelector('[data-queued-message-group-divider]')!,group=divider.querySelector<HTMLButtonElement>('button')!,nativeIcon=group.querySelector('svg')!;
  const rows=Array.from(f.queue.querySelectorAll('[data-queued-message-row]'));
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    for(const count of [1,2,3,4,1]){
      rows[count-1].after(divider);await f.tick();
      assert.equal(group.getAttribute('data-bb-chat-ui-queue-grouped'),String(count>1));
      assert.equal(f.dom.window.getComputedStyle(group).opacity,count>1?'1':'0.4');
      assert.equal(group.getAttribute('title'),'Native boundary');
      assert.equal(group.hasAttribute('aria-pressed'),false);
      assert.equal(group.querySelector('svg'),nativeIcon);
      assert.notEqual(f.dom.window.getComputedStyle(nativeIcon).display,'none');
      assert.equal(f.dom.window.getComputedStyle(nativeIcon).opacity,'1');
      if(count===rows.length)assert.equal(f.dom.window.getComputedStyle(divider.parentElement!).paddingBottom,'12px','a final boundary keeps its lower half inside the scroller');
    }
    const editor=f.document.createElement('li');editor.setAttribute('data-queued-message-inline-editor','');rows[0].replaceWith(editor);rows[1].after(divider);await f.tick();
    assert.equal(group.getAttribute('data-bb-chat-ui-queue-grouped'),'true','native inline editing still counts toward the boundary');
    stopInfo();assert.equal(group.hasAttribute('data-bb-chat-ui-queue-grouped'),false);
    assert.equal(divider.parentElement!.hasAttribute('data-bb-chat-ui-queue-end-boundary'),false);
    assert.equal(group.getAttribute('title'),'Native boundary');
    assert.equal(group.querySelector('svg'),nativeIcon);
  }finally{stopInfo();stopQueue();f.cleanup();}
});

test('queue reorder handle stays within the clipped row and roomy desktop uses native inline actions', async () => {
  const f=fixture();
  const row=f.queue.querySelector<HTMLElement>('[data-queued-message-row]')!,line=row.querySelector('.flex')!;
  line.insertAdjacentHTML('afterbegin','<button style="margin-left:-8px" aria-label="Reorder queued message 1"></button>');
  line.insertAdjacentHTML('beforeend','<button aria-label="Queued message 1 actions">…</button>');
  let width=358;
  Object.defineProperty(f.queue,'offsetWidth',{get:()=>width});
  const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    const css=(node:Element)=>f.dom.window.getComputedStyle(node);
    assert.equal(css(line.querySelector('[aria-label^="Reorder"]')!).marginLeft,'0px');
    f.document.documentElement.setAttribute('data-bb-chat-ui-root-device','desktop');
    // Opening again also synchronizes the width/device state.
    f.click('[data-bb-chat-ui-info-trigger="queue"]');f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    assert.equal(f.queue.getAttribute('data-bb-chat-ui-queue-inline-actions'),'true');
    assert.equal(css(line.querySelector('[data-queued-message-actions]')!).display,'flex');
    assert.equal(css(line.querySelector('[aria-label$=" actions"]')!).display,'none');
    assert.equal(css(line.querySelector('[data-send]')!).borderWidth,'0px');
    assert.equal(css(line.querySelector('[data-send]')!).backgroundColor,'rgba(0, 0, 0, 0)');
    f.click('[data-send]');assert.equal(f.sent(),1);
    width=310;f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.tick();
    assert.equal(f.queue.getAttribute('data-bb-chat-ui-queue-inline-actions'),'false');
    assert.equal(css(line.querySelector('[data-queued-message-actions]')!).display,'none');
    f.document.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');width=500;
    f.click('[data-bb-chat-ui-info-trigger="queue"]');f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
    assert.equal(f.queue.getAttribute('data-bb-chat-ui-queue-inline-actions'),'false','wide phones still use ellipsis');
    stopInfo();assert.equal(f.queue.hasAttribute('data-bb-chat-ui-queue-inline-actions'),false);
  } finally {stopInfo();stopQueue();f.cleanup();}
});

test('queue row activators use the entire row vertical center on both hit targets', async () => {
  for(const small of [false,true]){
    const f=fixture();f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target',small?'small':'large');
    const line=f.queue.querySelector('[data-queued-message-row] > .flex')!;
    line.insertAdjacentHTML('afterbegin','<button class="h-7" aria-label="Reorder queued message 1"></button>');
    line.insertAdjacentHTML('beforeend','<button aria-label="Queued message 1 actions">…</button>');
    const stopQueue=injectQueuedMessages(f.document),stopInfo=injectComposerInfo(f.document);
    try{
      f.click('[data-bb-chat-ui-info-trigger="queue"]');await f.tick();
      const drag=f.dom.window.getComputedStyle(line.querySelector('[aria-label^="Reorder"]')!),more=f.dom.window.getComputedStyle(line.querySelector('[aria-label$=" actions"]')!);
      assert.equal(drag.height,more.height);assert.equal(drag.marginTop,more.marginTop);
      assert.equal(drag.height,'24px');assert.equal(drag.marginTop,'0px');
      assert.equal(f.dom.window.getComputedStyle(line).alignItems,'center');
      assert.equal(more.alignSelf,'center');
    }finally{stopInfo();stopQueue();f.cleanup();}
  }
});

