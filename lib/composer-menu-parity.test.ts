import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {composerInfoCss} from './composer-info.ts';
import {composerMenuGlassCss} from './composer-menu-glass.ts';
import {resolvedStyle} from './test-style.ts';

for(const phone of [false,true]) test(`PR method rows match native prompt actions without changing targets (${phone?'phone':'desktop'})`,()=>{
 const host=`.content {padding:${phone?'8px':'4px'}} .item {padding:${phone?'8px':'5px 8px'};border-radius:4px;font-size:${phone?'14px':'12px'};line-height:${phone?'20px':'16px'}} .item:focus,.item[data-last-hovered]{background:var(--state-hover)} .drawer{border-width:1px;border-style:solid;border-color:var(--border);padding:0} .unrelated{padding:2px;border-radius:3px}`;
 const prompt=phone?'<div class="drawer" data-persistent-drawer-content><div id="prompt" class="content overflow-y-auto" aria-label="Prompt actions"><button type="button" role="menuitem" class="item">Attach files</button></div></div>':'<div id="prompt" class="content" data-bb-portaled-overlay role="menu" aria-label="Prompt actions"><div tabindex="-1" role="menuitem" class="item">Attach files</div></div>';
 const pr=phone?'<div id="pr-face" class="drawer" data-bb-chat-ui-pr-menu data-persistent-drawer-content role="dialog"><div id="pr" class="content overflow-y-auto"><button type="button" role="menuitem" class="item">Merge</button></div></div>':'<div id="pr-face"><div id="pr" class="content" data-bb-chat-ui-pr-menu role="menu"><div tabindex="-1" role="menuitem" class="item">Merge</div></div></div>';
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="${phone?'phone':'desktop'}"><head><style>${host}${composerInfoCss}${composerMenuGlassCss}</style></head><body>${prompt}${pr}<div class="unrelated" role="menu"><button class="unrelated" role="menuitem">Other menu</button></div></body></html>`,{pretendToBeVisual:true});
 try{
  const d=dom.window.document,body=(id:string)=>d.getElementById(id)!,row=(id:string)=>body(id).querySelector<HTMLElement>('[role=menuitem]')!;
  for(const id of ['prompt','pr']){
   const c=resolvedStyle(body(id)),r=resolvedStyle(row(id));
   assert.equal(c.padding,phone?'8px':'4px',id+' menu content inset');
   assert.equal(r.padding,phone?'8px':'5px 8px',id+' row padding');
   assert.equal(r.borderRadius,phone?'4px':'10px',id+' hover corners');
   assert.equal(parseFloat(r.lineHeight)+parseFloat(r.paddingTop)+parseFloat(r.paddingBottom),phone?36:26,id+' native row height');
   if(phone){const face=resolvedStyle(body(id).parentElement!);assert.equal(parseFloat(face.borderLeftWidth||'0')+parseFloat(face.paddingLeft)+parseFloat(c.paddingLeft),9,id+' hover inset from drawer face');}
   row(id).focus();assert.equal(resolvedStyle(row(id)).background,'var(--state-hover)',id+' native focus paint');
  }
  assert.equal(resolvedStyle(d.querySelector('.unrelated [role=menuitem]')!).padding,'2px');
  assert.equal(resolvedStyle(d.querySelector('.unrelated [role=menuitem]')!).borderRadius,'3px');
 } finally {dom.window.close();}
});
