import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectQuotePreview,registerQuoteReader} from './quote-preview.ts';

function fixture(){
 const dom=new JSDOM('<body><span class="prompt-mention-pill">Quote</span></body>',{pretendToBeVisual:true}),d=dom.window.document;
 const saved=['Element','HTMLElement','Node'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 for(const[key]of saved)Object.defineProperty(globalThis,key,{configurable:true,value:(dom.window as unknown as Record<string,unknown>)[key]});
 const pill=d.querySelector<HTMLElement>('span')!,tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
 return{d,dom,pill,tick,async open(id='one'){
  d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-card-close]')?.click();
  pill.setAttribute('data-prompt-mention-resource',JSON.stringify({kind:'plugin',pluginId:'bb-chat-ui',itemId:'quote:'+id,label:'Quote'}));
  pill.click();await tick();
 },close(){d.querySelector<HTMLButtonElement>('[data-bb-chat-ui-card-close]')?.click();},cleanup(){dom.window.close();for(const[key,value]of saved){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}};
}

test('a quote shares its pending read and reuses the successful original without changing click behavior',async()=>{
 const f=fixture();let reads=0,finish!:(text:string)=>void;
 const stop=injectQuotePreview(f.d,{readQuote:()=>{reads++;return new Promise(resolve=>finish=resolve);}});
 try{
  assert.equal(reads,0);await f.open();await f.open();assert.equal(reads,1,'reopening during a request must share it');
  finish('Original');await f.tick();assert.equal(f.d.querySelector('[data-bb-chat-ui-quote-text]')?.textContent,'Original');
  await f.open();assert.equal(reads,1);assert.equal(f.d.querySelector('[data-bb-chat-ui-quote-text]')?.textContent,'Original');
  f.pill.click();assert.equal(f.d.querySelector('[data-bb-chat-ui-quote-preview-card]'),null,'existing click-to-close is retained');
 }finally{stop();f.cleanup();}
});

test('quote cache expires after one minute and does not retain missing or failed reads',async t=>{
 const f=fixture();let now=0,reads=0;t.mock.method(Date,'now',()=>now);
 const stop=injectQuotePreview(f.d,{readQuote:async()=>{reads++;if(reads===1)throw Error('unavailable');if(reads===2)return null;return 'Original';}});
 try{
  await f.open();await f.open();await f.open();assert.equal(reads,3,'errors and missing originals must retry');
  now=59_999;await f.open();assert.equal(reads,3);
  now=60_001;await f.open();assert.equal(reads,4,'expired originals must be fetched again');
 }finally{stop();f.cleanup();}
});

test('quote cache keeps at most sixteen recently used originals',async()=>{
 const f=fixture(),reads=new Map<string,number>();
 const stop=injectQuotePreview(f.d,{readQuote:async id=>{reads.set(id,(reads.get(id)??0)+1);return id;}});
 try{
  for(let i=0;i<16;i++)await f.open('q'+i);
  await f.open('q0');assert.equal(reads.get('q0'),1);
  await f.open('q16');await f.open('q0');assert.equal(reads.get('q0'),1,'recent original stays cached');
  await f.open('q1');assert.equal(reads.get('q1'),2,'least recently used original is released');
 }finally{stop();f.cleanup();}
});

test('quote cache bounds retained text to 128000 characters and releases data on dispose',async()=>{
 const f=fixture(),reads=new Map<string,number>();
 const options={readQuote:async(id:string)=>{reads.set(id,(reads.get(id)??0)+1);return id+'x'.repeat(69_999);}};
 let stop=injectQuotePreview(f.d,options);
 try{
  await f.open('a');await f.open('b');await f.open('b');assert.equal(reads.get('b'),1);
  await f.open('a');assert.equal(reads.get('a'),2,'two 70000-character originals cannot both remain cached');
  stop();stop=injectQuotePreview(f.d,options);await f.open('a');assert.equal(reads.get('a'),3,'a new owner cannot reuse disposed data');
 }finally{stop();f.cleanup();}
});

test('changing the quote reader invalidates the same ID from an earlier source',async()=>{
 const f=fixture();let reads=0;
 const first=registerQuoteReader(f.d,async()=> 'First');let second=()=>{};
 const stop=injectQuotePreview(f.d);
 try{
  await f.open();f.close();first();second=registerQuoteReader(f.d,async()=>{reads++;return 'Second';});
  await f.open();assert.equal(reads,1);assert.equal(f.d.querySelector('[data-bb-chat-ui-quote-text]')?.textContent,'Second');
 }finally{second();first();stop();f.cleanup();}
});
