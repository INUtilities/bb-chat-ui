import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectComposerGlass } from './composer-glass.ts';

function fixture() {
  const dom = new JSDOM('<body><span data-bb-chat-ui-device="desktop" data-bb-chat-ui-hit-target="small"></span></body>', {pretendToBeVisual:true});
  const {document} = dom.window;
  dom.window.matchMedia = () => ({matches:false} as MediaQueryList);
  const previous = new Map(['HTMLElement','MutationObserver','ResizeObserver'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const mutations: TrackedMutation[] = [];
  class TrackedMutation extends dom.window.MutationObserver {
    target: Node | null = null; active = false;
    constructor(callback: MutationCallback) { super(callback); mutations.push(this); }
    observe(target:Node, options?:MutationObserverInit) {this.target=target;this.active=true;super.observe(target,options);}
    disconnect() {this.active=false;super.disconnect();}
  }
  const sizes: {active:boolean; target:Element|null}[]=[];
  class SizeObserver {
    active=false; target:Element|null=null;
    constructor() {sizes.push(this);}
    observe(target:Element) {this.target=target;this.active=true;}
    disconnect() {this.active=false;}
  }
  Object.assign(globalThis,{HTMLElement:dom.window.HTMLElement,MutationObserver:TrackedMutation,ResizeObserver:SizeObserver});
  const frames = new Map<number,FrameRequestCallback>(); const timers = new Map<number,()=>void>(); let serial=0;
  dom.window.requestAnimationFrame = callback => {const id=++serial;frames.set(id,callback);return id;};
  dom.window.cancelAnimationFrame = id => {frames.delete(id);};
  dom.window.setTimeout = ((callback:()=>void) => {const id=++serial;timers.set(id,callback);return id;}) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = id => {timers.delete(id);};
  const add = () => {
    const scroller=document.createElement('div'); scroller.className='thread-scrollbar';
    scroller.innerHTML='<div><div data-scroll-footer><div class="relative"><div class="chat-prompt-box"><div data-promptbox-shell><div class="grid"></div><div data-promptbox></div></div></div></div></div></div>';
    document.body.append(scroller);
    const composer=scroller.querySelector<HTMLElement>('[data-promptbox]')!;
    composer.getBoundingClientRect=()=>({height:100,top:0,bottom:100,width:300,left:0,right:300,x:0,y:0,toJSON(){}});
    return {scroller,composer,footer:scroller.querySelector<HTMLElement>('[data-scroll-footer]')!};
  };
  const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
  const paint=async()=>{for(const[id,run]of [...frames]){frames.delete(id);run(0);}await tick();};
  const watchers=(target:Node)=>mutations.filter(m=>m.target===target&&m.active).length;
  return {dom,document,add,tick,paint,watchers,mutations,sizes,frames,timers,cleanup() {
    for(const [key,descriptor] of previous) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
    dom.window.close();
  }};
}

test('removing the last footer disconnects composer, stack, and resize observers before plugin unload', async () => {
  const f=fixture();const first=f.add();const stop=injectComposerGlass(f.document);
  try {
    await f.tick();assert.equal(f.watchers(first.composer),1);
    first.scroller.remove();await f.tick();
    assert.equal(f.watchers(first.composer),0,'detached composer is released during SPA navigation');
    assert.equal(f.watchers(first.footer),0,'the old stack observer cannot retain an empty-page footer');
    assert.equal(f.sizes.filter(s=>s.active).length,0,'the old resize observer is disconnected during the empty gap');
    first.scroller.remove();await f.tick();
    f.document.body.append(first.scroller);await f.tick();await f.paint();
    assert.equal(f.watchers(first.composer),1,'the same DOM can bind again after it is reattached');
    stop();assert.equal(f.watchers(first.composer),0);
  } finally {stop();f.cleanup();}
});

test('a detached secondary composer is released while the first footer stays connected', async () => {
  const f=fixture();const first=f.add();const second=f.add();const stop=injectComposerGlass(f.document);
  try {
    await f.tick();assert.equal(f.watchers(first.composer),1);assert.equal(f.watchers(second.composer),1);
    second.scroller.remove();await f.tick();
    assert.equal(f.watchers(second.composer),0,'the connected primary footer must not suppress cleanup');
    assert.equal(f.watchers(first.composer),1,'the remaining composer keeps its own observer');
    f.document.body.append(second.scroller);await f.tick();await f.paint();
    assert.equal(f.watchers(second.composer),1,'a secondary composer can reattach without moving the primary footer');
    first.composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.match(first.composer.style.animation,/bb-chat-ui-composer-radius/,'the live composer keeps its motion');
  } finally {stop();f.cleanup();}
});

test('detaching an animating composer cancels its frame, timer, and radius listener', async () => {
  const f=fixture();const {scroller,composer}=f.add();
  const listeners=new Set<EventListenerOrEventListenerObject>();
  const add=composer.addEventListener.bind(composer);const remove=composer.removeEventListener.bind(composer);
  composer.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='animationend')listeners.add(listener);add(type,listener,options);}) as typeof composer.addEventListener;
  composer.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='animationend')listeners.delete(listener);remove(type,listener,options);}) as typeof composer.removeEventListener;
  const stop=injectComposerGlass(f.document);
  try {
    composer.style.transition='height 240ms linear';composer.style.height='40px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(f.frames.size,1);assert.equal(listeners.size,1);
    composer.style.height='';await f.tick();assert.equal(f.timers.size,1);
    scroller.remove();await f.tick();
    assert.equal(f.frames.size,0,'pin RAF is cancelled');assert.equal(f.timers.size,0,'height finish timer is cancelled');
    assert.equal(listeners.size,0,'radius listener is removed even if animationend never fires');
    assert.equal(composer.style.height,'','a cancelled finish timer cannot leave an inline height on reattachment');
    assert.equal(composer.style.animation,'','a detached radius animation is cleared before reattachment');
    composer.style.animation='';composer.removeAttribute('data-promptbox-compact');await f.tick();
    assert.equal(composer.style.animation,'','a detached composer cannot restart plugin motion');
    f.document.body.append(scroller);await f.tick();await f.paint();assert.equal(f.watchers(composer),1);
    composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.match(composer.style.animation,/bb-chat-ui-composer-radius/,'reattached DOM starts new motion normally');
  } finally {stop();f.cleanup();}
});

