import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectComposerModelMenus} from './composer-model-menu.ts';

const selectedProviderClass=["border","foreground"].join("-");
function fixture(phone=true){
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="${phone?'phone':'desktop'}"><body><form data-promptbox><button aria-label="Provider, model and reasoning" aria-haspopup="dialog" aria-expanded="true" ${phone?'':'aria-controls="model"'}></button></form><section id="model" role="dialog" data-bb-portaled-overlay ${phone?'data-persistent-drawer-content data-state="open" aria-labelledby="title"':''}><h2 id="title">Model</h2><div><div class="bg-background"><button title="Codex" class="${selectedProviderClass}">Codex</button><button title="Other">Other</button><button title="Disabled" disabled>Disabled</button></div></div><button role="switch" aria-label="Fast mode" aria-checked="false">Fast mode</button><div>Reasoning</div><div role="radiogroup" aria-label="Reasoning"><button role="radio" aria-label="Low" aria-checked="true">Low</button><button role="radio" aria-label="Medium" aria-checked="false">Medium</button><button role="radio" aria-label="High" aria-checked="false">High</button></div></section></body></html>`,{pretendToBeVisual:true});
 const d=dom.window.document,pulses:unknown[]=[];let now=1000;
 Object.defineProperty(dom.window.performance,'now',{value:()=>now});
 (dom.window as any).bb={native:{capabilities:['haptic'],post:(m:unknown)=>pulses.push(m)}};
 const card=d.getElementById('model')!;
 card.addEventListener('click',e=>{
  const b=(e.target as Element).closest('button');if(!b)return;
  if(b.matches('[role=radio]'))for(const r of card.querySelectorAll('[role=radio]'))r.setAttribute('aria-checked',String(r===b));
  if(b.matches('[role=switch]'))b.setAttribute('aria-checked',String(b.getAttribute('aria-checked')!=='true'));
  if(b.hasAttribute('title'))for(const t of card.querySelectorAll('button[title]'))t.classList.toggle(selectedProviderClass,t===b);
 });
 const stop=injectComposerModelMenus(d);
 return{d,card,pulses,dom,stop,advance:()=>now+=400,click:(s:string)=>(card.querySelector(s)as HTMLElement).click(),range:()=>card.querySelector<HTMLInputElement>('input[aria-label=Effort]')!};
}

test('phone model actions pulse on changes, share 400ms throttling and release on close',async()=>{
 const f=fixture();
 try{
  f.click('[title=Codex]');assert.equal(f.pulses.length,0,'the active provider is not a transition');
  f.click('[title=Other]');assert.equal(f.pulses.length,1);
  f.advance();f.click('[title=Other]');assert.equal(f.pulses.length,1,'same provider remains quiet');
  f.click('[role=switch]');assert.equal(f.pulses.length,2);
  f.click('[title=Codex]');assert.equal(f.pulses.length,2,'other actions share the rate limit');
  f.advance();f.click('[title=Disabled]');assert.equal(f.pulses.length,2);
  const range=f.range();range.value='1';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.pulses.length,3,'the gauge forwards one native step change');
  f.advance();range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.pulses.length,3,'same step does not pulse again');
  range.value='2';range.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.pulses.length,4);
  assert.deepEqual(f.pulses,Array(4).fill({type:'haptic',kind:'impact-light'}));
  f.card.setAttribute('data-state','closed');await Promise.resolve();await Promise.resolve();
  f.advance();f.click('[role=switch]');assert.equal(f.pulses.length,4,'closed sheet releases its listener');
 }finally{f.stop();f.dom.window.close();}
});

test('desktop model actions never pulse',()=>{
 const f=fixture(false);try{f.click('[role=switch]');f.advance();f.click('[title=Other]');f.advance();f.click('[aria-label=High]');assert.deepEqual(f.pulses,[]);}finally{f.stop();f.dom.window.close();}
});
