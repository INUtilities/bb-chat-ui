import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectComposerGlass } from './composer-glass.ts';

// Track composer observers and deferred work without browser timing assumptions.
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
  const sizes: {active:boolean; target:Element|null; fire:()=>void}[]=[];
  class SizeObserver {
    active=false; target:Element|null=null;
    callback:()=>void;
    // Retain the callback so each footer can be resized independently.
    constructor(callback:()=>void) {this.callback=callback;sizes.push(this);}
    // Deliver one resize notification without changing other footers.
    fire() {this.callback();}
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

// Scope both mutation and resize geometry to their owning footer.
test('independent footers only measure dirty geometry and observe each resize',async()=>{
 const f=fixture(),first=f.add(),second=f.add(),reads=[0,0];
 for(const [index,item] of [first,second].entries()){
  const rect=item.composer.getBoundingClientRect.bind(item.composer);
  // Count the geometry work of each independent composer.
  item.composer.getBoundingClientRect=()=>{reads[index]++;return rect();};
 }
 const stop=injectComposerGlass(f.document);
 try{
  await f.tick();await f.paint();reads.fill(0);
  for(let i=0;i<4;i++){second.footer.querySelector('.grid')!.append(f.document.createElement('span'));await f.tick();}
  assert.deepEqual(reads,[0,0],'mutation delivery never measures layout');
  await f.paint();assert.equal(reads[0],0,'independent footer is not measured');assert.ok(reads[1]>0);
  const secondary=f.sizes.find(s=>s.active&&s.target===second.footer);
  assert.ok(secondary,'secondary footer has its own resize subscription');
  reads.fill(0);secondary.fire();await f.paint();assert.equal(reads[0],0);assert.ok(reads[1]>0);
  reads.fill(0);first.footer.querySelector('.grid')!.append(f.document.createElement('span'));second.footer.querySelector('.grid')!.append(f.document.createElement('span'));
  await f.tick();assert.equal(f.frames.size,1,'a multi-footer burst still shares one frame');await f.paint();assert.ok(reads.every(n=>n>0));
  second.scroller.remove();await f.tick();assert.equal(secondary.active,false,'detached footer releases resize subscription');
  f.document.body.append(second.scroller);await f.tick();await f.paint();assert.ok(f.sizes.some(s=>s.active&&s.target===second.footer),'reattachment creates a live resize subscription');
 }finally{stop();assert.equal(f.sizes.some(s=>s.active),false);f.cleanup();}
});

// Discover nested composers once per delivery instead of scanning every new message row.
test('timeline batches avoid per-row composer subtree scans and still bind inline composers',async()=>{
 const f=fixture();f.add();const stop=injectComposerGlass(f.document);
 const timeline=f.document.createElement('div');timeline.setAttribute('data-timeline-items','');f.document.body.append(timeline);await f.tick();
 const prototype=f.dom.window.Element.prototype,query=prototype.querySelectorAll;let rowScans=0;
 // Count only discovery work inside transcript rows.
 prototype.querySelectorAll=function(selector:string){if(this.hasAttribute('data-perf-row')&&selector.includes('data-scroll-footer'))rowScans++;return query.call(this,selector);};
 try{
  const rows=Array.from({length:80},()=>{const row=f.document.createElement('div');row.setAttribute('data-perf-row','');row.innerHTML='<span>Message</span>';return row;});
  timeline.append(...rows);await f.tick();assert.equal(rowScans,0,'ordinary rows are not individually searched for composers');
  const inline=f.add();rows[0].append(inline.scroller);await f.tick();
  inline.composer.setAttribute('data-promptbox-compact','');await f.tick();assert.equal(inline.composer.style.borderRadius,'25px','inline composers still bind before RAF');
 }finally{prototype.querySelectorAll=query;stop();f.cleanup();}
});

// Rebind footer observation when React replaces its stack without replacing the composer.
test('a replaced grid is observed again and classifies its new controls',async()=>{
 const f=fixture(),first=f.add(),stop=injectComposerGlass(f.document);
 try{
  await f.tick();await f.paint();
  const old=first.footer.querySelector('.grid')!,stack=f.document.createElement('div');stack.className='grid';
  old.replaceWith(stack);await f.tick();await f.paint();
  assert.equal(f.watchers(first.footer),1,'stack replacement restores the footer observer');
  stack.innerHTML='<section><button id="thread-prompt-banner-git-toggle">Diff</button></section>';await f.tick();await f.paint();
  assert.ok(stack.querySelector('section')!.hasAttribute('data-bb-chat-ui-diff-section'));
 }finally{stop();f.cleanup();}
});

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
    assert.equal(first.composer.style.borderRadius,'25px','the live composer keeps its corner motion');
  } finally {stop();f.cleanup();}
});

