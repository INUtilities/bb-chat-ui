import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { infoCardCss, cardSlot } from './info-card.ts';
import { composerInfoCss } from './composer-info.ts';
import { pillCss, pillStyle, referenceVariableStyle } from './pill.ts';
import { resolvedStyle } from './test-style.ts';

for (const device of [null, 'desktop']) {
  test(`approved desktop card scale uses independent content roles and centered close (${device})`, () => {
    const d = new JSDOM(`<html ${device ? `data-bb-chat-ui-root-device="${device}"` : ''}><head><style>${infoCardCss()}</style></head><body><section data-bb-chat-ui-card><header ${cardSlot.head}><span ${cardSlot.title}>Queued messages</span></header><p ${cardSlot.prose}>본문</p><span ${cardSlot.meta}>보조</span><div ${cardSlot.list}><button ${cardSlot.row}>행</button></div><button ${cardSlot.button}>액션</button><button ${cardSlot.close}>×</button></section></body></html>`);
    try {
      const get = (slot: string) => resolvedStyle(d.window.document.querySelector(`[${slot}]`)!);
      assert.equal(get(cardSlot.title).fontSize, '13px');
      assert.equal(get(cardSlot.title).lineHeight, '15px', '13/12 clips descenders; the approved clipping fallback is 15px');
      assert.equal(get(cardSlot.head).height, '30px');
      assert.equal(get(cardSlot.head).marginBottom, '10px');
      assert.equal(get(cardSlot.head).paddingRight, '34px');
      assert.equal(get(cardSlot.prose).fontSize, '11px');
      assert.equal(get(cardSlot.prose).lineHeight, '18px');
      assert.equal(get(cardSlot.meta).fontSize, '11px');
      assert.equal(get(cardSlot.meta).lineHeight, '18px');
      assert.equal(get(cardSlot.row).minHeight, '24px');
      assert.equal(get(cardSlot.row).padding, '4px');
      assert.equal(get(cardSlot.list).rowGap, '6px');
      assert.equal(d.window.getComputedStyle(d.window.document.documentElement).getPropertyValue('--bb-chat-ui-card-workflow-tail').trim(), '14px', 'next dot center 12 + peer gap 6 - dot radius 4');
      assert.equal(get(cardSlot.row).lineHeight, '14px');
      assert.equal(get(cardSlot.button).height, '24px');
      assert.equal(get(cardSlot.button).paddingLeft, '8px');
      const headCenter = 12 + Number.parseFloat(get(cardSlot.head).height) / 2;
      const closeCenter = Number.parseFloat(get(cardSlot.close).top) + Number.parseFloat(get(cardSlot.close).height) / 2;
      assert.ok(Math.abs(headCenter - closeCenter) <= 1, `${headCenter} vs ${closeCenter}`);
      assert.equal(get(cardSlot.close).top, '17px');
    } finally { d.window.close(); }
  });
  test(`desktop references expose size, left inset and remove tokens (${device})`, () => {
    const d = new JSDOM(`<html ${device ? `data-bb-chat-ui-root-device="${device}"` : ''}><head><style>${pillCss()} .pill { ${referenceVariableStyle} } button { ${pillStyle.remove} }</style></head><body><span class="pill">인용<button>×</button></span></body></html>`);
    try {
      const s = resolvedStyle(d.window.document.querySelector('.pill')!);
      assert.equal(s.height, '22px'); assert.equal(s.minHeight, '22px'); assert.equal(s.maxHeight, '22px');
      assert.equal(s.fontSize, '13px'); assert.equal(s.paddingLeft, '10px');
      assert.equal(d.window.getComputedStyle(d.window.document.documentElement).getPropertyValue('--bb-chat-ui-pill-reference-pad-left').trim(), '10px');
      assert.equal(resolvedStyle(d.window.document.querySelector('button')!).width, '16px');
    } finally { d.window.close(); }
  });
}

