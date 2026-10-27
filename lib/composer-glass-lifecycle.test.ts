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

test('composer resize reads geometry before changing the inherited fade height',()=>{
 const f=fixture(),item=f.add();
 const events:string[]=[];
 const plate=item.footer.querySelector<HTMLElement>(':scope > .relative')!;
 const fade=f.document.createElement('div');fade.setAttribute('data-overflow-fade','above');plate.append(fade);
 const stack=item.footer.querySelector<HTMLElement>('.grid')!;
 stack.setAttribute('data-bb-chat-ui-info-stack','');
 for(const node of [plate,stack,item.composer,item.footer.querySelector<HTMLElement>('.chat-prompt-box')!]){
  const read=node.getBoundingClientRect.bind(node);
  node.getBoundingClientRect=()=>{events.push('read');return read();};
 }
 const set=fade.style.setProperty.bind(fade.style);
 fade.style.setProperty=(key,value,priority)=>{if(key==='--bb-chat-ui-fade-height')events.push('fade');set(key,value,priority);};
 // Keep a valid fade target, independent of jsdom's absent layout.
 plate.getBoundingClientRect=()=>{events.push('read');return {bottom:100} as DOMRect;};
 const stop=injectComposerGlass(f.document);
 try{assert.equal(plate.style.getPropertyValue('--bb-chat-ui-fade-height'),'','the fade variable must not invalidate the entire composer subtree');assert.ok(events.includes('fade'));assert.ok(events.lastIndexOf('read')<events.indexOf('fade'),'fade writes must not force the following control/composer reads to recalculate style');}
 finally{stop();f.cleanup();}
});


test('video previews keep the same native attachment corners as images across replacement and cleanup',async()=>{
 const f=fixture(),first=f.add();first.composer.innerHTML='<button data-media><video></video></button><button data-remove aria-label="Remove video"></button><button data-file>note.txt</button>';
 const stop=injectComposerGlass(f.document);try{
  await f.tick();await f.paint();const media=first.composer.querySelector('[data-media]')!;
  assert.ok(media.hasAttribute('data-bb-chat-ui-has-image'),'video preview escapes the circular action button rule');
  assert.equal(first.composer.querySelector('[data-remove]')!.hasAttribute('data-bb-chat-ui-has-image'),false);
  assert.equal(first.composer.querySelector('[data-file]')!.hasAttribute('data-bb-chat-ui-has-image'),false,'ordinary file style is preserved');
  media.innerHTML='<img alt="preview">';await f.tick();await f.paint();assert.ok(media.hasAttribute('data-bb-chat-ui-has-image'));
  media.replaceChildren();await f.tick();await f.paint();assert.equal(media.hasAttribute('data-bb-chat-ui-has-image'),false);
  media.innerHTML='<video></video>';await f.tick();await f.paint();assert.ok(media.hasAttribute('data-bb-chat-ui-has-image'));
  stop();assert.equal(media.hasAttribute('data-bb-chat-ui-has-image'),false);
 }finally{stop();f.cleanup()}
});

test('phone opens at native final layout without pinning its former height or installing a comparison switch',async()=>{
 const f=fixture(),{composer}=f.add();f.document.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');composer.setAttribute('data-promptbox-compact','');let height=50;composer.getBoundingClientRect=()=>({height,top:500-height,bottom:500,width:300,left:0,right:300,x:0,y:500-height,toJSON(){}});const stop=injectComposerGlass(f.document);
 try{await f.tick();await f.paint();height=124;composer.removeAttribute('data-promptbox-compact');composer.style.transition='height 240ms ease-out';composer.style.height='124px';await f.tick();assert.equal(composer.style.height,'','phone expansion must not pin the native final layout');assert.doesNotMatch(composer.style.transition,/height 360ms/);assert.equal(f.document.querySelector('[data-bb-chat-ui-expand-switch],[data-bb-chat-ui-expand-experiment]'),null);assert.ok(composer.hasAttribute('data-bb-chat-ui-phone-expand'));}finally{stop();f.cleanup()}
});
