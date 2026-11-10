import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectQuotePreview, registerQuoteReader } from './quote-preview.ts';

const PANEL = '[data-bb-chat-ui-quote-preview-card]';

// 같은 원문의 중복 조회를 합치고 닫았다 다시 열 때 재사용한다.
test('reopening a quote shares pending reads and reuses a successful original', async () => {
  const f = fixture(true); let reads = 0, finish!: (text: string) => void;
  const stop = injectQuotePreview(f.doc, { readQuote: () => { reads++; return new Promise(resolve => { finish = resolve; }); } });
  const pill = f.doc.getElementById('message') as HTMLElement;
  try {
    pill.click(); pill.click(); pill.click(); await f.tick(); assert.equal(reads, 1);
    finish('동일한 원문'); await f.tick(); assert.equal(f.doc.querySelector('[data-bb-chat-ui-quote-text]')?.textContent, '동일한 원문');
    pill.click(); pill.click(); await f.tick(); assert.equal(reads, 1);
    assert.equal(f.doc.querySelector('[data-bb-chat-ui-quote-text]')?.textContent, '동일한 원문');
  } finally { stop(); f.cleanup(); }
});

// 원문 연결이 바뀌면 같은 ID여도 이전 원문 캐시를 쓰지 않는다.
test('a replaced quote reader never receives another reader cache', async () => {
  const f = fixture(true); let secondReads = 0;
  const first = registerQuoteReader(f.doc, async () => '첫 연결의 원문');
  let second = () => {}; const stop = injectQuotePreview(f.doc);
  const pill = f.doc.getElementById('message') as HTMLElement;
  try {
    pill.click(); await f.tick(); pill.click(); first();
    second = registerQuoteReader(f.doc, async () => { secondReads++; return '새 연결의 원문'; });
    pill.click(); await f.tick(); assert.equal(secondReads, 1);
    assert.equal(f.doc.querySelector('[data-bb-chat-ui-quote-text]')?.textContent, '새 연결의 원문');
  } finally { second(); first(); stop(); f.cleanup(); }
});
// 검수용 문서에 native dialog의 최소 동작과 두 위치의 인용을 준비한다.
function fixture(phone = false) {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${phone ? 'phone' : 'desktop'}"><body><input id="input"><div data-promptbox><span id="composer" class="prompt-mention-pill" data-prompt-mention-resource='{"kind":"plugin","pluginId":"bb-chat-ui","itemId":"quote:composer","label":"작성 중 인용"}'>작성 중 인용</span></div><div data-message-column><span id="message" class="prompt-mention-pill" data-prompt-mention-resource='{"kind":"plugin","pluginId":"bb-chat-ui","itemId":"quote:message","label":"보낸 인용"}'>보낸 인용</span></div></body></html>`, { pretendToBeVisual: true });
  const doc = dom.window.document;
  const keys = ['Element', 'HTMLElement', 'Node'] as const;
  const old = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  Object.defineProperties(dom.window.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  const pointer = (node: Element, type: string, relatedTarget: EventTarget | null = null) => node.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, relatedTarget }));
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));
  const cleanup = () => { dom.window.close(); for (const [key, value] of old) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } };
  return { dom, doc, pointer, tick, cleanup };
}

// Desktop hover는 메시지·컴포저 인용에서 열리고 입력 포커스를 유지한다.
test('desktop quote hover anchors above each pill without stealing editor focus', async () => {
  const f = fixture(), reads: string[] = [];
  const stop = injectQuotePreview(f.doc, { readQuote: async id => { reads.push(id); return '원문\n다음 줄'; } });
  try {
    const input = f.doc.getElementById('input') as HTMLInputElement; input.focus();
    for (const id of ['composer', 'message']) {
      const pill = f.doc.getElementById(id)!;
      pill.getBoundingClientRect = () => ({ top: 300, bottom: 322, left: 120, right: 260, width: 140, height: 22 }) as DOMRect;
      f.pointer(pill, 'pointerover'); await f.tick();
      const card = f.doc.querySelector<HTMLElement>(PANEL); assert.ok(card);
      assert.equal(f.doc.activeElement, input);
      assert.equal(card.style.bottom, `${f.dom.window.innerHeight - 300 + 8}px`);
      assert.equal(f.doc.querySelector('dialog[open]'), null);
    }
    assert.deepEqual(reads, ['composer', 'message']);
    const pill = f.doc.getElementById('message') as HTMLElement;
    pill.click(); assert.ok(f.doc.querySelector(PANEL), 'desktop click does not toggle a hovered card');
    const card = f.doc.querySelector(PANEL)!;
    f.pointer(pill, 'pointerout', card); f.pointer(card, 'pointerover', pill);
    await new Promise(resolve => setTimeout(resolve, 160)); assert.ok(f.doc.querySelector(PANEL));
    f.pointer(card, 'pointerout', f.doc.body);
    await new Promise(resolve => setTimeout(resolve, 160)); assert.equal(f.doc.querySelector(PANEL), null);
  } finally { stop(); f.cleanup(); }
});