test('native info stack inherits the shared sibling gap instead of redefining it', () => {
  const d = new JSDOM(`<html><head><style>${composerInfoCss}</style></head><body><div data-bb-chat-ui-info-stack></div></body></html>`);
  try {
    const root = d.window.document.documentElement, stack = d.window.document.querySelector('[data-bb-chat-ui-info-stack]')!;
    assert.equal(d.window.getComputedStyle(root).getPropertyValue('--bb-chat-ui-info-row-gap').trim(), '6px');
    root.style.setProperty('--bb-chat-ui-info-row-gap', '11px');
    assert.equal(d.window.getComputedStyle(stack).getPropertyValue('--bb-chat-ui-info-row-gap').trim(), '11px', 'the stack must inherit root ownership');
  } finally { d.window.close(); }
});

test('approved phone card keeps readable roles and 32px touch actions on either viewport', () => {
  const d = new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head><style>${infoCardCss()}</style></head><body><section data-bb-chat-ui-card><header ${cardSlot.head}><span ${cardSlot.title}>대기 메시지</span></header><p ${cardSlot.prose}>본문</p><span ${cardSlot.meta}>보조</span><div ${cardSlot.list}><button ${cardSlot.row}>행</button></div><button ${cardSlot.button}>액션</button><button ${cardSlot.close}>×</button></section></body></html>`);
  try {
    for (const width of [390,1280]) {
      Object.defineProperty(d.window, 'innerWidth', {value:width,configurable:true});
      const get = (slot: string) => resolvedStyle(d.window.document.querySelector(`[${slot}]`)!);
      assert.equal(get(cardSlot.title).fontSize,'14px'); assert.equal(get(cardSlot.title).lineHeight,'18px');
      assert.equal(get(cardSlot.head).height,'32px'); assert.equal(get(cardSlot.head).marginBottom,'10px'); assert.equal(get(cardSlot.head).paddingRight,'34px');
      assert.equal(get(cardSlot.prose).fontSize,'12px'); assert.equal(get(cardSlot.prose).lineHeight,'18px');
      assert.equal(get(cardSlot.meta).fontSize,'12px'); assert.equal(get(cardSlot.meta).lineHeight,'18px');
      assert.equal(get(cardSlot.row).minHeight,'32px'); assert.equal(get(cardSlot.row).padding,'6px'); assert.equal(get(cardSlot.list).rowGap,'6px');
      assert.equal(get(cardSlot.row).fontSize,'13px'); assert.equal(get(cardSlot.row).lineHeight,'16px');
      assert.equal(get(cardSlot.button).height,'32px'); assert.equal(get(cardSlot.button).paddingLeft,'10px');
      assert.equal(get(cardSlot.close).height,'24px'); assert.equal(get(cardSlot.close).top,'16px');
      const headCenter = 12 + Number.parseFloat(get(cardSlot.head).height)/2, closeCenter = Number.parseFloat(get(cardSlot.close).top)+12;
      assert.ok(Math.abs(headCenter-closeCenter)<=1);
      const root = d.window.getComputedStyle(d.window.document.documentElement);
      assert.equal(root.getPropertyValue('--bb-chat-ui-card-workflow-top').trim(),'18px');
      assert.equal(root.getPropertyValue('--bb-chat-ui-card-workflow-tail').trim(),'16px');
    }
  } finally {d.window.close();}
});

test('phone reference is 24px with a layout-neutral margin and independent removal size', () => {
  const d = new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head><style>${pillCss()} .pill { ${referenceVariableStyle} } html[data-bb-chat-ui-root-device="phone"] .pill { ${pillStyle.referencePhone} } button { ${pillStyle.removePhone} }</style></head><body><span class="pill">인용<button>×</button></span></body></html>`);
  try {
    const s=resolvedStyle(d.window.document.querySelector('.pill')!);
    assert.equal(s.height,'24px');assert.equal(s.fontSize,'14px');assert.equal(s.paddingLeft,'12px');
    assert.equal(s.marginTop,'-2px');assert.equal(s.marginBottom,'-2px');
    assert.equal(resolvedStyle(d.window.document.querySelector('button')!).width,'18px');
  } finally {d.window.close();}
});
