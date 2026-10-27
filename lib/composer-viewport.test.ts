import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {composerViewportLimits,injectComposerViewport} from './composer-viewport.ts';

// Keep independent panes measurable without changing an unrelated composer's geometry.
test('footer mutations only measure the affected composer and batch reads before writes',async()=>{
  const dom=new JSDOM('<main></main>',{pretendToBeVisual:true});
  const d=dom.window.document,events:string[]=[];
  // Create two independent panes with observable geometry reads.
  const pane=(name:string)=>{
    const node=d.createElement('div');node.innerHTML='<div data-page-scroll-viewport><div data-scroll-footer><div class="chat-prompt-box"><form data-promptbox><div data-promptbox-editor-scroll></div></form></div></div></div>';
    d.querySelector('main')!.append(node);
    for(const el of node.querySelectorAll<HTMLElement>('*'))el.getBoundingClientRect=()=>{events.push(name+':read');return {top:100,bottom:700,height:100} as DOMRect;};
    const composer=node.querySelector<HTMLElement>('[data-promptbox]')!,footer=node.querySelector('[data-scroll-footer]')!;
    const set=composer.style.setProperty.bind(composer.style);
    // Record viewport CSS writes so read/write ordering remains explicit.
    composer.style.setProperty=(...args)=>{events.push(name+':write');set(...args);};
    return {node,composer,footer};
  };
  const a=pane('a'),b=pane('b');
  const stop=injectComposerViewport(d);
  // Drain observer delivery and one frame without relying on wall-clock thresholds.
  const paint=async()=>{await Promise.resolve();await new Promise<void>(resolve=>dom.window.requestAnimationFrame(()=>resolve()));};
  try{
    assert.ok(events.findIndex(e=>e.endsWith(':write'))>events.findLastIndex(e=>e.endsWith(':read')),'all viewport geometry reads precede CSS writes');
    await paint();events.length=0;
    a.footer.append(d.createElement('span'));await paint();
    assert.ok(events.includes('a:read'),'changed footer is measured');
    assert.equal(events.some(e=>e.startsWith('b:')),false,'an independent pane must not be measured');
    events.length=0;dom.window.dispatchEvent(new dom.window.Event('resize'));await paint();
    assert.ok(events.includes('a:read')&&events.includes('b:read'),'window resize updates every pane');
    a.node.remove();await paint();
    assert.equal(a.composer.hasAttribute('data-bb-chat-ui-composer-viewport'),false,'detached composers release bindings');
    const nested=pane('new');await paint();
    assert.equal(nested.composer.hasAttribute('data-bb-chat-ui-composer-viewport'),true,'new nested composers are still discovered');
  }finally{stop();dom.window.close();}
});

// Recompute viewport limits when an existing footer moves to another pane.
test('moving an existing footer updates its pane and resize subscription',async()=>{
 const dom=new JSDOM('<div data-page-scroll-viewport id="a"><div data-scroll-footer><div class="chat-prompt-box"><form data-promptbox><div data-promptbox-editor-scroll></div></form></div></div></div><div data-page-scroll-viewport id="b"></div>',{pretendToBeVisual:true});
 const d=dom.window.document,a=d.querySelector('#a')!,b=d.querySelector('#b')!,footer=d.querySelector('[data-scroll-footer]')!,composer=d.querySelector<HTMLElement>('[data-promptbox]')!;
 const peer=footer.cloneNode(true) as HTMLElement;a.append(peer);const peerComposer=peer.querySelector<HTMLElement>('[data-promptbox]')!;
 // The remaining composer moves when its sibling leaves the pane.
 peerComposer.getBoundingClientRect=()=>({top:footer.parentElement===a?600:150} as DOMRect);
 a.getBoundingClientRect=()=>({top:0,bottom:700} as DOMRect);b.getBoundingClientRect=()=>({top:0,bottom:350} as DOMRect);
 footer.getBoundingClientRect=()=>({height:200} as DOMRect);d.querySelector('[data-promptbox-editor-scroll]')!.getBoundingClientRect=()=>({height:100} as DOMRect);
 const observers:{targets:Set<Element>;active:boolean}[]=[];
 class Sizes{
  targets=new Set<Element>();active=true;
  // Record the owning pane of each live viewport subscription.
  constructor(){observers.push(this);}
  // Observe the current footer and pane.
  observe(node:Element){this.targets.add(node);}
  // Release subscriptions when the owner changes or unmounts.
  disconnect(){this.active=false;}
 }
 Object.defineProperty(dom.window,'ResizeObserver',{value:Sizes});
 const stop=injectComposerViewport(d);
 try{
  const initial=parseFloat(composer.style.getPropertyValue('--bb-chat-ui-editor-max-height'));
  const peerMenu=parseFloat(peerComposer.style.getPropertyValue('--bb-chat-ui-mention-max-height'));
  b.append(footer);await Promise.resolve();await new Promise<void>(resolve=>dom.window.requestAnimationFrame(()=>resolve()));
  assert.ok(parseFloat(composer.style.getPropertyValue('--bb-chat-ui-editor-max-height'))<initial,'moved footer uses the new pane budget');
  assert.ok(parseFloat(peerComposer.style.getPropertyValue('--bb-chat-ui-mention-max-height'))<peerMenu,'the previous pane also refreshes after the move');
  assert.ok(observers.some(o=>o.active&&o.targets.has(b)),'resize follows the new pane');
  assert.equal(observers[0].active,false,'the moved composer releases its previous pane subscription');
 }finally{stop();dom.window.close();}
});

