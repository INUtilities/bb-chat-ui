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