test('detaching an animating composer cancels its frame, timer, and corner listener', async () => {
  const f=fixture();const {scroller,composer}=f.add();
  const listeners=new Set<EventListenerOrEventListenerObject>();
  const add=composer.addEventListener.bind(composer);const remove=composer.removeEventListener.bind(composer);
  composer.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='transitionend')listeners.add(listener);add(type,listener,options);}) as typeof composer.addEventListener;
  composer.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='transitionend')listeners.delete(listener);remove(type,listener,options);}) as typeof composer.removeEventListener;
  const stop=injectComposerGlass(f.document);
  try {
    composer.style.transition='height 240ms linear';composer.style.height='40px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(f.frames.size,1);assert.equal(listeners.size,1);
    composer.style.height='';await f.tick();assert.equal(f.timers.size,1);
    scroller.remove();await f.tick();
    assert.equal(f.frames.size,0,'pin RAF is cancelled');assert.equal(f.timers.size,0,'height finish timer is cancelled');
    assert.equal(listeners.size,0,'corner listener is removed even if animationend never fires');
    assert.equal(composer.style.height,'','a cancelled finish timer cannot leave an inline height on reattachment');
    assert.equal(composer.style.borderRadius,'','a detached corner transition is cleared before reattachment');
    composer.removeAttribute('data-promptbox-compact');await f.tick();
    assert.equal(composer.style.borderRadius,'','a detached composer cannot restart plugin motion');
    f.document.body.append(scroller);await f.tick();await f.paint();assert.equal(f.watchers(composer),1);
    composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(composer.style.borderRadius,'25px','reattached DOM starts new corner motion normally');
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

test('footer markers follow compact state, image descendants and Diff section changes', async () => {
  const f=fixture(),first=f.add();
  first.composer.innerHTML='<button data-action></button>';
  const stop=injectComposerGlass(f.document);
  try {
    const action=first.composer.querySelector('button')!;
    const stack=first.footer.querySelector('.grid')!;
    first.composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.ok(first.footer.hasAttribute('data-bb-chat-ui-compact-footer'),'compact layout is marked before a measurement frame');
    first.composer.removeAttribute('data-promptbox-compact');await f.tick();
    assert.equal(first.footer.hasAttribute('data-bb-chat-ui-compact-footer'),false);
    action.innerHTML='<img alt="provider">';
    stack.insertAdjacentHTML('beforeend','<section data-diff><button id="thread-prompt-banner-git-toggle"></button></section>');
    await f.tick();await f.paint();
    assert.ok(action.hasAttribute('data-bb-chat-ui-has-image'));
    assert.ok(stack.querySelector('[data-diff]')!.hasAttribute('data-bb-chat-ui-diff-section'));
    action.replaceChildren();stack.querySelector('[data-diff] button')!.remove();await f.tick();await f.paint();
    assert.equal(action.hasAttribute('data-bb-chat-ui-has-image'),false);
    assert.equal(stack.querySelector('[data-diff]')!.hasAttribute('data-bb-chat-ui-diff-section'),false);
    first.composer.setAttribute('data-promptbox-compact','');action.innerHTML='<img alt="provider">';await f.tick();await f.paint();
    const column=first.footer.querySelector('.chat-prompt-box')!;column.remove();await f.tick();
    assert.equal(first.footer.hasAttribute('data-bb-chat-ui-compact-footer'),false,'connected empty footers release all markers');
    assert.equal(action.hasAttribute('data-bb-chat-ui-has-image'),false,'removed descendants release markers too');
    first.footer.querySelector('.relative')!.append(column);await f.tick();await f.paint();
    assert.ok(first.footer.hasAttribute('data-bb-chat-ui-compact-footer'));
    assert.ok(action.hasAttribute('data-bb-chat-ui-has-image'));
    stop();assert.equal(f.document.querySelector('[data-bb-chat-ui-compact-footer], [data-bb-chat-ui-has-image], [data-bb-chat-ui-diff-section]'),null);
  } finally {stop();f.cleanup();}
});

test('new composers bind radius motion before the deferred layout frame',async()=>{
  const f=fixture();f.add();const stop=injectComposerGlass(f.document);
  try {
    const second=f.add();await f.tick();
    second.composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(second.composer.style.borderRadius,'25px');
  } finally {stop();f.cleanup();}
});

test('moving marked buttons and Diff sections between footers preserves their current owner',async()=>{
 const f=fixture(),first=f.add(),second=f.add();
 second.composer.innerHTML='<button><img alt="provider"></button>';
 second.footer.querySelector('.grid')!.innerHTML='<section><button id="thread-prompt-banner-git-toggle"></button></section>';
 const stop=injectComposerGlass(f.document);
 try {
  const button=second.composer.querySelector('button')!,section=second.footer.querySelector('.grid section')!;
  for(const target of [first,second]){
   target.composer.append(button);target.footer.querySelector('.grid')!.append(section);await f.tick();await f.paint();
   assert.ok(button.hasAttribute('data-bb-chat-ui-has-image'),'image marker survives movement in both directions');
   assert.ok(section.hasAttribute('data-bb-chat-ui-diff-section'),'Diff marker survives movement in both directions');
  }
  first.footer.querySelector('.relative')!.append(button,section);await f.tick();await f.paint();
  assert.equal(button.hasAttribute('data-bb-chat-ui-has-image'),false,'buttons outside the input are no longer marked');
  assert.equal(section.hasAttribute('data-bb-chat-ui-diff-section'),false,'sections outside the stack are no longer marked');
 }finally{stop();f.cleanup();}
});

for (const hit of ['small','large']) test(`native height cleanup keeps radius on the same timeline (${hit})`,async()=>{
  const f=fixture(),{composer}=f.add();f.document.querySelector('span')!.setAttribute('data-bb-chat-ui-hit-target',hit);
  const stop=injectComposerGlass(f.document);
  try {
    composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='50px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(composer.style.borderRadius,'25px');
    assert.match(composer.style.transition,/height 360ms.*border-radius 360ms/);
    composer.style.height='';composer.style.transition='';await f.tick();
    const transition=composer.style.transition;
    const delay=transition.match(/height 360ms cubic-bezier\(0.22, 1, 0.36, 1\) (-[\d.]+ms)/)![1];
    assert.ok(transition.includes(`border-radius 360ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}`));
    assert.equal(composer.style.borderRadius,'25px');
    stop();assert.equal(composer.style.borderRadius,'');assert.equal(f.timers.size,0);
  } finally {stop();f.cleanup();}
});

test('reduced motion never adds a height or corner transition over native inline sizing',async()=>{
  const f=fixture(),{composer}=f.add();f.dom.window.matchMedia=()=>({matches:true} as MediaQueryList);
  const stop=injectComposerGlass(f.document);
  try {
    composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='50px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    assert.equal(composer.style.height,'');assert.equal(composer.style.transition,'none');
    assert.equal(composer.style.borderRadius,'');assert.equal(f.timers.size,0);
  } finally {stop();f.cleanup();}
});

for(const cleanupAt of [240,500]) test(`the next expansion starts at the settled compact height after native cleanup at ${cleanupAt}ms`,async()=>{
  const f=fixture(),{composer}=f.add(),stop=injectComposerGlass(f.document);
  const measured:string[]=[];let height=100,now=0;Object.defineProperty(f.dom.window.performance,'now',{value:()=>now});
  composer.getBoundingClientRect=()=>{measured.push(composer.style.height);return {height,top:0,bottom:height,width:300,left:0,right:300,x:0,y:0,toJSON(){}};};
  try {
    composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='50px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    now=cleanupAt;composer.style.height='';composer.style.transition='';height=50;await f.tick();
    for(const [id,run] of [...f.timers]){f.timers.delete(id);run();}await f.tick();
    measured.length=0;composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='100px';composer.removeAttribute('data-promptbox-compact');await f.tick();
    assert.ok(measured.includes('50px'),'expansion must not reuse the stale expanded height');
  } finally {stop();f.cleanup();}
});

test('a quick reversal samples the shared curve before native transition:none commits its old target',async()=>{
  const f=fixture(),{composer}=f.add(),stop=injectComposerGlass(f.document);
  let now=0;Object.defineProperty(f.dom.window.performance,'now',{value:()=>now});
  try {
    composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='50px';composer.setAttribute('data-promptbox-compact','');await f.tick();
    const starts:number[]=[];const rect=composer.getBoundingClientRect;
    composer.getBoundingClientRect=()=>{if(composer.style.transition==='none')starts.push(parseFloat(composer.style.borderRadius));return rect();};
    now=100;composer.style.transition='none';composer.style.height='65px';composer.removeAttribute('data-promptbox-compact');composer.style.transition='height 240ms cubic-bezier(0.22, 1, 0.36, 1)';composer.style.height='100px';await f.tick();
    assert.ok(starts.some(radius=>radius>24&&radius<25),'use the intermediate corner, not the old 25px destination');
  } finally {stop();f.cleanup();}
});
