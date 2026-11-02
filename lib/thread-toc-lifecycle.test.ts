import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectThreadToc } from './thread-toc.ts';

function fixture() {
  const dom=new JSDOM('<body></body>',{pretendToBeVisual:true});const {document}=dom.window;
  const keys=['HTMLElement','HTMLButtonElement','Node','MutationObserver'] as const;
  const previous=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:dom.window[key]});
  const active=new Map<Element,Map<string,Set<EventListenerOrEventListenerObject>>>();
  const add=dom.window.Element.prototype.addEventListener;const remove=dom.window.Element.prototype.removeEventListener;
  dom.window.Element.prototype.addEventListener=function(type,listener,options) {
    if(listener&&this.matches('[data-thread-toc],button.no-scrollbar')&&['mouseenter','mousemove','click','mouseleave'].includes(type)){
      if(!active.has(this))active.set(this,new Map());const types=active.get(this)!;if(!types.has(type))types.set(type,new Set());types.get(type)!.add(listener);
    }
    return add.call(this,type,listener,options);
  };
  dom.window.Element.prototype.removeEventListener=function(type,listener,options) {
    if(listener)active.get(this)?.get(type)?.delete(listener);return remove.call(this,type,listener,options);
  };
  const makeRoot=()=>{const root=document.createElement('div');root.setAttribute('data-thread-toc','');root.innerHTML='<button class="no-scrollbar"><span class="rounded-full"></span></button>';document.body.append(root);return root;};
  return {document,dom,makeRoot,count:(node:Element)=>[...(active.get(node)?.values()??[])].reduce((n,listeners)=>n+listeners.size,0),tick:()=>new Promise<void>(resolve=>setImmediate(resolve)),cleanup(){
    for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
    dom.window.close();
  }};
}

test('detached TOC root and rail release their listeners and can bind again without stale hover',async()=>{
  const f=fixture();const root=f.makeRoot();const rail=root.querySelector('button')!;const tick=rail.querySelector('span')!;const stop=injectThreadToc(f.document);
  try {
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));
    assert.equal(tick.style.width,'32px');assert.equal(f.count(root),1);assert.equal(f.count(rail),3);
    root.remove();await f.tick();
    assert.equal(f.count(root),0,'root listener is released on SPA navigation');
    assert.equal(f.count(rail),0,'rail listeners are released before plugin unload');
    assert.equal(root.hasAttribute('data-bb-chat-ui-toc-root'),false);
    assert.equal(tick.style.width,'');assert.equal(tick.hasAttribute('data-bb-chat-ui-toc-selected'),false);
    f.document.body.append(root);await f.tick();
    assert.equal(f.count(root),1);assert.equal(f.count(rail),3);
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(tick.style.width,'32px');
    stop();assert.equal(f.count(root),0);assert.equal(f.count(rail),0);
  } finally {stop();f.cleanup();}
});

test('replacing just a TOC rail releases the old rail and retains exactly one live root listener',async()=>{
  const f=fixture();const root=f.makeRoot();const rail=root.querySelector('button')!;const stop=injectThreadToc(f.document);
  try {
    const next=f.document.createElement('button');next.className=rail.className;next.innerHTML=rail.innerHTML;rail.replaceWith(next);await f.tick();
    assert.equal(f.count(rail),0);assert.equal(rail.hasAttribute('data-bb-chat-ui-toc-rail'),false);
    assert.equal(f.count(next),3);assert.equal(f.count(root),1);
    next.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(next.querySelector('span')!.style.width,'32px');
    root.remove();f.document.body.append(root);await f.tick();
    assert.equal(f.count(next),3,'same-batch moves do not duplicate bindings');assert.equal(next.querySelector('span')!.style.width,'32px','connected roots keep their current hover');
  } finally {stop();f.cleanup();}
});

