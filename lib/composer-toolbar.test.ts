import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectComposerToolbar} from './composer-toolbar.ts';

const TOOLBAR='<div data-promptbox-expanded-only data-promptbox-standard-actions class="flex"><button id="plus" type="button" aria-label="Prompt actions">+</button><button type="button" aria-label="Provider, model and reasoning">Model</button></div>';
function fixture(reduced=false){
 const dom=new JSDOM(`<style>[data-follow-up-composer]:not([data-follow-up-composer-expanded]) [data-promptbox-expanded-only]{display:none!important}</style><div data-follow-up-composer data-follow-up-composer-expanded><form data-promptbox><div data-promptbox-editor-content><p>Draft</p></div><div data-promptbox-action-row>${TOOLBAR}<button type="button" aria-label="Send">Send</button></div></form></div>`,{pretendToBeVisual:true});
 const d=dom.window.document,c=d.querySelector('form')!,row=c.querySelector('[data-promptbox-action-row]')!,parent=c.parentElement!;
 const motions:{node:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancelled:boolean;animation:Animation}[]=[];
 const media=new dom.window.EventTarget() as unknown as MediaQueryList;Object.defineProperty(media,'matches',{get:()=>reduced});dom.window.matchMedia=()=>media;
 Object.defineProperty(dom.window.performance,'now',{value:()=>110});
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
 const add=()=>{c.removeAttribute('data-promptbox-compact');row.insertAdjacentHTML('afterbegin',TOOLBAR);};
 return{dom,d,c,row,parent,motions,stop,flush,remove,add,reads:()=>reads,reduced:()=>{reduced=true;media.dispatchEvent(new dom.window.Event('change'));}};
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
