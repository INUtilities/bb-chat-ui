import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { composerInfoCss } from './composer-info.ts';
import { queuedMessagesCss } from './queued-messages.ts';
import { resolvedStyle } from './test-style.ts';

test('device card density keeps phone targets and compacts desktop geometry without viewport rules', () => {
  for (const phone of [false,true]) {
    const dom=new JSDOM(`<html data-bb-chat-ui-root-device="${phone?'phone':'desktop'}"><head><style>${composerInfoCss}${queuedMessagesCss}</style></head><body><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack>
      <section data-bb-chat-ui-card data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="goal" id="card"><header data-bb-chat-ui-card-head><span data-bb-chat-ui-card-title>Title</span></header><button data-bb-chat-ui-card-close>×</button><button data-bb-chat-ui-card-action><svg/></button><button data-bb-chat-ui-card-button>Action</button><div data-bb-chat-ui-card-row>Row</div></section>
      <section data-bb-chat-ui-card data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="parent" data-bb-chat-ui-card-layout="single-row" id="single"><a data-bb-chat-ui-card-row data-bb-chat-ui-card-navigation>Parent</a><button data-bb-chat-ui-card-close>×</button></section>
      <section aria-label="Queued messages" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="queue"><li data-queued-message-row><div class="flex"><div class="min-w-0"><span class="truncate">Message</span></div><div data-queued-message-actions><button aria-label="Edit queued message 1"><svg/></button></div></div></li></section>
      <section data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="diff"><div data-bb-chat-ui-info-diff-commits><div data-bb-chat-ui-info-diff-commit><span data-bb-chat-ui-info-diff-graph><svg/></span><code>Commit</code></div></div></section>
    <div data-bb-chat-ui-info-bar><button data-bb-chat-ui-info-trigger="goal">Goal</button></div><div data-bb-chat-ui-pr-menu style="padding:8px"><button style="padding:6px 12px">Merge</button></div></div></div></body></html>`);
    const d=dom.window.document, css=(s:string)=>resolvedStyle(d.querySelector(s)!);
    try {
      for (const width of [390,1280]) {
        Object.defineProperty(dom.window,'innerWidth',{value:width,configurable:true});
        assert.equal(css('[data-bb-chat-ui-info-trigger]').height,'32px');
        assert.equal(css('[data-bb-chat-ui-pr-menu]').padding,'12px 16px');
        assert.equal(css('[data-bb-chat-ui-pr-menu] button').padding,'6px 12px');
        assert.equal(css('#card').padding,'12px 16px');
        assert.equal(css('#card header').height,phone?'28px':'24px');
        assert.equal(css('#card header').marginBottom,phone?'8px':'6px');
        assert.equal(css('#card header').paddingRight,phone?'32px':'26px');
        assert.equal(css('#card [data-bb-chat-ui-card-close]').width,phone?'24px':'20px');
        assert.equal(css('#card [data-bb-chat-ui-card-close]').top,'14px');
        assert.equal(css('#card [data-bb-chat-ui-card-close]').right,phone?'8px':'10px');
        assert.equal(css('#card [data-bb-chat-ui-card-action]').width,phone?'24px':'20px');
        assert.equal(css('#card [data-bb-chat-ui-card-action] svg').width,phone?'14px':'12px');
        assert.equal(css('#card [data-bb-chat-ui-card-button]').height,phone?'28px':'24px');
        assert.equal(css('#card [data-bb-chat-ui-card-button]').paddingLeft,phone?'12px':'10px');
        assert.equal(css('#card [data-bb-chat-ui-card-row]').minHeight,phone?'32px':'28px');
        assert.equal(css('#card [data-bb-chat-ui-card-row]').padding,phone?'8px':'6px');
        assert.equal(css('#card [data-bb-chat-ui-card-row]').borderRadius,phone?'10px':'8px');
        assert.equal(css('#card [data-bb-chat-ui-card-row]').marginLeft,phone?'-8px':'-6px');
        assert.equal(css('#single a').minHeight,phone?'40px':'36px');
        assert.equal(css('#single a').paddingLeft,phone?'16px':'12px');
        assert.equal(css('#single [data-bb-chat-ui-card-close]').top,'8px');
        assert.equal(css('#single [data-bb-chat-ui-card-close]').right,phone?'8px':'6px');
        assert.equal(css('[data-queued-message-actions] button svg').width,phone?'16px':'12px');
        assert.equal(css('[data-queued-message-row]').padding,phone?'6px 8px':'4px 6px');
        assert.equal(css('[data-queued-message-actions] button').width,phone?'32px':'20px');
        assert.equal(css('[data-bb-chat-ui-info-diff-graph]').marginTop,phone?'-8px':'-6px');
        d.documentElement.setAttribute('data-bb-chat-ui-root-hit-target','large');
        assert.equal(css('#card [data-bb-chat-ui-card-button]').height,phone?'32px':'24px');
        d.documentElement.removeAttribute('data-bb-chat-ui-root-hit-target');
      }
    } finally {dom.window.close();}
  }
});