test('glass measurements coalesce until a frame and cancel on unload',async()=>{
 const f=fixture(),first=f.add();let reads=0;
 const rect=first.composer.getBoundingClientRect.bind(first.composer);
 first.composer.getBoundingClientRect=()=>{reads++;return rect();};
 const stop=injectComposerGlass(f.document);
 try{
  await f.tick();reads=0;
  for(let i=0;i<4;i++){first.footer.querySelector('.grid')!.append(f.document.createElement('span'));await f.tick();}
  assert.equal(reads,0,'mutation callbacks do not force layout');
  assert.equal(f.frames.size,1,'one pending measurement frame per burst');
  const [id,run]=[...f.frames.entries()][0];f.frames.delete(id);run(0);
  assert.ok(reads>0);
  first.footer.querySelector('.grid')!.append(f.document.createElement('span'));await f.tick();
  stop();assert.equal(f.frames.size,0,'unload cancels deferred work');
 }finally{stop();f.cleanup();}
});

test('every composer gets glass and Agentation positioning markers',()=>{
 const f=fixture(),first=f.add(),second=f.add();
 for(const item of [first,second])item.footer.querySelector('.grid')!.innerHTML='<div><section class="agentation-staging-shell"></section></div>';
 const stop=injectComposerGlass(f.document);
 try{
  for(const item of [first,second]){
   assert.ok(item.footer.hasAttribute('data-bb-chat-ui-glass'));
   assert.ok(item.footer.querySelector('.agentation-staging-shell')!.parentElement!.hasAttribute('data-bb-chat-ui-agentation-slot'));
  }
  stop();assert.equal(f.document.querySelector('[data-bb-chat-ui-glass], [data-bb-chat-ui-agentation-slot]'),null);
 }finally{stop();f.cleanup();}
});

test('secondary composer staging markers follow late insertion, class changes and removal',async()=>{
 const f=fixture(),first=f.add(),second=f.add(),stop=injectComposerGlass(f.document);
 try{
  const slot=f.document.createElement('div'),staging=f.document.createElement('section');slot.append(staging);
  second.footer.querySelector('.grid')!.append(slot);staging.className='agentation-staging-shell';
  await f.tick();await f.paint();
  assert.ok(slot.hasAttribute('data-bb-chat-ui-agentation-slot'),'secondary staging is marked after a late insertion');
  staging.className='';await f.tick();await f.paint();
  assert.equal(slot.hasAttribute('data-bb-chat-ui-agentation-slot'),false);
  staging.className='agentation-staging-shell';await f.tick();await f.paint();
  assert.ok(slot.hasAttribute('data-bb-chat-ui-agentation-slot'));
  second.scroller.remove();await f.tick();
  assert.equal(f.watchers(second.footer),0,'secondary footer observers disconnect on removal');
  assert.equal(f.watchers(first.footer),1,'the primary remains observed');
 }finally{stop();f.cleanup();}
});

test('a late request-only footer is discovered without an input form',async()=>{
 const f=fixture();f.add();const stop=injectComposerGlass(f.document);
 try{
  const second=f.add();second.composer.remove();
  await f.tick();await f.paint();
  assert.ok(second.footer.hasAttribute('data-bb-chat-ui-glass'));
  assert.equal(f.watchers(second.footer),1);
 }finally{stop();f.cleanup();}
});

test('an empty connected footer loses glass markers and observers until its composer returns',async()=>{
 const f=fixture(),first=f.add(),stop=injectComposerGlass(f.document);
 try{
  const column=first.footer.querySelector('.chat-prompt-box')!;column.remove();await f.tick();
  assert.ok(first.footer.isConnected);
  assert.equal(first.footer.hasAttribute('data-bb-chat-ui-glass'),false);
  assert.equal(f.watchers(first.footer),0);
  assert.equal(f.sizes.filter(s=>s.active).length,0);
  assert.equal(f.frames.size,0);
  first.footer.querySelector('.relative')!.append(column);await f.tick();await f.paint();
  assert.ok(first.footer.hasAttribute('data-bb-chat-ui-glass'));
  assert.equal(f.watchers(first.footer),1);
 }finally{stop();f.cleanup();}
});
