import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectMentionPills} from './mention-pill.ts';
import {injectQuotePill} from './quote-pill.ts';
import {resolvedStyle} from './test-style.ts';
import {injectPillStyles} from './pill.ts';

function fixture(phone=false) {
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="${phone?'phone':'desktop'}" data-bb-chat-ui-root-viewport="${phone?'narrow':'wide'}"><head><style>blockquote:focus,.prompt-mention-pill:focus{max-width:800px !important;height:64px !important}.prompt-mention-pill,blockquote{border:1px solid currentColor;background:linear-gradient(currentColor,currentColor);box-shadow:0 1px 2px currentColor;backdrop-filter:blur(6px)}</style></head><body><div data-promptbox-editor-scroll><div data-promptbox-editor-content><div class="ProseMirror" contenteditable="true"><blockquote id="pending"><p>First line</p><p>Second line</p></blockquote><span id="quote" class="prompt-mention-pill" data-prompt-mention data-prompt-mention-resource='{"kind":"plugin","itemId":"quote:one","label":"file.ts:1–30","icon":"FileDiff"}'><span class="truncate">Long quote label</span></span><span id="mention" class="prompt-mention-pill" data-prompt-mention data-prompt-mention-resource='{"kind":"path","label":"file.ts"}'><span class="truncate">file.ts</span></span></div></div></div><div data-message-column><div class="group/message"><blockquote id="sent"><p>First line</p><p>Second line</p></blockquote></div></div></body></html>`,{pretendToBeVisual:true});
 const keys=['Element','HTMLElement','Node','MutationObserver'] as const,old=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]as const);
 for(const k of keys)Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
 const d=dom.window.document;Object.assign(d.querySelector('.ProseMirror')!,{editor:{view:{}}});
 const stops=[injectPillStyles(d),injectQuotePill(d),injectMentionPills(d)];
 return{dom,d,stop(){stops.reverse().forEach(stop=>stop());dom.window.close();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}}};
}

test('reference surfaces share a flat token fill, transparent edge and no shadow or blur',()=>{
 const f=fixture();try{for(const id of['pending','sent','quote','mention']){
  const e=f.d.getElementById(id)!,s=f.dom.window.getComputedStyle(e);
  assert.equal(s.borderColor,'rgba(0, 0, 0, 0)',id);assert.equal(s.boxShadow,'none',id);assert.equal(s.backdropFilter,'none',id);assert.equal(s.backgroundImage,'none',id);
  const css=[...f.d.querySelectorAll('style')].slice(1).map(s=>s.textContent).join('');
  assert.ok(css.includes('color-mix(in oklab, var(--foreground) 7%, transparent)'));
 }}finally{f.stop();}
});

for(const phone of[false,true]) test(`all quote formats keep reference geometry during focus (${phone?'phone':'desktop'})`,async()=>{
 const f=fixture(phone);const{resolvedStyle}=await import('./test-style.ts');try{
  for(const id of['pending','sent','quote']){
   const e=f.d.getElementById(id)!;e.tabIndex=0;
   for(const focused of[false,true]){
    if(focused)e.focus();const s=resolvedStyle(e);
    assert.equal(s.height,phone?'24px':'22px',id);assert.equal(s.fontSize,phone?'14px':'13px',id);
    assert.equal(s.maxWidth,phone?'min(240px, 100% - 8px)':'min(140px, 100% - 6px)',id);
    assert.equal(s.whiteSpace,'nowrap',id);
   }
  }
  assert.equal(f.d.getElementById('quote')!.hasAttribute('data-bb-chat-ui-mention-wide'),false,'code quotes also use the reference width');
 }finally{f.stop();}
});

for(const phone of[false,true])test(`reference remove action stays visible and circular (${phone?'phone':'desktop'})`,()=>{
 const f=fixture(phone);try{const button=f.d.querySelector<HTMLButtonElement>('#quote [data-bb-chat-ui-mention-remove]')!;assert.ok(button);
  const s=resolvedStyle(button);assert.equal(s.width,phone?'18px':'16px');assert.equal(s.height,s.width);assert.equal(s.borderRadius,'999px');
  assert.equal(s.opacity,'1');assert.equal(s.display,'inline-flex');assert.ok(button.getAttribute('aria-label'));
  const sheet=f.d.getElementById('bb-chat-ui-mention-pill')!.textContent!;assert.match(sheet,/foreground\) 9%, transparent/);assert.match(sheet,/foreground\) 16%, transparent/);assert.match(sheet,/opacity:\s*0\.75/);assert.match(sheet,/outline: 2px solid var\(--ring\)/);
  assert.doesNotMatch(f.d.getElementById('bb-chat-ui-quote-pill')!.textContent!,/hover::after/);
 }finally{f.stop();}
});

for(const phone of[false,true])test(`legacy quote label reserves the real control width (${phone?'phone':'desktop'})`,async()=>{const f=fixture(phone);try{const{resolvedStyle}=await import('./test-style.ts');assert.equal(resolvedStyle(f.d.getElementById('pending')!).paddingRight,phone?'28px':'26px');}finally{f.stop();}});

for(const phone of [false,true])test(`inline references preserve visible height with a layout-neutral vertical margin (${phone?'phone':'desktop'})`,async()=>{
 const f=fixture(phone);const {resolvedStyle}=await import('./test-style.ts');
 try{
  for(const id of ['pending','sent','quote','mention']){
   const s=resolvedStyle(f.d.getElementById(id)!);
   assert.equal(s.height,phone?'24px':'22px',`${id}: reference must fit inside the native text line`);
   assert.equal(parseFloat(s.marginTop),-2);assert.equal(parseFloat(s.marginBottom),-2);assert.equal(s.marginLeft,phone?'4px':'3px');
   assert.equal(parseFloat(s.paddingTop),0);assert.equal(parseFloat(s.paddingBottom),0);
   assert.equal(s.fontSize,phone?'14px':'13px');assert.equal(s.lineHeight,phone?'18px':'16px');
   assert.equal(s.overflow,'visible','layout-free phone hit areas must not be clipped by the pill');
  }
  const button=f.d.querySelector<HTMLElement>('#quote [data-bb-chat-ui-mention-remove]')!,s=resolvedStyle(button);
  assert.equal(s.height,phone?'18px':'16px');
  if(phone){
   const sheet=f.d.getElementById('bb-chat-ui-mention-pill')!.textContent!;
   assert.match(sheet,/button\[data-bb-chat-ui-mention-remove\]::after\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/);
  }
 }finally{f.stop();}
});
