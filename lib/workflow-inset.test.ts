import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {composerInfoCss} from './composer-info.ts';
import {resolvedStyle} from './test-style.ts';

test('inactive workflow connector follows the shared row inset and dot center', () => {
 const d=new JSDOM(`<html><head><style>${composerInfoCss}</style></head><body><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack><section data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="workflow"><section role="region"><div data-detail-scroll-area><div class="flex-col gap-1.5"><div class="flex items-center gap-1.5">Inactive</div><div>Next</div></div></div></section></section></div></div></body></html>`);
 try {
  resolvedStyle(d.window.document.querySelector('.items-center')!);
  const rule=Array.from(d.window.document.styleSheets[0].cssRules).find(r=>'selectorText' in r&&r.selectorText.endsWith('[class~="items-center"]:not(:last-child)::after')) as CSSStyleRule;
  assert.ok(rule);
  assert.equal(rule.style.left,'calc(11px)','row padding + ordinary connector left puts its center on the same dot');
 } finally {d.window.close();}
});
