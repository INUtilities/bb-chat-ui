import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { clearTocReplies, paintTocReply, refreshTocOutline, registerTocOutlineReader } from './thread-toc-preview.ts';
import { injectThreadToc } from './thread-toc.ts';

// 실제 DOM과 native 사용자 ID를 가진 목차를 만든다.
function fixture(id: string, count = 2) {
  const dom = new JSDOM('<body></body>', { pretendToBeVisual: true });
  const { document } = dom.window;
  const keys = ['HTMLElement', 'HTMLButtonElement', 'Node', 'MutationObserver'] as const;
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  const root = document.createElement('div'); root.setAttribute('data-thread-toc', '');
  root.innerHTML = `<button class="no-scrollbar">${'<span class="rounded-full"></span>'.repeat(count)}</button><div id="thread-toc-panel-${id}"><ul>${Array.from({ length: count }, (_, i) => `<li><button><span>질문 ${i}</span></button></li>`).join('')}</ul></div>`;
  document.body.append(root);
  const items = [...root.querySelectorAll('li')];
  for (const [i, item] of items.entries()) {
    const props = {}; Object.assign(item, { '__reactProps$test': props, '__reactFiber$test': { key: `u${i}`, memoizedProps: props } });
  }
  return { dom, document, root, items,
    text: (i = 0) => items[i].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,
    // Promise 처리와 DOM 관찰이 끝날 때까지 기다린다.
    tick: () => new Promise<void>(resolve => setImmediate(resolve)),
    // 원래 전역과 검수 창을 복구한다.
    close() { clearTocReplies(root); dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
}

test('switching chats does not fetch an outline; the first preview coalesces reads', async () => {
  const f = fixture('demand-first'); let reads = 0;
  let finish!: (value: { items: Array<{ id: string; role: string; preview: string }> }) => void;
  const stop = registerTocOutlineReader('demand-first', () => { reads++; return new Promise(resolve => { finish = resolve; }); });
  try {
    await f.tick(); assert.equal(reads, 0, 'mounting a chat must not start preview work');
    paintTocReply(f.root, f.items[0]); paintTocReply(f.root, f.items[1]); await f.tick();
    assert.equal(reads, 1); finish({ items: [{ id: 'u1', role: 'user', preview: '' }, { id: 'a1', role: 'assistant', preview: '응답 1' }] });
    await f.tick(); assert.equal(f.text(1), '응답 1');
    refreshTocOutline('demand-first'); await f.tick(); assert.equal(reads, 2);
  } finally { stop(); f.close(); }
});

test('returning to a chat reuses text immediately and revalidates only when previewed', async () => {
  const f = fixture('demand-return'); let reads = 0;
  let stop = registerTocOutlineReader('demand-return', async () => ({ items: [{ id: 'u0', role: 'user', preview: '' }, { id: 'a0', role: 'assistant', preview: '이전 응답' }] }));
  try {
    paintTocReply(f.root, f.items[0]); await f.tick(); assert.equal(f.text(), '이전 응답');
    clearTocReplies(f.root); stop();
    let finish!: (value: { items: Array<{ id: string; role: string; preview: string }> }) => void;
    stop = registerTocOutlineReader('demand-return', () => { reads++; return new Promise(resolve => { finish = resolve; }); });
    await f.tick(); assert.equal(reads, 0);
    paintTocReply(f.root, f.items[0]); assert.equal(f.text(), '이전 응답'); await f.tick(); assert.equal(reads, 1);
    finish({ items: [{ id: 'u0', role: 'user', preview: '' }, { id: 'a0', role: 'assistant', preview: '새 응답' }] });
    await f.tick(); assert.equal(f.text(), '새 응답');
  } finally { stop(); f.close(); }
});

test('an unused invalidated outline waits, and leaving aborts its request and ignores late text', async () => {
  const f = fixture('demand-abort'); let reads = 0; let signal: AbortSignal | undefined;
  let finish!: (value: { items: Array<{ id: string; role: string; preview: string }> }) => void;
  const stop = registerTocOutlineReader('demand-abort', (value?: AbortSignal) => { signal = value; reads++; return new Promise(resolve => { finish = resolve; }); });
  try {
    refreshTocOutline('demand-abort'); await f.tick(); assert.equal(reads, 0);
    paintTocReply(f.root, f.items[0]); await f.tick(); assert.equal(reads, 1);
    stop(); assert.equal(signal?.aborted, true);
    finish({ items: [{ id: 'u0', role: 'user', preview: '' }, { id: 'a0', role: 'assistant', preview: '늦은 응답' }] });
    await f.tick(); assert.notEqual(f.text(), '늦은 응답');
  } finally { stop(); f.close(); }
});

test('a burst of rail movement shares geometry instead of measuring every tick for every event', async () => {
  const f = fixture('demand-geometry', 80), rail = f.root.querySelector('button')!;
  let measurements = 0;
  for (const [i, tick] of [...rail.children].entries()) (tick as HTMLElement).getBoundingClientRect = () => { measurements++; return { top: i * 7, height: 3 } as DOMRect; };
  const stop = injectThreadToc(f.document);
  try {
    for (let i = 0; i < 120; i++) rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove', { clientY: i % 70 }));
    await new Promise<void>(resolve => f.dom.window.requestAnimationFrame(() => resolve())); await f.tick();
    assert.ok(measurements <= 160, `expected one geometry snapshot, observed ${measurements} tick reads`);
    assert.equal(f.root.querySelectorAll('[data-bb-chat-ui-toc-current]').length, 1);
    f.root.dispatchEvent(new f.dom.window.MouseEvent('mouseleave', { relatedTarget: f.document.body }));
    await new Promise<void>(resolve => f.dom.window.requestAnimationFrame(() => resolve()));
    assert.equal(f.root.querySelectorAll('[data-bb-chat-ui-toc-current]').length, 0, 'a queued move must not reopen a left preview');
  } finally { stop(); f.close(); }
});

test('recent-chat cache evicts old threads and bounds long reply text', async () => {
  const f = fixture('demand-bounded'); let stop = () => {};
  try {
    for (let i = 0; i < 9; i++) {
      stop(); f.root.querySelector('[id^="thread-toc-panel-"]')!.id = `thread-toc-panel-demand-cache-${i}`;
      stop = registerTocOutlineReader(`demand-cache-${i}`, async () => ({ items: [{ id: 'u0', role: 'user', preview: '' }, { id: 'a0', role: 'assistant', preview: '응'.repeat(5000) }] }));
      paintTocReply(f.root, f.items[0]); await f.tick(); assert.equal(f.text()?.length, 2000);
      clearTocReplies(f.root);
    }
    stop(); f.root.querySelector('[id^="thread-toc-panel-"]')!.id = 'thread-toc-panel-demand-cache-0';
    stop = registerTocOutlineReader('demand-cache-0', () => new Promise(() => {}));
    paintTocReply(f.root, f.items[0]); assert.equal(f.text(), '응답 미리보기를 불러오는 중…', 'old threads must be evicted');
  } finally { stop(); f.close(); }
});

test('a response invalidated in flight cannot replace a newer preview', async () => {
  const f = fixture('demand-revision'); let finish!: (value: { items: Array<{ id: string; role: string; preview: string }> }) => void;
  const stop = registerTocOutlineReader('demand-revision', () => new Promise(resolve => { finish = resolve; }));
  try {
    paintTocReply(f.root, f.items[0]); await f.tick();
    refreshTocOutline('demand-revision');
    finish({ items: [{ id: 'u0', role: 'user', preview: '' }, { id: 'a0', role: 'assistant', preview: '무효화된 응답' }] });
    await f.tick(); assert.notEqual(f.text(), '무효화된 응답');
  } finally { stop(); f.close(); }
});

test('a rail replaced in the same mutation batch as its panel discards old geometry', async () => {
  const f = fixture('demand-replaced', 3), rail = f.root.querySelector('button')!;
  const stop = injectThreadToc(f.document);
  try {
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove', { clientY: 0 })); await f.tick();
    f.root.append(f.document.createElement('div'));
    rail.innerHTML = '<span class="rounded-full"></span><span class="rounded-full"></span>';
    await f.tick();
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove', { clientY: 0 }));
    await new Promise<void>(resolve => f.dom.window.requestAnimationFrame(() => resolve()));
    assert.equal((rail.firstElementChild as HTMLElement).style.width, '32px');
  } finally { stop(); f.close(); }
});
