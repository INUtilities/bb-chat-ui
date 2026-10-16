import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectThreadToc } from './thread-toc.ts';

function fixture() {
  const dom=new JSDOM('<body></body>',{pretendToBeVisual:true});const {document}=dom.window;
  const keys=['HTMLElement','HTMLButtonElement','Node','MutationObserver'] as const;
  const previous=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:dom.window[key]});
  const active=new Map<Element,Map<string,Set<EventListenerOrEventListenerObject>>>();
  const add=dom.window.Element.prototype.addEventListener;const remove=dom.window.Element.prototype.removeEventListener;
  dom.window.Element.prototype.addEventListener=function(type,listener,options) {
    if(listener&&this.matches('[data-thread-toc],button.no-scrollbar')&&['mouseenter','mousemove','click','mouseleave'].includes(type)){
      if(!active.has(this))active.set(this,new Map());const types=active.get(this)!;if(!types.has(type))types.set(type,new Set());types.get(type)!.add(listener);
    }
    return add.call(this,type,listener,options);
  };
  dom.window.Element.prototype.removeEventListener=function(type,listener,options) {
    if(listener)active.get(this)?.get(type)?.delete(listener);return remove.call(this,type,listener,options);
  };
  const makeRoot=()=>{const root=document.createElement('div');root.setAttribute('data-thread-toc','');root.innerHTML='<button class="no-scrollbar"><span class="rounded-full"></span></button>';document.body.append(root);return root;};
  return {document,dom,makeRoot,count:(node:Element)=>[...(active.get(node)?.values()??[])].reduce((n,listeners)=>n+listeners.size,0),tick:()=>new Promise<void>(resolve=>setImmediate(resolve)),cleanup(){
    for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
    dom.window.close();
  }};
}

test('detached TOC root and rail release their listeners and can bind again without stale hover',async()=>{
  const f=fixture();const root=f.makeRoot();const rail=root.querySelector('button')!;const tick=rail.querySelector('span')!;const stop=injectThreadToc(f.document);
  try {
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));
    assert.equal(tick.style.width,'32px');assert.equal(f.count(root),1);assert.equal(f.count(rail),3);
    root.remove();await f.tick();
    assert.equal(f.count(root),0,'root listener is released on SPA navigation');
    assert.equal(f.count(rail),0,'rail listeners are released before plugin unload');
    assert.equal(root.hasAttribute('data-bb-chat-ui-toc-root'),false);
    assert.equal(tick.style.width,'');assert.equal(tick.hasAttribute('data-bb-chat-ui-toc-selected'),false);
    f.document.body.append(root);await f.tick();
    assert.equal(f.count(root),1);assert.equal(f.count(rail),3);
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(tick.style.width,'32px');
    stop();assert.equal(f.count(root),0);assert.equal(f.count(rail),0);
  } finally {stop();f.cleanup();}
});

test('replacing just a TOC rail releases the old rail and retains exactly one live root listener',async()=>{
  const f=fixture();const root=f.makeRoot();const rail=root.querySelector('button')!;const stop=injectThreadToc(f.document);
  try {
    const next=f.document.createElement('button');next.className=rail.className;next.innerHTML=rail.innerHTML;rail.replaceWith(next);await f.tick();
    assert.equal(f.count(rail),0);assert.equal(rail.hasAttribute('data-bb-chat-ui-toc-rail'),false);
    assert.equal(f.count(next),3);assert.equal(f.count(root),1);
    next.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(next.querySelector('span')!.style.width,'32px');
    root.remove();f.document.body.append(root);await f.tick();
    assert.equal(f.count(next),3,'same-batch moves do not duplicate bindings');assert.equal(next.querySelector('span')!.style.width,'32px','connected roots keep their current hover');
  } finally {stop();f.cleanup();}
});

test('sidebar and message changes skip TOC scans while nested new rails are still discovered',async()=>{
  const f=fixture();const root=f.makeRoot();const stop=injectThreadToc(f.document);
  try {
    await f.tick();
    let scans=0;const query=f.document.querySelectorAll.bind(f.document);
    f.document.querySelectorAll=((selector:string)=>{if(selector.startsWith('[data-thread-toc]'))scans++;return query(selector);}) as typeof f.document.querySelectorAll;
    const sidebar=f.document.createElement('aside');sidebar.innerHTML='<div>Sidebar row</div>';f.document.body.append(sidebar);await f.tick();
    sidebar.firstElementChild!.textContent='Updated row';await f.tick();
    assert.equal(scans,0,'unrelated changes do not scan all TOC roots or rails');
    const wrapper=f.document.createElement('section');wrapper.innerHTML='<div data-thread-toc><button class="no-scrollbar"><span class="rounded-full"></span></button></div>';
    f.document.body.append(wrapper);await f.tick();
    const rail=wrapper.querySelector('button')!;assert.equal(f.count(rail),3);
    rail.dispatchEvent(new f.dom.window.MouseEvent('mousemove',{clientY:0}));assert.equal(rail.querySelector('span')!.style.width,'32px');
    assert.equal(f.count(root),1);
  } finally {stop();f.cleanup();}
});