// Phone은 hover를 무시하고 탭으로 모달 하단 드로어를 연다.
test('phone tap opens a bottom dialog with separate heading location and source', async () => {
  const f = fixture(true), stop = injectQuotePreview(f.doc, { readQuote: async () => '원문 전문' });
  try {
    const pill = f.doc.getElementById('composer') as HTMLElement;
    f.pointer(pill, 'pointerover'); assert.equal(f.doc.querySelector(PANEL), null);
    pill.click(); await f.tick();
    const dialog = f.doc.querySelector<HTMLDialogElement>('dialog[open]'); assert.ok(dialog);
    const card = dialog.querySelector<HTMLElement>(PANEL); assert.ok(card);
    assert.equal(card.style.bottom, '8px');
    const body = card.querySelector('[data-bb-chat-ui-card-body]')!;
    assert.deepEqual([...body.children].map(node => node.textContent), ['작성 중 인용', '원문 위치 정보 없음', '원문 전문']);
    assert.equal(body.firstElementChild!.tagName, 'H3');
    assert.equal(f.doc.documentElement.style.overflow, 'hidden');
    card.querySelector('[data-bb-chat-ui-quote-text]')!.dispatchEvent(new f.dom.window.Event('scroll', { bubbles: true }));
    assert.ok(f.doc.querySelector(PANEL));
    dialog.dispatchEvent(new f.dom.window.Event('cancel', { cancelable: true }));
    assert.equal(f.doc.querySelector(PANEL), null);
    assert.equal(f.doc.documentElement.style.overflow, '');
    assert.equal(f.doc.activeElement, pill);
  } finally { stop(); f.cleanup(); }
});

// 단순 desktop 클릭은 원문 조회를 시작하지 않는다.
test('desktop click alone does not read or open a quote', () => {
  const f = fixture(); let reads = 0;
  const stop = injectQuotePreview(f.doc, { readQuote: async () => { reads++; return 'text'; } });
  try { (f.doc.getElementById('message') as HTMLElement).click(); assert.equal(reads, 0); assert.equal(f.doc.querySelector(PANEL), null); }
  finally { stop(); f.cleanup(); }
});

// 해제 중 닫기 대기와 늦은 응답이 드로어·스크롤 잠금을 복구하지 않는다.
test('phone disposal restores scroll and ignores a late quote response', async () => {
  const f = fixture(true); let finish!: (text: string) => void;
  f.doc.documentElement.style.setProperty('overflow', 'scroll', 'important');
  const stop = injectQuotePreview(f.doc, { readQuote: () => new Promise(resolve => { finish = resolve; }) });
  try {
    (f.doc.getElementById('message') as HTMLElement).click(); stop(); finish('late'); await f.tick();
    assert.equal(f.doc.querySelector('dialog'), null); assert.equal(f.doc.querySelector(PANEL), null);
    assert.equal(f.doc.documentElement.style.overflow, 'scroll');
    assert.equal(f.doc.documentElement.style.getPropertyPriority('overflow'), 'important');
  } finally { stop(); f.cleanup(); }
});

