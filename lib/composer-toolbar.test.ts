import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectComposerToolbar} from './composer-toolbar.ts';

const TOOLBAR='<div data-promptbox-expanded-only data-promptbox-standard-actions class="flex"><button id="plus" type="button" aria-label="Prompt actions">+</button><button type="button" aria-label="Provider, model and reasoning">Model</button></div>';
function fixture(reduced=false,phone=false,initialCompact=false){
 const dom=new JSDOM(`<html${phone?' data-bb-chat-ui-root-device="phone"':''}><style>[data-follow-up-composer]:not([data-follow-up-composer-expanded]) [data-promptbox-expanded-only]{display:none!important}</style><div data-follow-up-composer ${initialCompact?'':'data-follow-up-composer-expanded'}><form data-promptbox ${initialCompact?'data-promptbox-compact':''}>${phone?'<div data-test-native-clip style="overflow:hidden">':''}<div data-promptbox-editor-content><p>Draft</p></div><div data-promptbox-action-row>${initialCompact?'':TOOLBAR}<button type="button" aria-label="Send">Send</button></div>${phone?'</div>':''}</form></div>`,{pretendToBeVisual:true});
 const d=dom.window.document,c=d.querySelector('form')!,row=c.querySelector('[data-promptbox-action-row]')!,parent=c.parentElement!;
 const motions:{node:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancelled:boolean;animation:Animation}[]=[];
 const media=new dom.window.EventTarget() as unknown as MediaQueryList;Object.defineProperty(media,'matches',{get:()=>reduced});dom.window.matchMedia=()=>media;
 let now=110;Object.defineProperty(dom.window.performance,'now',{value:()=>now});
 dom.window.HTMLElement.prototype.animate=function(frames,options){
  const r={node:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancelled:false,animation:null as unknown as Animation};
  r.animation={currentTime:0,effect:{getComputedTiming:()=>({progress:.5})},onfinish:null,oncancel:null,cancel(){r.cancelled=true;}}as unknown as Animation;motions.push(r);return r.animation;
 };
 let reads=0;const computed=dom.window.getComputedStyle.bind(dom.window);
 dom.window.getComputedStyle=(node,pseudo)=>{reads++;return computed(node,pseudo);};
 for(const node of [c,row])node.getBoundingClientRect=()=>{reads++;return{}as DOMRect;};
 const stop=injectComposerToolbar(c,{durationMs:360,startedAt:()=>100});
 const flush=async()=>{await Promise.resolve();await Promise.resolve();};
 const remove=()=>{c.setAttribute('data-promptbox-compact','');row.querySelector('[data-promptbox-expanded-only]')!.remove();};
 const add=()=>{parent.setAttribute('data-follow-up-composer-expanded','');c.removeAttribute('data-promptbox-compact');row.insertAdjacentHTML('afterbegin',TOOLBAR);};
 return{dom,d,c,row,parent,motions,stop,flush,remove,add,setNow:(value:number)=>{now=value},reads:()=>reads,reduced:()=>{reduced=true;media.dispatchEvent(new dom.window.Event('change'));}};
}

test('native unmount retains one inert exit visual for the height motion without restoring live controls',async()=>{
 const f=fixture();try{
  assert.equal(f.motions.length,0,'initial mounting does not replay an entrance');
  f.remove();await f.flush();const ghost=f.c.querySelector<HTMLElement>('[data-bb-chat-ui-toolbar-ghost]');
  assert.ok(ghost,'React removal must retain the outgoing buttons visually');
  assert.equal(ghost.getAttribute('aria-hidden'),'true');assert.ok(ghost.hasAttribute('inert'));
  assert.equal(ghost.querySelector('[id]'),null);assert.equal(ghost.hasAttribute('data-promptbox-expanded-only'),false);
  assert.equal(ghost.style.getPropertyValue('display'),'flex');assert.equal(ghost.style.getPropertyPriority('display'),'important');
  assert.equal(ghost.style.pointerEvents,'none');assert.equal(f.row.querySelector('[aria-label="Prompt actions"]'),null,'native unmount remains intact');
  const m=f.motions.at(-1)!;assert.equal(m.node,ghost);assert.equal(m.options.duration,360);assert.equal(m.options.easing,'cubic-bezier(.22,1,.36,1)');
  assert.equal(m.animation.currentTime,10,'toolbar starts on the existing height clock');assert.equal(m.frames[0].opacity,1);assert.equal(m.frames.at(-1)!.opacity,0);
  assert.ok(m.frames.every(k=>Object.keys(k).every(key=>['opacity','transform'].includes(key))),'only opacity and transform animate');
  m.animation.onfinish?.(new f.dom.window.Event('finish')as unknown as AnimationPlaybackEvent);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);
 }finally{f.stop();f.dom.window.close();}
});