test('sidebar and message changes skip TOC scans while nested new rails are still discovered',async()=>{
  const f=fixture();const root=f.makeRoot();const stop=injectThreadToc(f.document);
  try {
    await f.tick();
    let scans=0;const query=f.document.querySelectorAll.bind(f.document);
    f.document.querySelectorAll=((selector:string)=>{if(selector.startsWith('[data-thread-toc]'))scans++;return query(selector);}) as typeof f.document.querySelectorAll;
    const sidebar=f.document.createElement('aside');sidebar.innerHTML='<div>Sidebar row</div>';f.document.body.append(sidebar);await f.tick();
    sidebar.firstElementChild!.textContent='Updated row';await f.tick();
    assert.equal(scans,0,'unrelated changes do not scan all TOC roots or rails');
    const wrapper=f.document.createElement('section');wrapper.innerHTML='<div data-thread-toc><button class="no-scrollbar"><span class="rounded-full"></span></button></div>';
    f.document.body.append(wrapper);await f.tick();
    const rail=wrapper.querySelector('button')!;assert.equal(f.count(rail),3);
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(rail.querySelector('span')!.style.width,'32px');
    assert.equal(f.count(root),1);
  } finally {stop();f.cleanup();}
});

// 동일 문구의 사용자 메시지도 native ID와 대화 순서로 응답을 연결한다.
test('TOC preview reuses native row IDs and keeps replies inside their user turn',async()=>{
  const f=fixture(),root=f.makeRoot(),rail=root.querySelector('button')!;
  rail.insertAdjacentHTML('beforeend','<span class="rounded-full"></span>');
  root.insertAdjacentHTML('beforeend','<div id="thread-toc-panel-pairs"><div class="rounded-lg"><div class="max-h-64"><ul><li><button><span class="line-clamp-2">같은 질문</span></button></li><li><button><span class="line-clamp-2">같은 질문</span></button></li></ul></div></div></div>');
  const rows:Array<Record<string,unknown>>=[
    {kind:'conversation',id:'u1',role:'user',text:'같은 질문'},
    {kind:'conversation',id:'a1',role:'assistant',text:'첫 번째 진행 안내'},
    {kind:'conversation',id:'a2',role:'assistant',text:'첫 번째 최종 응답'},
    {kind:'conversation',id:'u2',role:'user',text:'같은 질문'},
    {kind:'conversation',id:'u3',role:'user',text:'다음 질문'},
    {kind:'conversation',id:'a3',role:'assistant',text:'다음 질문의 응답'},
  ];
  for(const row of rows)row.threadId='thread-test';
  const props={},host={memoizedProps:props},owner={memoizedProps:{threadId:'thread-test',timelineRows:rows},child:host};
  const tree={child:owner};
  Object.assign(tree,{stateNode:{current:tree}});Object.assign(owner,{return:tree});Object.assign(host,{return:owner});
  Object.assign(root,{'__reactProps$test':props,'__reactFiber$test':host});
  const items=[...root.querySelectorAll('li')];
  for(const [index,item] of items.entries()){
    const itemProps={};Object.assign(item,{'__reactProps$test':itemProps,'__reactFiber$test':{key:index===0?'u1':'u2',memoizedProps:itemProps}});
  }
  const ticks=[...rail.querySelectorAll('span')];
  for(const [index,tick] of ticks.entries())tick.getBoundingClientRect=()=>({top:index*20,height:3}) as DOMRect;
  const stop=injectThreadToc(f.document);
  try{
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'첫 번째 최종 응답');
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:20}));await f.tick();
    assert.equal(items[1].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'표시할 응답이 없습니다.');
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]'),null);
    rows.splice(1,0,{kind:'turn',id:'unloaded',children:null});
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'응답 미리보기를 불러오지 못했습니다.');
    rows.splice(1,1);owner.memoizedProps.threadId='another-thread';
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'응답 미리보기를 불러오지 못했습니다.');
    stop();assert.equal(root.querySelector('[data-bb-chat-ui-toc-reply]'),null);
  }finally{stop();f.cleanup();}
});
