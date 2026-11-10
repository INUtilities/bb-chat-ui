import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { clearTocReplies, paintTocReply, registerTocOutlineReader } from './thread-toc-preview.ts';
import { injectThreadToc } from './thread-toc.ts';

// 실제 DOM과 native 사용자 ID를 가진 목차를 만든다.
function fixture(id: string, count = 2) {
  const dom = new JSDOM('<body></body>', { pretendToBeVisual: true });
  const { document } = dom.window;
  const keys = ['HTMLElement', 'HTMLButtonElement', 'Node', 'MutationObserver'] as const;
  const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  const root = document.createElement('div'); root.setAttribute('data-thread-toc', '');
  root.innerHTML = `<button class="no-scrollbar" aria-controls="thread-toc-panel-${id}">${'<span class="rounded-full"></span>'.repeat(count)}</button><div id="thread-toc-panel-${id}"><ul>${Array.from({ length: count }, (_, i) => `<li><button><span>질문 ${i}</span></button></li>`).join('')}</ul></div>`;
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
 const f=fixture('demand-first');let reads=0,finish!:(value:any)=>void;
 const stop=registerTocOutlineReader(f.document,async(id,signal)=>{assert.equal(id,'demand-first');assert.equal(signal.aborted,false);reads++;return new Promise(resolve=>{finish=resolve;});});
 try{await f.tick();assert.equal(reads,0);paintTocReply(f.root,f.items[0]);paintTocReply(f.root,f.items[1]);await f.tick();assert.equal(reads,1);
 finish({items:[{id:'u1',role:'user',preview:''},{id:'a1',role:'assistant',preview:'응답 1'}]});await f.tick();assert.equal(f.text(1),'응답 1');
 }finally{stop();f.close();}
});
test('reopening releases the old cache and reads fresh text only when previewed', async () => {
 const f=fixture('demand-return');let reads=0,finish!:(value:any)=>void;
 const stop=registerTocOutlineReader(f.document,async()=>{reads++;return reads===1?{items:[{id:'u0',role:'user' as const,preview:''},{id:'a0',role:'assistant' as const,preview:'이전 응답'}]}:new Promise(resolve=>{finish=resolve;});});
 try{paintTocReply(f.root,f.items[0]);await f.tick();assert.equal(f.text(),'이전 응답');clearTocReplies(f.root);await f.tick();assert.equal(reads,1);
 paintTocReply(f.root,f.items[0]);assert.notEqual(f.text(),'이전 응답');await f.tick();assert.equal(reads,2);
 finish({items:[{id:'u0',role:'user',preview:''},{id:'a0',role:'assistant',preview:'새 응답'}]});await f.tick();assert.equal(f.text(),'새 응답');
 }finally{stop();f.close();}
});
test('leaving aborts the preview request and ignores its late text without idle reads', async () => {
 const f=fixture('demand-abort');let reads=0,signal!:AbortSignal,finish!:(value:any)=>void;
 const stop=registerTocOutlineReader(f.document,async(_,s)=>{reads++;signal=s;return new Promise(resolve=>{finish=resolve;});});
 try{await f.tick();assert.equal(reads,0);paintTocReply(f.root,f.items[0]);await f.tick();assert.equal(reads,1);clearTocReplies(f.root);assert.equal(signal.aborted,true);
 finish({items:[{id:'u0',role:'user',preview:''},{id:'a0',role:'assistant',preview:'늦은 응답'}]});await f.tick();assert.equal(f.text(),undefined);assert.equal(reads,1);
 }finally{stop();f.close();}
});
test('a disposed SDK owner cannot replace a newer preview with its in-flight response', async () => {
 const f=fixture('demand-revision');let finish!:(value:any)=>void;
 const stop=registerTocOutlineReader(f.document,async()=>new Promise(resolve=>{finish=resolve;}));let next=()=>{};
 try{paintTocReply(f.root,f.items[0]);await f.tick();stop();next=registerTocOutlineReader(f.document,async()=>({items:[{id:'u0',role:'user',preview:''},{id:'a0',role:'assistant',preview:'최신 응답'}]}));
 paintTocReply(f.root,f.items[0]);await f.tick();assert.equal(f.text(),'최신 응답');finish({items:[{id:'u0',role:'user',preview:''},{id:'a0',role:'assistant',preview:'무효화된 응답'}]});await f.tick();assert.equal(f.text(),'최신 응답');
 }finally{next();stop();f.close();}
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
