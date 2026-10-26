import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { injectPillStyles, pillCss, pillSlot, pillStyle, referenceVariableStyle, referencePhoneVariableStyle } from './pill.ts';
import { quotePillCss } from './quote-pill.ts';
import { userAttachmentsCss } from './user-attachments.ts';
import { composerInfoCss } from './composer-info.ts';

test('shared pill declarations preserve distinct reference, navigation and attachment geometry', () => {
  assert.match(pillStyle.reference, /height: 22px !important/);
  assert.match(pillStyle.referencePhone, /height: 24px !important/);
  assert.match(pillStyle.reference, /padding: 0px 12px 0px 10px !important/);
  assert.match(pillStyle.referencePhone, /padding: 0px 14px 0px 12px !important/);
  assert.ok(quotePillCss().includes(referenceVariableStyle));
  assert.ok(quotePillCss().includes(referencePhoneVariableStyle));
  assert.ok(composerInfoCss.includes(pillStyle.navigation));
  assert.ok(userAttachmentsCss().includes(pillStyle.attachment));
  assert.ok(userAttachmentsCss().includes(pillStyle.attachmentPhone));
  assert.equal(pillSlot.remove, 'data-bb-chat-ui-mention-remove');
  assert.equal(pillSlot.wide, 'data-bb-chat-ui-mention-wide');
});

test('shared device variables are installed once and enlarge references for phone at every viewport', () => {
  const dom = new JSDOM('<html><head></head><body></body></html>');
  const doc = dom.window.document, root = doc.documentElement;
  const stop = injectPillStyles(doc), other = injectPillStyles(doc);
  try {
    assert.equal(doc.querySelectorAll('#bb-chat-ui-pill').length, 1);
    assert.equal(doc.querySelector('#bb-chat-ui-pill')!.textContent, pillCss());
    const size = () => dom.window.getComputedStyle(root).getPropertyValue('--bb-chat-ui-pill-reference-icon').trim();
    assert.equal(size(), '14px');
    root.setAttribute('data-bb-chat-ui-root-device', 'phone');
    root.setAttribute('data-bb-chat-ui-root-viewport', 'narrow');
    assert.equal(size(), '16px');
    root.setAttribute('data-bb-chat-ui-root-viewport', 'wide');
    assert.equal(size(), '16px');
    root.setAttribute('data-bb-chat-ui-root-device', 'desktop');
    root.setAttribute('data-bb-chat-ui-root-viewport', 'narrow');
    assert.equal(size(), '14px');
    stop(); assert.ok(doc.querySelector('#bb-chat-ui-pill'), 'another owner still uses the sheet');
    other(); assert.equal(doc.querySelector('#bb-chat-ui-pill'), null);
  } finally { stop(); other(); dom.window.close(); }
});