test('entrance keeps native buttons and callbacks, reversals cancel stale ghosts, and typing does not measure',async()=>{
 const f=fixture();try{
  f.remove();await f.flush();const exit=f.motions.at(-1)!;f.add();await f.flush();
  assert.equal(exit.cancelled,true);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);
  const actual=f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!,entry=f.motions.at(-1)!;assert.equal(entry.node,actual);
  assert.equal(entry.frames[0].opacity,.5,'rapid reversal continues from the outgoing visual');assert.equal(entry.frames.at(-1)!.opacity,1);
  let clicks=0;actual.querySelector('button')!.addEventListener('click',()=>clicks++);actual.querySelector('button')!.click();assert.equal(clicks,1);
  const before=f.motions.length,reads=f.reads();f.c.querySelector('p')!.textContent='new draft';f.c.style.setProperty('--draft-height','124px');await f.flush();assert.equal(f.motions.length,before);assert.equal(f.reads(),reads);
  f.stop();assert.equal(entry.cancelled,true);assert.equal(actual.getAttribute('style'),null,'unload does not overwrite native inline styles');
 }finally{f.stop();f.dom.window.close();}
});

test('CSS-only compact hiding can exit despite an important display rule',async()=>{
 const f=fixture();try{f.parent.removeAttribute('data-follow-up-composer-expanded');await f.flush();assert.ok(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'));f.parent.setAttribute('data-follow-up-composer-expanded','');await f.flush();assert.equal(f.motions.at(-1)!.frames.at(-1)!.opacity,1);}finally{f.stop();f.dom.window.close();}
});

test('reduced motion and disposal immediately remove transient visuals',async()=>{
 const f=fixture();try{f.remove();await f.flush();f.reduced();assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);f.add();await f.flush();const count=f.motions.length;f.remove();await f.flush();assert.equal(f.motions.length,count);}finally{f.stop();f.dom.window.close();}
 const reduced=fixture(true);try{reduced.remove();await reduced.flush();assert.equal(reduced.motions.length,0);}finally{reduced.stop();reduced.dom.window.close();}
});

const finish=(f:ReturnType<typeof fixture>,index=f.motions.length-1)=>f.motions[index].animation.onfinish?.(new f.dom.window.Event('finish')as unknown as AnimationPlaybackEvent);

test('phone entrance uses a bottom-pinned visual outside the clipped native grid until height and fade finish',async()=>{
 const f=fixture(false,true);try{
 f.remove();await f.flush();finish(f);f.add();const native=f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!;native.style.setProperty('visibility','visible','important');let clicks=0;native.querySelector('button')!.addEventListener('click',()=>clicks++);await f.flush();
 const entry=f.motions.at(-1)!,proxy=f.c.querySelector<HTMLElement>('[data-bb-chat-ui-toolbar-ghost]');assert.ok(proxy,'a mounted row below the native clip must be visible through a separate visual');assert.equal(proxy.parentElement,f.c);assert.equal(proxy.closest('[data-test-native-clip]'),null);assert.equal(proxy.style.position,'absolute');assert.equal(proxy.style.bottom,'0.5rem');assert.equal(proxy.hasAttribute('inert'),true);assert.equal(proxy.getAttribute('aria-hidden'),'true');assert.equal(proxy.querySelector('[id]'),null);
 assert.equal(entry.node,proxy);assert.equal(entry.frames[0].opacity,0);assert.equal(entry.frames.at(-1)!.opacity,1);assert.equal(entry.options.duration,360);assert.equal(entry.animation.currentTime,10);assert.equal(native.style.visibility,'hidden');assert.equal(native.style.getPropertyPriority('visibility'),'important');
 finish(f);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);assert.equal(native.style.visibility,'visible');assert.equal(native.style.getPropertyPriority('visibility'),'important');native.querySelector('button')!.click();assert.equal(clicks,1,'the host row, identity and handlers survive the handover');
 }finally{f.stop();f.dom.window.close()}
});

