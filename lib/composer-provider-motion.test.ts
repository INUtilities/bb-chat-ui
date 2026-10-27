import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectComposerProviderMotion} from './composer-provider-motion.ts';
import {EASE} from './motion.ts';

function fixture(reduced=false){
 const dom=new JSDOM('<div id="card"><div id="tabs" class="bg-background"><button title="Codex" aria-selected="true">C</button><button title="Pi">P</button></div></div>',{pretendToBeVisual:true}),w=dom.window,d=w.document,card=d.getElementById('card')!;
 let reduce=reduced;const listeners=new Set<()=>void>();w.matchMedia=()=>({get matches(){return reduce},addEventListener:(_e:string,f:()=>void)=>listeners.add(f),removeEventListener:(_e:string,f:()=>void)=>listeners.delete(f)}as unknown as MediaQueryList);
 const motions:{node:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancelled:boolean;onfinish:(()=>void)|null}[]=[];
 w.HTMLElement.prototype.animate=function(frames:Keyframe[],options:KeyframeAnimationOptions){const a={node:this,frames,options,cancelled:false,onfinish:null as (()=>void)|null,cancel(){this.cancelled=true}};motions.push(a);return a as unknown as Animation};
 const layout=()=>{for(const b of card.querySelectorAll<HTMLElement>('button[title]'))b.getBoundingClientRect=()=>({left:b.title==='Codex'?10:50,width:b.title==='Codex'?24:36,bottom:40}as DOMRect);const tabs=card.querySelector<HTMLElement>('#tabs')!;tabs.getBoundingClientRect=()=>({left:10,bottom:40}as DOMRect)};layout();
 return {dom,w,d,card,motions,layout,async settle(){await Promise.resolve();await Promise.resolve()},setReduced(){reduce=true;listeners.forEach(f=>f())}};
}
for(const phone of [false,true])test(`provider indicator survives native tab replacement and slides on every selection (${phone?'phone':'desktop'})`,async()=>{
 const f=fixture();if(phone)f.d.documentElement.dataset.bbChatUiRootDevice='phone';const original=f.card.innerHTML,stop=injectComposerProviderMotion(f.card);
 try{
 const marker=f.card.querySelector<HTMLElement>('[data-bb-chat-ui-provider-indicator]');assert.ok(marker,'provider tabs receive one persistent indicator');assert.equal(f.motions.length,0,'first opening has no invented previous tab');
 f.card.querySelector('[title=Codex]')!.setAttribute('aria-selected','false');f.card.querySelector('[title=Pi]')!.setAttribute('aria-selected','true');await f.settle();assert.equal(f.motions.length,1);assert.equal(f.motions[0].options.easing,EASE.out);assert.equal(f.motions[0].options.duration,260);assert.match(JSON.stringify(f.motions[0].frames),/translateX\(40px\).*scaleX\(36\)/);assert.ok(f.motions[0].frames.every(frame=>Object.keys(frame).every(key=>key==='transform')));
 f.card.querySelector('#tabs')!.outerHTML='<div id="tabs" class="bg-background"><button title="Codex" aria-selected="true">C</button><button title="Pi">P</button></div>';f.layout();await f.settle();assert.equal(f.card.querySelector('[data-bb-chat-ui-provider-indicator]'),marker,'row remount retains indicator identity');assert.equal(f.motions.length,2);assert.equal(f.motions[0].cancelled,true,'retarget releases old animation');
 f.setReduced();assert.equal(f.motions[1].cancelled,true);assert.match(marker.style.transform,/translateX\(0px\)/);
 stop();assert.equal(f.card.innerHTML,original,'native borders and row styles are restored');
 }finally{stop();f.dom.window.close()}
});
test('reduced provider motion snaps and unrelated model text does not restart it',async()=>{const f=fixture(true),stop=injectComposerProviderMotion(f.card);try{f.card.querySelector('[title=Codex]')!.setAttribute('aria-selected','false');f.card.querySelector('[title=Pi]')!.setAttribute('aria-selected','true');await f.settle();f.card.append(f.d.createTextNode('model update'));await f.settle();assert.equal(f.motions.length,0);assert.match(f.card.querySelector<HTMLElement>('[data-bb-chat-ui-provider-indicator]')!.style.transform,/40px/)}finally{stop();f.dom.window.close()}});
