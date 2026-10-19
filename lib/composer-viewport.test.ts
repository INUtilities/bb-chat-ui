import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {composerViewportLimits,injectComposerViewport} from './composer-viewport.ts';

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
