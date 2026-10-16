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
