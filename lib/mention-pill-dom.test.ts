import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {injectMentionPills} from './mention-pill.ts';
function fixture(){
 const dom=new JSDOM('<body><div data-promptbox-compact-content><div data-promptbox-editor-content><div class="ProseMirror"></div></div></div></body>');
 const keys=['Element','HTMLElement','MutationObserver'] as const;
 const old=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]as const);
 for(const k of keys)Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
 const doc=dom.window.document,wrapper=doc.querySelector('[data-promptbox-compact-content]')!,editor=doc.querySelector('.ProseMirror')!;
 const add=(resource:object)=>{const p=doc.createElement('span');p.className='prompt-mention-pill';p.setAttribute('data-prompt-mention','');p.setAttribute('data-prompt-mention-resource',JSON.stringify(resource,null,2));p.innerHTML='<span class="truncate">label</span>';editor.append(p);return p;};
 return {dom,doc,wrapper,editor,add,tick:()=>new Promise<void>(r=>setImmediate(r)),cleanup(){dom.window.close();for(const[k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}}};
}
test('compact mention markers follow resource changes, removal and reattachment',async()=>{
 const f=fixture(),stop=injectMentionPills(f.doc);
 try{
  const p=f.add({kind:'plugin',itemId:'quote:one',icon:'Quote'});await f.tick();
  assert.ok(f.wrapper.hasAttribute('data-bb-chat-ui-has-mention'));
  assert.ok(f.wrapper.hasAttribute('data-bb-chat-ui-has-quote-mention'),'quote detection accepts formatted resource JSON');
  p.setAttribute('data-prompt-mention-resource',JSON.stringify({kind:'path',label:'file.ts'}));await f.tick();
  assert.equal(f.wrapper.hasAttribute('data-bb-chat-ui-has-quote-mention'),false);
  p.remove();await f.tick();assert.equal(f.wrapper.hasAttribute('data-bb-chat-ui-has-mention'),false);
  f.editor.append(p);await f.tick();assert.ok(f.wrapper.hasAttribute('data-bb-chat-ui-has-mention'));
  stop();assert.equal(f.wrapper.hasAttribute('data-bb-chat-ui-has-mention'),false);
 }finally{stop();f.cleanup();}
});
test('repainting mention labels does not rewrite unchanged presentation attributes',async()=>{
 const f=fixture(),p=f.add({kind:'path',label:'file.ts'}),stop=injectMentionPills(f.doc);
 const records:MutationRecord[]=[];const observer=new f.dom.window.MutationObserver(r=>records.push(...r));
 try{
  await f.tick();observer.observe(p,{attributes:true,attributeFilter:['data-bb-chat-ui-mention-pill','data-bb-chat-ui-mention-wide']});
  p.querySelector('.truncate')!.textContent='new label';await f.tick();assert.equal(records.length,0);
 }finally{observer.disconnect();stop();f.cleanup();}
});

test('new mentions do not reread resources of existing transcript pills',async()=>{
 const f=fixture();
 const transcript=f.doc.createElement('div');transcript.setAttribute('data-message-column','');f.doc.body.append(transcript);
 const existing=Array.from({length:200},()=>{const p=f.add({kind:'path',label:'file.ts'});transcript.append(p);return p;});
 const stop=injectMentionPills(f.doc);
 try{
  await f.tick();let reads=0;
  for(const p of existing){const get=p.getAttribute.bind(p);p.getAttribute=(name:string)=>{if(name==='data-prompt-mention-resource')reads++;return get(name);};}
  for(let i=0;i<10;i++){const p=f.add({kind:'path',label:'new.ts'});transcript.append(p);await f.tick();}
  assert.equal(reads,0,'only the new resources belong to the dirty set');
 }finally{stop();f.cleanup();}
});

test('compact transitions, busy state and copied pills resync delete controls locally',async()=>{
 const f=fixture();
 Object.assign(f.editor,{editor:{view:{}}});
 const p=f.add({kind:'path',label:'file.ts'}),stop=injectMentionPills(f.doc);
 try{
  await f.tick();assert.ok(p.querySelector('[data-bb-chat-ui-mention-remove]'));
  f.wrapper.removeAttribute('data-promptbox-compact-content');await f.tick();
  assert.equal(p.querySelector('[data-bb-chat-ui-mention-remove]'),null);
  assert.equal(f.wrapper.hasAttribute('data-bb-chat-ui-has-mention'),false);
  f.editor.setAttribute('contenteditable','true');await f.tick();
  assert.ok(p.querySelector('[data-bb-chat-ui-mention-remove]'));
  const scroll=f.doc.createElement('div');scroll.setAttribute('data-promptbox-editor-scroll','');f.editor.parentElement!.before(scroll);scroll.append(f.editor.parentElement!);
  scroll.setAttribute('aria-busy','true');await f.tick();assert.equal(p.querySelector('[data-bb-chat-ui-mention-remove]'),null);
  scroll.setAttribute('aria-busy','false');await f.tick();assert.ok(p.querySelector('[data-bb-chat-ui-mention-remove]'));
  const copied=p.cloneNode(true) as HTMLElement;f.editor.append(copied);await f.tick();
  assert.equal(copied.querySelectorAll('[data-bb-chat-ui-mention-remove]').length,1);
  p.remove();await f.tick();f.editor.append(p);await f.tick();assert.ok(p.querySelector('[data-bb-chat-ui-mention-remove]'));
 }finally{stop();f.cleanup();}
});

test('replacing transcript rows does not search removed subtrees without compact dependents',async()=>{
 const f=fixture(),transcript=f.doc.createElement('div');transcript.setAttribute('data-message-column','');f.doc.body.append(transcript);
 const old=Array.from({length:30},()=>{const row=f.doc.createElement('div');row.append(f.add({kind:'path',label:'old.ts'}));transcript.append(row);return row;});
 const stop=injectMentionPills(f.doc);
 try{
  await f.tick();let searches=0;
  for(const row of old){const query=row.querySelectorAll.bind(row);row.querySelectorAll=((selector:string)=>{searches++;return query(selector);})as typeof row.querySelectorAll;}
  transcript.replaceChildren(f.doc.createElement('div'));await f.tick();
  assert.equal(searches,0,'removed transcript rows have no compact state to reconcile');
 }finally{stop();f.cleanup();}
});