test('editor budget follows split pane and visual viewport while reserving mention space',()=>{
  const base={paneTop:48,paneBottom:900,viewportTop:0,viewportHeight:900,overhead:120};
  const desktop=composerViewportLimits(base);
  const split=composerViewportLimits({...base,paneBottom:360});
  const keyboard=composerViewportLimits({...base,viewportTop:60,viewportHeight:300});
  assert.ok(split.editor<desktop.editor);
  assert.ok(keyboard.editor<desktop.editor);
  for(const [limits,height] of [[split,312],[keyboard,300]] as const){
    assert.ok(limits.editor>0);
    assert.ok(limits.editor+120+limits.reserve<=height);
  }
});

test('composer wheel scrolls editor, contains its edges and releases handlers on unload',()=>{
  const dom=new JSDOM('<div data-page-scroll-viewport><div data-scroll-footer><div class="chat-prompt-box"><form data-promptbox><div data-promptbox-editor-scroll style="overflow-y:auto"><div contenteditable="true">Draft</div></div><button>Send</button></form></div></div></div>',{pretendToBeVisual:true});
  const d=dom.window.document,editor=d.querySelector<HTMLElement>('[data-promptbox-editor-scroll]')!;
  Object.defineProperties(editor,{scrollHeight:{value:800},clientHeight:{value:120}});
  let background=0;d.querySelector('[data-page-scroll-viewport]')!.addEventListener('wheel',()=>background++);
  const stop=injectComposerViewport(d);
  const wheel=(target:Element,deltaY:number,ctrlKey=false)=>{const e=new dom.window.WheelEvent('wheel',{deltaY,ctrlKey,bubbles:true,cancelable:true});target.dispatchEvent(e);return e;};
  try{
    assert.equal(wheel(editor,70).defaultPrevented,true);
    assert.equal(editor.scrollTop,70);
    assert.equal(background,0);
    editor.scrollTop=680;wheel(editor,50);assert.equal(editor.scrollTop,680);assert.equal(background,0);
    wheel(d.querySelector('button')!,-40);assert.equal(editor.scrollTop,640);
    assert.equal(wheel(editor,20,true).defaultPrevented,false);
    const touch=(type:string,points:{clientX:number;clientY:number}[])=>{
      const event=new dom.window.Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'touches',{value:points});editor.dispatchEvent(event);return event;
    };
    editor.scrollTop=680;
    touch('touchstart',[{clientX:10,clientY:100}]);
    assert.equal(touch('touchmove',[{clientX:10,clientY:50}]).defaultPrevented,true,'touch cannot chain at the editor end');
    touch('touchstart',[{clientX:10,clientY:100},{clientX:20,clientY:100}]);
    assert.equal(touch('touchmove',[{clientX:10,clientY:50},{clientX:20,clientY:50}]).defaultPrevented,false,'pinch is preserved');
    stop();wheel(editor,20);assert.equal(background,2);
    assert.equal(editor.style.getPropertyValue('--bb-chat-ui-editor-max-height'),'');
  }finally{stop();dom.window.close();}
});

test('viewport resize and keyboard viewport offsets update the same composer budget',async()=>{
  const dom=new JSDOM('<div data-page-scroll-viewport><div data-scroll-footer><div class="chat-prompt-box"><form data-promptbox><div data-promptbox-editor-scroll></div></form></div></div></div>',{pretendToBeVisual:true});
  const d=dom.window.document,c=d.querySelector<HTMLElement>('[data-promptbox]')!,e=c.querySelector<HTMLElement>('[data-promptbox-editor-scroll]')!,pane=d.querySelector('[data-page-scroll-viewport]')!,footer=d.querySelector('[data-scroll-footer]')!;
  let bottom=700;
  pane.getBoundingClientRect=()=>({top:48,bottom} as DOMRect);
  footer.getBoundingClientRect=()=>({height:200} as DOMRect);
  e.getBoundingClientRect=()=>({height:100} as DOMRect);
  c.getBoundingClientRect=()=>({top:400} as DOMRect);
  const viewport=new dom.window.EventTarget();Object.assign(viewport,{height:700,offsetTop:0});
  Object.defineProperty(dom.window,'visualViewport',{value:viewport});
  const stop=injectComposerViewport(d);
  const paint=()=>new Promise<void>(resolve=>dom.window.requestAnimationFrame(()=>resolve()));
  try{
    const original=parseFloat(c.style.getPropertyValue('--bb-chat-ui-editor-max-height'));
    bottom=350;dom.window.dispatchEvent(new dom.window.Event('resize'));await paint();
    const split=parseFloat(c.style.getPropertyValue('--bb-chat-ui-editor-max-height'));assert.ok(split<original);
    Object.assign(viewport,{height:240,offsetTop:50});viewport.dispatchEvent(new dom.window.Event('resize'));await paint();
    assert.ok(parseFloat(c.style.getPropertyValue('--bb-chat-ui-editor-max-height'))<split);
    stop();assert.equal(c.style.getPropertyValue('--bb-chat-ui-editor-max-height'),'');
    viewport.dispatchEvent(new dom.window.Event('resize'));await paint();assert.equal(c.hasAttribute('data-bb-chat-ui-composer-viewport'),false);
  }finally{stop();dom.window.close();}
});
