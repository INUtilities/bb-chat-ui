import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {injectQueuedMessages} from './queued-messages.ts';

test('queue scanning skips transcript changes while count changes stay live',async()=>{
 const dom=new JSDOM('<body><div data-timeline-items></div><section aria-label="Queued messages"><header data-queued-messages-mode="collapsed"><span class="tabular-nums">2</span></header></section></body>');
 const keys=['Element','HTMLElement','HTMLButtonElement','MutationObserver'] as const;
 const old=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const);
 for(const k of keys)Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
 const doc=dom.window.document,stop=injectQueuedMessages(doc),tick=()=>new Promise<void>(r=>setImmediate(r));
 try{
  await tick();let scans=0;const query=doc.querySelectorAll.bind(doc);
  doc.querySelectorAll=((s:string)=>{if(s==='section[aria-label="Queued messages"]')scans++;return query(s);}) as typeof query;
  for(let i=0;i<5;i++){doc.querySelector('[data-timeline-items]')!.append(doc.createElement('span'));await tick();}
  assert.equal(scans,0,'streaming rows cannot change the composer queue');
  doc.querySelector('.tabular-nums')!.textContent='3';await tick();
  assert.ok(scans>0);assert.equal(doc.querySelector('header')!.getAttribute('data-bb-chat-ui-queue-label'),'3');
  stop();scans=0;doc.querySelector('.tabular-nums')!.textContent='4';await tick();assert.equal(scans,0);
 }finally{stop();dom.window.close();for(const[k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}}
});
