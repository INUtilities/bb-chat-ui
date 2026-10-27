import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectPhoneExpansionVisual} from './composer-expand-visual.ts';
function fixture(){
 const dom=new JSDOM('<html data-bb-chat-ui-root-device="phone"><body><div data-scroll-footer><div data-bb-chat-ui-info-bar></div><form data-promptbox><div data-promptbox-layout><button>Native</button></div></form></div></body></html>',{pretendToBeVisual:true});const w=dom.window,d=w.document,f=d.querySelector('form')!;let height=124,reads=0,now=0,reduced=false;const runs:any[]=[];
 w.matchMedia=()=>({get matches(){return reduced},addEventListener(){},removeEventListener(){}}as any);Object.defineProperty(w.performance,'now',{value:()=>now});
 f.getBoundingClientRect=()=>{reads++;return{top:500-height,bottom:500,height,width:300,left:0,right:300}as DOMRect};
 (w.HTMLElement.prototype as any).animate=function(frames:any,options:any){const a={node:this,frames,options,currentTime:0,onfinish:null,oncancel:null,cancelled:false,progress:0,effect:{getComputedTiming:()=>({progress:a.progress})},cancel(){a.cancelled=true}};runs.push(a);return a};
 return{dom,w,d,f,runs,setHeight:(n:number)=>height=n,setNow:(n:number)=>now=n,setReduced:()=>reduced=true,reads:()=>reads};
}
test('D changes only a separate face and content visuals, keeps native layout and compensates the pill row',()=>{
 const x=fixture(),native=x.f.querySelector('button'),ctl=injectPhoneExpansionVisual(x.f);try{
  ctl.expand(50);const face=x.f.querySelector('[data-bb-chat-ui-expand-face]');assert.ok(face,'a separate frost visual must exist');assert.equal(face.getAttribute('aria-hidden'),'true');assert.equal(x.f.style.height,'');assert.equal(x.f.querySelector('button'),native);
  const run=x.runs.find(a=>a.node===face);assert.match(run.frames[0].clipPath,/74px/);assert.equal(run.options.duration,360);
  assert.ok(x.runs.some(a=>a.node.hasAttribute('data-promptbox-layout')&&a.frames[0].opacity===0));
  assert.ok(x.runs.some(a=>a.node.hasAttribute('data-bb-chat-ui-info-bar')&&a.frames[0].transform==='translateY(74px)'));
  const count=x.reads();native!.textContent='Typing';assert.equal(x.reads(),count,'typing does not read geometry');
  ctl.cancel();assert.equal(x.f.querySelector('[data-bb-chat-ui-expand-face]'),null);assert.equal(x.f.hasAttribute('data-bb-chat-ui-expand-visual'),false);
 }finally{ctl.destroy();x.dom.window.close()}
});
test('D retargets from the current visible edge on the existing clock and cleans up reduced motion and disposal',()=>{
 const x=fixture(),ctl=injectPhoneExpansionVisual(x.f);try{
  ctl.expand(50);const face=x.f.querySelector('[data-bb-chat-ui-expand-face]')!;const first=x.runs.find(a=>a.node===face);first.progress=.5;x.setNow(100);x.setHeight(160);ctl.expand(124);
  const next=x.runs.filter(a=>a.node===face).at(-1);assert.equal(x.f.querySelectorAll('[data-bb-chat-ui-expand-face]').length,1);assert.match(next.frames[0].clipPath,/73px/,'old top376 + remaining37 - new top340');assert.equal(next.options.duration,260,'end remains on original clock');assert.ok(first.cancelled);
  x.setReduced();ctl.expand(160);assert.equal(x.f.querySelector('[data-bb-chat-ui-expand-face]'),null);ctl.destroy();assert.equal(x.d.querySelector('[data-bb-chat-ui-expand-visual-style]'),null);
 }finally{ctl.destroy();x.dom.window.close()}
});

