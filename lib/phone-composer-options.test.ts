import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { phoneDrawerCss } from './phone-sheet.ts';
import { composerMenuGlassCss } from './composer-menu-glass.ts';
import { resolvedStyle } from './test-style.ts';

const model = `<div id="model" role="dialog" data-bb-portaled-overlay data-persistent-drawer-content data-bb-plugin="bb-chat-ui" data-bb-chat-ui-model-menu>
  <div data-persistent-drawer-handle></div><h2 class="sr-only">Model</h2>
  <div class="flex"><div class="bg-background"><button title="Codex">Codex</button></div>
    <div class="search border-b"><div class="relative"><svg></svg><input id="search" class="text-xs" aria-label="Search models" role="combobox"></div></div>
    <div><div class="overflow-y-auto"><div id="heading" class="sticky text-xs">Model</div><button id="option" class="text-xs" role="option" aria-selected="true">Long model name</button><button id="disabled" class="text-xs" role="option" disabled>Unavailable model</button><button id="plain" class="hover:bg-state-hover">Provider model without listbox</button></div>
      <div data-bb-chat-ui-effort><div data-effort-caption><span id="effort-heading">Reasoning</span><output id="effort-value">High</output></div></div>
      <button id="auxiliary" class="hover:bg-state-hover" style="min-height:24px;padding:4px 12px">Details</button>
    </div>
  </div>
</div>`;
const host = `.text-xs {font-size:12px;line-height:16px;font-weight:400} .search {padding:4px 6px} input{height:28px;border-radius:6px} [role=option]{padding:8px} .sticky{font-weight:500} [role=menuitem]{font-size:12px;line-height:16px;padding:8px} .menu-body{padding:8px;gap:2px} [disabled]{opacity:.5} .other{font-size:12px;line-height:16px;padding:3px}`;

for (const device of ['phone','desktop']) test(`composer option content uses shared phone roles without changing desktop or foreign drawers (${device})`, () => {
 const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${device}"><head><style>${host}${composerMenuGlassCss}${phoneDrawerCss()}</style></head><body>${model}
 <div id="foreign" data-persistent-drawer-content data-bb-plugin="other"><button class="other" role="option">Other</button></div>
 <div id="desktop-menu" data-bb-portaled-overlay data-bb-chat-ui-model-menu role="dialog"><input class="text-xs" aria-label="Search models"></div>
 </body></html>`);
 try {
  const d=dom.window.document,s=(id:string)=>resolvedStyle(d.getElementById(id)!);
  assert.equal(s('option').fontSize,device==='phone'?'14px':'12px');
  assert.equal(s('option').lineHeight,device==='phone'?'20px':'16px');
  assert.equal(s('option').fontWeight,'400');assert.equal(s('option').borderRadius,device==='phone'?'14px':'10px');
  assert.equal(s('search').fontSize,device==='phone'?'16px':'12px');
  assert.equal(s('search').lineHeight,device==='phone'?'24px':'16px');
  assert.equal(s('search').height,device==='phone'?'40px':'28px');
  assert.equal(s('heading').fontSize,device==='phone'?'13px':'12px');
  assert.equal(s('heading').fontWeight,device==='phone'?'600':'500');
  if(device==='phone'){
   assert.equal(s('plain').fontSize,'14px');assert.equal(s('plain').minHeight,'36px');
   assert.equal(s('option').minHeight,'36px');assert.equal(s('option').padding,'8px');
   assert.equal(s('effort-heading').fontSize,'13px');assert.equal(s('effort-heading').fontWeight,'600');
   assert.equal(s('effort-value').fontSize,'14px');
   assert.equal(s('auxiliary').padding,'4px 12px');
   assert.equal(s('search').borderRadius,'0px');
   assert.equal(resolvedStyle(d.querySelector('#model > div.flex')!).paddingLeft,'16px');
  }
  assert.equal(d.getElementById('option')!.getAttribute('aria-selected'),'true');
  assert.equal((d.getElementById('disabled') as HTMLButtonElement).disabled,true);assert.equal(s('disabled').opacity,'0.5');
  assert.equal(resolvedStyle(d.querySelector('#foreign button')!).padding,'3px');
  assert.equal(resolvedStyle(d.querySelector('#foreign button')!).fontSize,'12px');
  assert.equal(resolvedStyle(d.querySelector('#desktop-menu input')!).fontSize,'12px');
 } finally {dom.window.close();}
});

for(const kind of ['pr','send','prompt']) test(`phone ${kind} actions retain native buttons with shared content inset and row metrics`,()=>{
 const mark=kind==='pr'?'data-bb-chat-ui-pr-menu':kind==='send'?'data-bb-plugin="bb-chat-ui"':'';
 const label=kind==='send'?'aria-label="Send options"':kind==='prompt'?'aria-label="Prompt actions"':'';
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head><style>${host}${composerMenuGlassCss}${phoneDrawerCss()}</style></head><body><div data-persistent-drawer-content ${mark}><div data-persistent-drawer-handle></div><h2 class="sr-only">Menu</h2><div id="list" class="menu-body overflow-y-auto" ${label}><button id="action" role="menuitem">Action</button></div></div></body></html>`);
 try {
  const d=dom.window.document,b=d.getElementById('action')!,s=resolvedStyle(b),list=resolvedStyle(d.getElementById('list')!);let calls=0;b.addEventListener('click',()=>calls++);
  assert.equal(s.fontSize,'14px');assert.equal(s.lineHeight,'20px');assert.equal(s.minHeight,'36px');assert.equal(s.padding,'8px');assert.equal(s.borderRadius,'14px');
  assert.equal(list.paddingLeft,'16px');assert.equal(list.paddingRight,'16px');assert.equal(list.gap,'0px');
  b.click();assert.equal(calls,1);
 }finally{dom.window.close();}
});

// 확인·문서 화면에는 메뉴 행 padding과 최소 높이를 강요하지 않는다.
test('phone model confirmation without model controls keeps its native geometry',()=>{
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head><style>${composerMenuGlassCss}${phoneDrawerCss()}</style></head><body><div role="dialog" data-bb-portaled-overlay data-persistent-drawer-content data-bb-chat-ui-model-menu><h2>Handoff to new thread</h2><div id="confirmation" style="padding:12px"><p>Confirm the provider change.</p><button id="confirm" class="hover:bg-state-hover" style="min-height:24px;padding:4px 12px">Continue</button></div></div></body></html>`);
 try{const d=dom.window.document,s=resolvedStyle(d.getElementById('confirm')!);assert.equal(s.minHeight,'24px');assert.equal(s.padding,'4px 12px');assert.equal(resolvedStyle(d.getElementById('confirmation')!).padding,'12px');}finally{dom.window.close();}
});
