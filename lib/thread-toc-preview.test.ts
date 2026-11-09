import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { paintTocReply, clearTocReplies, registerTocOutlineReader, TOC_REPLY_MARK, type TocOutline, type TocOutlineReader } from './thread-toc-preview.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const outline = (text = 'Current reply'): TocOutline => ({items: [
  {id:'u1',role:'user',preview:'Question'}, {id:'a1',role:'assistant',preview:text},
]});
function fixture() {
  const dom = new JSDOM('<div data-thread-toc><button class="no-scrollbar" aria-controls="thread-toc-panel-current"></button><ul></ul></div>');
  const doc = dom.window.document, root = doc.querySelector<HTMLElement>('[data-thread-toc]')!;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
  Object.defineProperty(globalThis, 'HTMLElement', {configurable:true,value:dom.window.HTMLElement});
  const add = (id: string) => {
    const item=doc.createElement('li');item.innerHTML='<button><span>Question</span></button>';
    const props={}; Object.assign(item,{__reactProps$test:props,__reactFiber$test:{key:id,memoizedProps:props}});
    root.querySelector('ul')!.append(item);return item;
  };
  const item = add('u1');
  return {dom,doc,root,item,add,text:(node=item)=>node.querySelector(`[${TOC_REPLY_MARK}]`)?.textContent,
    cleanup(){clearTocReplies(root);dom.window.close();if(previous)Object.defineProperty(globalThis,'HTMLElement',previous);else Reflect.deleteProperty(globalThis,'HTMLElement');}};
}

test('historical TOC users outside the loaded timeline receive their outline reply', async () => {
  const f=fixture();let reads=0;
  // 현재 타임라인은 새 사용자만 포함하며 이전 사용자·응답은 공개 outline에 있다.
  Object.assign(f.root,{__reactFiber$test:{memoizedProps:{threadId:'current',timelineRows:[{kind:'conversation',id:'recent',role:'user'}]}}});
  const read: TocOutlineReader=async(threadId,signal)=>{reads++;assert.equal(threadId,'current');assert.equal(signal.aborted,false);return {items:[...outline('Historical reply').items,{id:'recent',role:'user',preview:'Recent question'}]};};
  try{paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'Historical reply');assert.equal(reads,1);}finally{f.cleanup();}
});

test('TOC replies follow the active SDK source while reusing host DOM', async () => {
  const f=fixture();
  const hostProps={},fiber={memoizedProps:hostProps};Object.assign(fiber,{alternate:{memoizedProps:hostProps}});
  Object.assign(f.root,{__reactProps$test:hostProps,__reactFiber$test:fiber});
  try{
    paintTocReply(f.root,f.item,async()=>outline('Old reply'));await tick();assert.equal(f.text(),'Old reply');
    paintTocReply(f.root,f.item,async()=>outline('Updated reply'));await tick();assert.equal(f.text(),'Updated reply');
  }finally{f.cleanup();}
});

test('shared host children do not read a stale parent timeline', async () => {
  const f=fixture();Object.assign(f.root,{__reactFiber$test:{return:{memoizedProps:{threadId:'other',timelineRows:[{role:'assistant',text:'Wrong reply'}]}}}});
  try{paintTocReply(f.root,f.item,async()=>outline('Current reply'));await tick();assert.equal(f.text(),'Current reply');}finally{f.cleanup();}
});

test('closing or removing a TOC prevents a late response from reviving it', async () => {
  const f=fixture();let finish!:(value:TocOutline)=>void,signal!:AbortSignal;
  const read:TocOutlineReader=async(_,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});};
  try{
    paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'응답을 불러오는 중…');
    clearTocReplies(f.root);f.root.remove();assert.equal(signal.aborted,true);finish(outline('Late reply'));await tick();assert.equal(f.text(),undefined);
  }finally{f.cleanup();}
});

test('outline replies stop at the next user and never borrow another turn', async () => {
  const f=fixture();
  const data:TocOutline={items:[{id:'u1',role:'user',preview:'Question'}, {id:'u2',role:'user',preview:''}, {id:'a2',role:'assistant',preview:'Reply for u2'}]};
  try{paintTocReply(f.root,f.item,async()=>data);await tick();assert.equal(f.text(),'표시할 응답이 없습니다.');}finally{f.cleanup();}
});