test('phone opens from its last native visual before a delayed row mount without restarting after viewport resize',async()=>{
 const f=fixture(false,true);try{
 f.remove();await f.flush();finish(f);f.c.removeAttribute('data-promptbox-compact');f.parent.setAttribute('data-follow-up-composer-expanded','');await f.flush();const proxy=f.c.querySelector<HTMLElement>('[data-bb-chat-ui-toolbar-ghost]');assert.ok(proxy,'intent to expand must not wait for React to mount the buttons');const entry=f.motions.at(-1)!,count=f.motions.length;entry.animation.currentTime=160;f.setNow(260);
 const vv=new f.dom.window.EventTarget();Object.defineProperty(f.dom.window,'visualViewport',{value:vv});vv.dispatchEvent(new f.dom.window.Event('resize'));f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));
 f.row.insertAdjacentHTML('afterbegin',TOOLBAR.replace('>Model<','>New model<'));await f.flush();assert.equal(f.motions.length,count,'viewport/row arrival cannot begin a second fade');assert.equal(f.motions.at(-1)!.animation,entry.animation);assert.equal(entry.animation.currentTime,160);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),proxy);assert.match(proxy.textContent!,/New model/);const native=f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!;assert.equal(native.style.visibility,'hidden');
 const reads=f.reads();f.c.querySelector('p')!.textContent='typing';f.c.style.setProperty('--draft-height','180px');await f.flush();assert.equal(f.reads(),reads,'typing adds no layout/style measurement');finish(f);assert.equal(native.style.visibility,'');assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);
 }finally{f.stop();f.dom.window.close()}
});

test('phone retains a completed entry visual until late native content arrives, including its first uncached opening',async()=>{
 const f=fixture(false,true);try{f.remove();await f.flush();finish(f);f.c.removeAttribute('data-promptbox-compact');await f.flush();const proxy=f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]');assert.ok(proxy);finish(f);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),proxy,'do not flash an empty row at the end of the height clock');const count=f.motions.length;f.add();await f.flush();assert.equal(f.motions.length,count);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);assert.equal(f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!.style.visibility,'');}finally{f.stop();f.dom.window.close()}
 const first=fixture(false,true,true);try{first.add();await first.flush();assert.ok(first.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),'the first mounted row also bypasses the native clip');finish(first);assert.equal(first.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);}finally{first.stop();first.dom.window.close()}
});

test('phone entry restores hidden native styles on reduced motion, voice and disposal',async()=>{
 for(const reason of ['reduced','voice','stop']){const f=fixture(false,true,true);try{f.add();await f.flush();const native=f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!;assert.equal(native.style.visibility,'hidden');if(reason==='reduced')f.reduced();else if(reason==='voice'){f.c.setAttribute('data-promptbox-voice-active','');await f.flush();}else f.stop();assert.equal(native.getAttribute('style'),null);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);}finally{f.stop();f.dom.window.close()}}
 const reduced=fixture(true,true,true);try{reduced.add();await reduced.flush();assert.equal(reduced.motions.length,0);assert.equal(reduced.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);}finally{reduced.stop();reduced.dom.window.close()}
});

test('phone reverses an unfinished entry into an exit and back without leaking hidden native controls',async()=>{
 const f=fixture(false,true,true);try{f.add();await f.flush();const entry=f.motions.at(-1)!;const old=f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!;f.remove();await f.flush();assert.equal(entry.cancelled,true);assert.equal(old.style.visibility,'');const exit=f.motions.at(-1)!;assert.equal(exit.frames[0].opacity,.5);f.add();await f.flush();assert.equal(exit.cancelled,true);assert.equal(f.c.querySelectorAll('[data-bb-chat-ui-toolbar-ghost]').length,1);finish(f);assert.equal(f.c.querySelector('[data-bb-chat-ui-toolbar-ghost]'),null);assert.equal(f.row.querySelector<HTMLElement>('[data-promptbox-expanded-only]')!.style.visibility,'');}finally{f.stop();f.dom.window.close()}
});

test('phone entry follows the rendered CSS height clock including a resumed negative delay',async()=>{
 const f=fixture(false,true,true);try{f.c.getAnimations=()=>[{transitionProperty:'height',currentTime:25,effect:{getTiming:()=>({delay:-80})}}as unknown as Animation];f.add();await f.flush();assert.equal(f.motions.at(-1)!.animation.currentTime,105,'wall-clock/layout delay must not run the phone visual ahead of height');}finally{f.stop();f.dom.window.close()}
});
