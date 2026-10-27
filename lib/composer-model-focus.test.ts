import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectComposerModelMenus} from './composer-model-menu.ts';

for(const prior of [null,'','keep'])test(`phone model sheet makes its composer inert and restores prior ${JSON.stringify(prior)}`,async()=>{
 const dom=new JSDOM(`<html data-bb-chat-ui-root-device="phone"><body><form data-promptbox><div contenteditable="true" role="textbox"></div><button aria-haspopup="dialog" aria-label="Provider, model and reasoning: Codex" aria-expanded="true"></button></form><div role="dialog" data-persistent-drawer-content data-state="open" aria-labelledby="title"><h2 id="title">Model</h2><input aria-label="Search models"><button role="switch">Fast mode</button></div></body></html>`,{pretendToBeVisual:true});
 const d=dom.window.document,composer=d.querySelector('form')!,card=d.querySelector('[role=dialog]')!;
 if(prior!==null)composer.setAttribute('inert',prior);
 const stop=injectComposerModelMenus(d);
 try{
  assert.ok(composer.hasAttribute('inert'),'native editor focus requests cannot reach the composer while its sheet is open');
  assert.equal(card.closest('[inert]'),null,'sheet controls stay interactive');
  const search=card.querySelector('input')!;search.focus();assert.equal(d.activeElement,search,'search can still open its keyboard');
  card.setAttribute('data-state','closed');await Promise.resolve();await Promise.resolve();
  assert.equal(composer.getAttribute('inert'),prior,'closing restores the existing inert state');
 }finally{stop();dom.window.close();}
});

test('desktop model popover does not make the composer inert',()=>{
 const dom=new JSDOM('<form data-promptbox><button aria-haspopup="dialog" aria-label="Provider, model and reasoning: Codex" aria-controls="menu" aria-expanded="true"></button></form><div id="menu" role="dialog" data-bb-portaled-overlay></div>',{pretendToBeVisual:true});
 const stop=injectComposerModelMenus(dom.window.document);
 try{assert.equal(dom.window.document.querySelector('form')!.hasAttribute('inert'),false);}finally{stop();dom.window.close();}
});

test('phone handoff picker binds on entry and reload, and releases inert when its drawer closes',async()=>{
 const dom=new JSDOM('<html data-bb-chat-ui-root-device="phone"><body><form data-promptbox><button aria-haspopup="dialog" aria-label="Provider, model and reasoning" aria-expanded="true"></button></form><div role="dialog" data-bb-portaled-overlay data-persistent-drawer-content data-state="open" aria-labelledby="handoff-title"><h2 id="handoff-title">Handoff to new thread</h2><div><button aria-label="Exit handoff">Cancel handoff</button></div><div>Reasoning</div><div role="radiogroup" aria-label="Reasoning"><button role="radio" aria-label="Low" aria-checked="true">Low</button><button role="radio" aria-label="High" aria-checked="false">High</button></div></div></body></html>',{pretendToBeVisual:true});
 const d=dom.window.document,c=d.querySelector('form')!,card=d.querySelector('[role=dialog]')!;
 let stop=injectComposerModelMenus(d);
 try{
  assert.ok(card.hasAttribute('data-bb-chat-ui-model-menu'),'handoff keeps the same model controls and frost treatment');
  assert.equal(c.hasAttribute('inert'),true,'the open picker still owns focus');
  assert.equal(card.querySelectorAll('input[aria-label=Effort]').length,1);
  stop();assert.equal(c.hasAttribute('inert'),false);
  stop=injectComposerModelMenus(d);assert.equal(card.querySelectorAll('input[aria-label=Effort]').length,1,'reloading handoff binds one gauge');
  card.setAttribute('data-state','closed');await Promise.resolve();await Promise.resolve();
  assert.equal(c.hasAttribute('inert'),false,'closing a handoff picker restores the composer');
  assert.equal(card.hasAttribute('data-bb-chat-ui-model-menu'),false);
 }finally{stop();dom.window.close();}
});