test('switching thread scopes aborts the old request and ignores its late completion', async () => {
  const f=fixture();let finish!:(value:TocOutline)=>void,oldSignal!:AbortSignal;
  const requested:string[]=[];
  const read:TocOutlineReader=async(id,signal)=>{requested.push(id);if(id==='current'){oldSignal=signal;return new Promise(resolve=>{finish=resolve;});}return outline('Other thread reply');};
  try{
    paintTocReply(f.root,f.item,read);await tick();
    f.root.querySelector('button.no-scrollbar')!.setAttribute('aria-controls','thread-toc-panel-other');
    paintTocReply(f.root,f.item,read);await tick();assert.equal(oldSignal.aborted,true);assert.equal(f.text(),'Other thread reply');
    finish(outline('Stale thread reply'));await tick();assert.equal(f.text(),'Other thread reply');assert.deepEqual(requested,['current','other']);
  }finally{f.cleanup();}
});

test('a thread scope change without a repaint still suppresses old response content', async () => {
  const f=fixture();let finish!:(value:TocOutline)=>void;
  try{
    paintTocReply(f.root,f.item,async()=>new Promise(resolve=>{finish=resolve;}));await tick();
    f.root.querySelector('button.no-scrollbar')!.setAttribute('aria-controls','thread-toc-panel-other');
    finish(outline('Stale'));await tick();assert.notEqual(f.text(),'Stale');
  }finally{f.cleanup();}
});

test('moving between entries shares one request and paints only the latest selection', async () => {
  const f=fixture(),second=f.add('u2');let reads=0,finish!:(value:TocOutline)=>void;
  const read:TocOutlineReader=async()=>{reads++;return new Promise(resolve=>{finish=resolve;});};
  try{
    paintTocReply(f.root,f.item,read);await tick();
    for(let i=0;i<20;i++)paintTocReply(f.root, i%2?second:f.item,read);
    finish({items:[...outline('First reply').items,{id:'u2',role:'user',preview:'Second'},{id:'a2',role:'assistant',preview:'Second reply'}]});
    await tick();assert.equal(f.text(),undefined);assert.equal(f.text(second),'Second reply');assert.equal(reads,1);
    paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'First reply');assert.equal(reads,1);
  }finally{f.cleanup();}
});

test('reopening a TOC refreshes its outline instead of retaining a stale cache', async () => {
  const f=fixture();let reads=0;const read:TocOutlineReader=async()=>outline(`Reply ${++reads}`);
  try{
    paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'Reply 1');
    clearTocReplies(f.root);paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'Reply 2');assert.equal(reads,2);
  }finally{f.cleanup();}
});

test('SDK owner cleanup aborts pending reads and cannot publish a disposed reply', async () => {
  const f=fixture();let finish!:(value:TocOutline)=>void,signal!:AbortSignal;
  const stop=registerTocOutlineReader(f.doc,async(_,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
  try{
    paintTocReply(f.root,f.item);await tick();stop();assert.equal(signal.aborted,true);
    finish(outline('Disposed reply'));await tick();assert.notEqual(f.text(),'Disposed reply');
    const next=registerTocOutlineReader(f.doc,async()=>outline('New owner'));
    try{paintTocReply(f.root,f.item);await tick();assert.equal(f.text(),'New owner');}finally{next();}
  }finally{stop();f.cleanup();}
});

test('a failed outline is handled and a new opening retries it', async () => {
  const f=fixture();let reads=0;const read:TocOutlineReader=async()=>{if(++reads===1)throw Error('offline');return outline('Recovered');};
  try{
    paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'응답 미리보기를 불러오지 못했습니다.');
    clearTocReplies(f.root);paintTocReply(f.root,f.item,read);await tick();assert.equal(f.text(),'Recovered');assert.equal(reads,2);
  }finally{f.cleanup();}
});

test('an outline with no matching native user ID is never matched by text', async () => {
  const f=fixture();
  try{paintTocReply(f.root,f.item,async()=>({items:[{id:'other-user',role:'user',preview:'Question'},{id:'other-reply',role:'assistant',preview:'Wrong'}]}));await tick();assert.equal(f.text(),'응답 미리보기를 불러오지 못했습니다.');}finally{f.cleanup();}
});
