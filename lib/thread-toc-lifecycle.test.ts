import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectThreadToc } from './thread-toc.ts';
import { registerTocOutlineReader } from './thread-toc-preview.ts';

// 관찰과 표시 프레임을 포함해 목차의 실제 수명 주기를 검증한다.
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
  return {document,dom,makeRoot,count:(node:Element)=>[...(active.get(node)?.values()??[])].reduce((n,listeners)=>n+listeners.size,0),tick:()=>new Promise<void>(resolve=>dom.window.requestAnimationFrame(()=>resolve())),cleanup(){
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
  const unregister=registerTocOutlineReader(f.document,async threadId=>{
    if(threadId!=='thread-test')throw Error('wrong thread');
    return {items: rows.map(row=>{
      if(row.kind!=='conversation'||row.threadId!==threadId)throw Error('unavailable outline');
      return {id:row.id as string,role:row.role as 'user'|'assistant',preview:(row.text??'') as string};
    })};
  });
  rail.setAttribute('aria-controls','thread-toc-panel-thread-test');
  try{
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'첫 번째 최종 응답');
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:20}));await f.tick();
    assert.equal(items[1].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'표시할 응답이 없습니다.');
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]'),null);
    // 다음 열기에서 자료가 없으면 이전 응답을 재사용하지 않는다.
    root.dispatchEvent(new f.dom.window.MouseEvent('mouseleave'));
    rows.splice(1,0,{kind:'turn',id:'unloaded',children:null});
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'응답 미리보기를 불러오지 못했습니다.');
    rows.splice(1,1);rail.setAttribute('aria-controls','thread-toc-panel-another-thread');
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));await f.tick();
    assert.equal(items[0].querySelector('[data-bb-chat-ui-toc-reply]')?.textContent,'응답 미리보기를 불러오지 못했습니다.');
    stop();assert.equal(root.querySelector('[data-bb-chat-ui-toc-reply]'),null);
  }finally{unregister();stop();f.cleanup();}
});

test('sampled TOC ticks use native IDs, including the retained active row, and ignore round sender icons',()=>{
  const f=fixture(),root=f.makeRoot(),rail=root.querySelector('button')!;
  const ids=['u0','u3','u4','u6','u8'];
  rail.innerHTML=ids.map(()=>'<span class="rounded-full"></span>').join('');
  root.insertAdjacentHTML('beforeend','<div id="thread-toc-panel-current"><ul>'+Array.from({length:9},(_,i)=>`<li><button><span>Question ${i}</span><span class="rounded-full">Sender</span></button></li>`).join('')+'</ul></div>');
  const items=[...root.querySelectorAll('li')],ticks=[...rail.querySelectorAll('span')];
  items.forEach((item,i)=>Object.assign(item,{'__reactFiber$test':{key:`u${i}`}}));
  ticks.forEach((tick,i)=>{
    Object.assign(tick,{'__reactFiber$test':{key:ids[i]}});
    tick.getBoundingClientRect=()=>({top:i*20,height:3}) as DOMRect;
  });
  const clicked:number[]=[];items.forEach((item,i)=>item.querySelector('button')!.addEventListener('click',()=>clicked.push(i)));
  const stop=injectThreadToc(f.document);
  try{
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:21}));
    assert.equal(items[3].hasAttribute('data-bb-chat-ui-toc-current'),true,'the retained active tick is not proportionally remapped');
    rail.dispatchEvent(new f.dom.window.MouseEvent('click',{clientY:81,detail:1}));
    assert.deepEqual(clicked,[8],'the final tick reaches the final user despite round icons inside the list');
    assert.equal(root.querySelector('li .rounded-full')!.hasAttribute('data-bb-chat-ui-toc-selected'),false);
    // A native tick can arrive before its matching row; never navigate to a different user.
    Object.assign(ticks[4],{'__reactFiber$test':{key:'pending-user'}});
    rail.dispatchEvent(new f.dom.window.MouseEvent('click',{clientY:81,detail:1}));
    assert.deepEqual(clicked,[8]);
  }finally{stop();f.cleanup();}
});

test('one pointer move reads tick geometry once before writing any widths',async()=>{
  const f=fixture(),root=f.makeRoot(),rail=root.querySelector('button')!;
  rail.innerHTML=Array.from({length:20},()=>'<span class="rounded-full"></span>').join('');
  const ticks=[...rail.querySelectorAll('span')];let reads=0,writes=0,readsAfterWrite=0;
  const width=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ticks[0].style),'width')!;
  ticks.forEach((tick,i)=>{
    tick.getBoundingClientRect=()=>{if(writes)readsAfterWrite++;reads++;return {top:i*7,height:3} as DOMRect;};
    Object.defineProperty(tick.style,'width',{configurable:true,get(){return width.get!.call(this);},set(value){writes++;width.set!.call(this,value);}});
  });
  const stop=injectThreadToc(f.document);
  try{
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:70}));
    assert.equal(reads,20);assert.equal(readsAfterWrite,0,'geometry must be read before the width update batch');assert.ok(writes>0);
    reads=0;writes=0;
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:70}));
    await f.tick();
    assert.equal(reads,20);assert.equal(writes,0,'unchanged widths should not be assigned again');
  }finally{stop();f.cleanup();}
});