// 하단 드로어는 짧은 끌기를 복구하고 충분한 하향 끌기와 바깥 탭으로 닫힌다.
test('phone drawer supports backdrop dismissal and downward handle gestures', async () => {
  const f = fixture(true), stop = injectQuotePreview(f.doc, { readQuote: async () => '원문' });
  try {
    const pill = f.doc.getElementById('message') as HTMLElement; pill.click(); await f.tick();
    let card = f.doc.querySelector<HTMLElement>(PANEL)!;
    card.getBoundingClientRect = () => ({ height: 200 }) as DOMRect;
    const handle = card.querySelector('[data-bb-chat-ui-quote-handle]')!;
    // 같은 포인터의 이동을 native capture 없이 재현한다.
    const drag = (type: string, y: number) => {
      const event = new f.dom.window.MouseEvent(type, { bubbles: true, clientY: y });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } }); (type === 'pointerdown' ? handle : f.doc.body).dispatchEvent(event);
    };
    drag('pointerdown', 20); drag('pointermove', 40); drag('pointerup', 40);
    assert.equal(card.style.translate, ''); assert.ok(f.doc.querySelector(PANEL));
    drag('pointerdown', 20); drag('pointermove', 100); drag('pointercancel', 100);
    assert.equal(card.style.translate, ''); assert.ok(f.doc.querySelector(PANEL));
    drag('pointerdown', 20); drag('pointermove', 100); drag('pointerup', 100);
    assert.equal(f.doc.querySelector(PANEL), null);
    pill.click(); await f.tick(); card = f.doc.querySelector<HTMLElement>(PANEL)!;
    f.pointer(card.parentElement!, 'pointerdown'); assert.equal(f.doc.querySelector(PANEL), null);
  } finally { stop(); f.cleanup(); }
});

// Phone 드로어는 키보드가 줄인 가시 영역에 맞추고 기기 변경 때 정리한다.
test('phone drawer tracks visual viewport and closes on a desktop transition', async () => {
  const f = fixture(true);
  const viewport = Object.assign(new f.dom.window.EventTarget(), { width: 360, height: 400, offsetLeft: 5, offsetTop: 40 });
  Object.defineProperty(f.dom.window, 'visualViewport', { value: viewport });
  const stop = injectQuotePreview(f.doc, { readQuote: async () => '원문' });
  try {
    (f.doc.getElementById('composer') as HTMLElement).click(); await f.tick();
    const card = f.doc.querySelector<HTMLElement>(PANEL)!;
    assert.equal(card.style.width, '344px'); assert.equal(card.style.left, '13px');
    assert.equal(card.style.bottom, `${f.dom.window.innerHeight - 440 + 8}px`);
    viewport.height = 600; viewport.dispatchEvent(new f.dom.window.Event('resize'));
    assert.equal(card.style.bottom, `${f.dom.window.innerHeight - 640 + 8}px`);
    f.doc.documentElement.setAttribute('data-bb-chat-ui-root-device', 'desktop');
    viewport.dispatchEvent(new f.dom.window.Event('resize'));
    assert.equal(f.doc.querySelector('dialog'), null); assert.equal(f.doc.documentElement.style.overflow, '');
  } finally { stop(); f.cleanup(); }
});

// Native modal을 만들 수 없는 환경은 잠금이나 비모달 드로어를 남기지 않는다.
test('unavailable native dialog fails closed without a source read or scroll lock', () => {
  const f = fixture(true); let reads = 0;
  Object.defineProperty(f.dom.window.HTMLDialogElement.prototype, 'showModal', { value: undefined });
  const stop = injectQuotePreview(f.doc, { readQuote: async () => { reads++; return '원문'; } });
  try {
    (f.doc.getElementById('composer') as HTMLElement).click();
    assert.equal(reads, 0); assert.equal(f.doc.querySelector('dialog'), null); assert.equal(f.doc.documentElement.style.overflow, '');
  } finally { stop(); f.cleanup(); }
});

// 모달의 포커스 전환 중 필이 제거되면 닫은 뒤 새 작업을 시작하지 않는다.
test('removing the quote during modal opening does not start reads after cleanup', () => {
  const f = fixture(true); let reads = 0;
  const pill = f.doc.getElementById('composer') as HTMLElement;
  Object.defineProperty(f.dom.window.HTMLDialogElement.prototype, 'showModal', { value() { this.open = true; pill.remove(); } });
  const stop = injectQuotePreview(f.doc, { readQuote: async () => { reads++; return '원문'; } });
  try { pill.click(); assert.equal(reads, 0); assert.equal(f.doc.querySelector('dialog'), null); assert.equal(f.doc.documentElement.style.overflow, ''); }
  finally { stop(); f.cleanup(); }
});