test('D includes the native 44px footer in its old visible bounds and pill compensation',()=>{
 const x=fixture();const anchor=x.d.createElement('div');anchor.setAttribute('data-follow-up-composer','');x.f.before(anchor);anchor.append(x.f);const footer=x.d.createElement('div');footer.setAttribute('data-follow-up-composer-footer','');anchor.append(footer);anchor.getBoundingClientRect=()=>({bottom:544,height:168}as DOMRect);
 const ctl=injectPhoneExpansionVisual(x.f);try{ctl.expand(50);const face=x.f.querySelector<HTMLElement>('[data-bb-chat-ui-expand-face]')!;const run=x.runs.find(a=>a.node===face);assert.match(run.frames[0].clipPath,/118px/);assert.match(run.frames[1].clipPath,/44px/);assert.equal(face.style.bottom,'-44px');assert.ok(x.runs.some(a=>a.node===footer&&a.frames[0].opacity===0));assert.ok(x.runs.some(a=>a.node.hasAttribute('data-bb-chat-ui-info-bar')&&a.frames[0].transform==='translateY(118px)'))}finally{ctl.destroy();x.dom.window.close()}
});

test('D compensates only native message scroll displacement and preserves a scrolled-up timeline',()=>{
 const x=fixture(),scroller=x.d.createElement('div');scroller.className='thread-scrollbar';x.f.closest('[data-scroll-footer]')!.before(scroller);scroller.append(x.f.closest('[data-scroll-footer]')!);const timeline=x.d.createElement('div');timeline.setAttribute('data-scroll-attached','');scroller.prepend(timeline);const ctl=injectPhoneExpansionVisual(x.f);try{scroller.scrollTop=74;ctl.expand(50);assert.ok(x.runs.some(a=>a.node===timeline&&a.frames[0].transform==='translateY(74px)'));ctl.cancel();const before=x.runs.length;ctl.expand(50);assert.equal(x.runs.slice(before).filter(a=>a.node===timeline).length,0,'no movement when native did not scroll')}finally{ctl.destroy();x.dom.window.close()}
});

test('phone enables the selected expansion directly with no switch or session choice; desktop and disposal restore it',async()=>{
 const x=fixture(),ctl=injectPhoneExpansionVisual(x.f);try{
  assert.ok(x.f.hasAttribute('data-bb-chat-ui-phone-expand'),'selected motion is enabled without an experimental switch');
  assert.match(x.d.querySelector('[data-bb-chat-ui-expand-visual-style]')!.textContent!,/height:auto!important/);
  assert.equal(x.d.querySelector('[data-bb-chat-ui-expand-switch],[data-bb-chat-ui-expand-experiment]'),null);
  x.d.documentElement.setAttribute('data-bb-chat-ui-root-device','desktop');await Promise.resolve();await Promise.resolve();
  assert.equal(x.f.hasAttribute('data-bb-chat-ui-phone-expand'),false);assert.equal(x.d.querySelector('[data-bb-chat-ui-expand-visual-style]'),null);
  x.d.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');await Promise.resolve();await Promise.resolve();
  assert.ok(x.f.hasAttribute('data-bb-chat-ui-phone-expand'));ctl.destroy();assert.equal(x.f.hasAttribute('data-bb-chat-ui-phone-expand'),false);assert.equal(x.d.querySelector('[data-bb-chat-ui-expand-visual-style]'),null);
 }finally{ctl.destroy();x.dom.window.close()}
});

test('desktop scrolling does not read layout or scroll state for the phone expansion controller',()=>{
 const x=fixture(),scroller=x.d.createElement('div');scroller.className='thread-scrollbar';x.f.before(scroller);scroller.append(x.f);x.d.documentElement.setAttribute('data-bb-chat-ui-root-device','desktop');const ctl=injectPhoneExpansionVisual(x.f);let reads=0;Object.defineProperty(scroller,'scrollTop',{get(){reads++;return 0}});try{scroller.dispatchEvent(new x.w.Event('scroll'));assert.equal(reads,0);assert.equal(x.d.querySelector('[data-bb-chat-ui-expand-visual-style]'),null)}finally{ctl.destroy();x.dom.window.close()}
});
