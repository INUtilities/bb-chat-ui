import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolvedStyle } from "./test-style.ts";
import { CARD, cardSlot, infoCardCss, createCardClose, createCardAction, createCardHead, NESTED_SURFACE_EXEMPT } from "./info-card.ts";

function page(body: string, device: string | null = "desktop") {
  const dom = new JSDOM(`<html class="dark" ${device ? `data-bb-chat-ui-root-device="${device}"` : ""}><head><style>${infoCardCss()}</style></head><body>${body}</body></html>`, { pretendToBeVisual: true });
  return { dom, document: dom.window.document, style: resolvedStyle };
}

for (const device of ["desktop", "phone"]) {
const phone = device === "phone";
const makePage = (body: string) => page(body, device);

test(`one card face: frost once, 18px radius, 16px 24px padding, no border (${device})`, () => {
  const f = makePage(`<section ${CARD}><p>body</p></section>`);
  const card = f.style(f.document.querySelector(`[${CARD}]`)!);
  assert.equal(card.padding, "12px 16px");
  assert.equal(card.borderRadius, "18px");
  assert.equal(card.borderTopWidth, "0px");
  assert.equal(card.position, "relative", "the close button anchors to the card");
  assert.match(card.getPropertyValue("backdrop-filter"), /blur\(14px\) saturate\(1\.25\)/);
  assert.match(card.backgroundColor + card.background, /var\(--bb-chat-ui-card-face\)/);
  f.dom.window.close();
});

test(`the device head reserves the close gutter and applies the approved close offset (${device})`, () => {
  const f = makePage(`<section ${CARD}></section>`);
  const card = f.document.querySelector<HTMLElement>(`[${CARD}]`)!;
  const close = createCardClose(f.document, "Goal 닫기");
  const action = createCardAction(f.document, "패널 열기", "M3 3h6");
  const head = createCardHead(f.document, { title: "Goal", icon: null, actions: [action] });
  card.append(head, close);
  const s = f.style(head);
  assert.equal(s.display, "flex");
  assert.equal(s.alignItems, "center");
  assert.equal(s.minHeight, phone ? "32px" : "30px");
  assert.equal(s.height, phone ? "32px" : "30px", "a larger touch action must not move the common title line");
  assert.equal(s.paddingRight, "34px", "24px close + 8px gap");
  assert.equal(s.fontSize, phone ? "14px" : "13px");
  assert.equal(s.lineHeight, phone ? "18px" : "15px");
  assert.equal(s.fontWeight, "600");
  const title = head.querySelector(`[${cardSlot.title}]`)!;
  assert.equal(title.textContent, "Goal");
  assert.equal(f.style(title).textOverflow, "ellipsis");
  assert.equal(f.style(title).whiteSpace, "nowrap");
  const c = f.style(close);
  assert.equal(c.position, "absolute");
  assert.equal(c.top, phone ? "15.5px" : "17px", "phone close sits 0.5px above the title center; desktop stays centered");
  assert.equal(c.right, phone ? "8px" : "10px");
  assert.equal(c.width, phone ? "24px" : "20px");
  assert.equal(c.height, phone ? "24px" : "20px");
  assert.equal(close.getAttribute("aria-label"), "Goal 닫기");
  assert.equal(close.title, "Goal 닫기");
  const cross = close.querySelector('svg[data-bb-chat-ui-card-close-icon]');
  assert.ok(cross, "close uses geometric strokes rather than font metrics");
  assert.equal(cross.getAttribute("viewBox"), "0 0 12 12");
  assert.equal(cross.getAttribute("aria-hidden"), "true");
  assert.equal(cross.getAttribute("focusable"), "false");
  assert.equal(cross.getAttribute("stroke"), "currentColor");
  assert.equal(cross.getAttribute("stroke-width"), "1.5");
  assert.equal(cross.getAttribute("stroke-linecap"), "round");
  assert.equal(cross.querySelector("path")?.getAttribute("d"), "M2 2l8 8M10 2l-8 8");
  assert.equal(close.textContent, "", "the cross does not depend on the platform font");
  const glyph = f.style(cross);
  assert.equal(glyph.width, phone ? "9px" : "8px");
  assert.equal(glyph.height, phone ? "9px" : "8px");
  assert.equal(glyph.display, "block");
  assert.equal(c.alignItems, "center");
  assert.equal(c.justifyContent, "center");
  const a = f.style(action);
  assert.equal(a.width, phone ? "24px" : "20px");
  assert.equal(a.height, phone ? "24px" : "20px");
  assert.equal(a.borderRadius, "999px");
  assert.equal(a.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(action.getAttribute("aria-label"), "패널 열기");
  assert.equal(action.title, "패널 열기");
  f.dom.window.close();
});

test(`a compact navigation card has one borderless 40px face and a full-card primary target (${device})`, () => {
  const f = makePage(`<section ${CARD} data-bb-chat-ui-card-layout="single-row"><button ${cardSlot.row} data-bb-chat-ui-card-navigation>Parent thread</button></section>`);
  const card = f.document.querySelector(`[${CARD}]`)!;
  const close = createCardClose(f.document, "Parent 닫기");
  card.append(close);
  assert.equal(f.style(card).padding, "0px", "the card has no padding outside its click target");
  assert.equal(f.style(card).minHeight, phone ? "40px" : "36px");
  assert.doesNotMatch(f.style(card).boxShadow,/inset/,"the compact face has no inset edge");
  const row=card.querySelector(`[${cardSlot.row}]`)!;
  assert.equal(f.style(row).width, "100%", "the primary target fills the card");
  assert.equal(f.style(row).minHeight,phone?"40px":"36px");
  assert.equal(f.style(row).fontSize,phone?"14px":"13px","the single-row card has a title without a separate heading");
  assert.equal(f.style(row).lineHeight,phone?"18px":"15px");
  assert.equal(f.style(row).paddingLeft,phone?"16px":"12px","the leading content matches the close glyph's visible inset");
  assert.equal(f.style(row).paddingRight,phone?"40px":"32px","text leaves room for the separate close target");
  assert.equal(f.style(row).borderTopWidth,"0px");
  assert.equal(f.style(row).boxShadow,"none");
  assert.equal(f.style(close).top, "8px");
  assert.equal(f.style(close).right, phone ? "8px" : "6px");
  const hitRule=[...f.document.styleSheets].flatMap(s=>[...s.cssRules]).find(r=>'selectorText' in r&&r.selectorText.endsWith('[data-bb-chat-ui-card-navigation]::before')) as CSSStyleRule;
  assert.ok(hitRule,"a primary action covers the face without wrapping sibling controls");
  assert.equal(hitRule.style.position,"absolute");
  assert.equal(hitRule.style.inset,"0px");
  f.dom.window.close();
});

test(`a heading-only card leaves no body gap beneath its title (${device})`, () => {
  const f = makePage(`<section ${CARD} data-bb-chat-ui-card-layout="heading-only"></section>`);
  const card = f.document.querySelector(`[${CARD}]`)!;
  const head = createCardHead(f.document, { title: 'Pull request', icon: null });
  card.append(head, createCardClose(f.document, 'PR 닫기'));
  assert.equal(f.style(head).marginBottom, '0px');
  f.dom.window.close();
});

test(`state actions sit at the head end while their short label retains the common type (${device})`, () => {
  const f=makePage(`<section ${CARD} data-bb-chat-ui-card-layout="with-actions"><header ${cardSlot.head}>Fallback</header><button data-bb-chat-ui-card-button data-bb-chat-ui-card-end-action aria-label="Dismiss model fallback">Dismiss<span data-bb-chat-ui-card-button-label>해제</span></button><p ${cardSlot.body}>Provider transition</p></section>`);
  const card=f.document.querySelector(`[${CARD}]`)!,head=card.querySelector('header')!,action=card.querySelector('button')!,label=action.querySelector('span')!;
  assert.equal(f.style(card).gridTemplateAreas,'"heading actions close" "body body body"');
  assert.equal(f.style(head).paddingRight,'0px','the action and close columns reserve the end gutter');
  assert.equal(f.style(action).gridArea,'actions');
  assert.equal(f.style(action).marginLeft,'auto');
  assert.equal(f.style(action).fontSize,'0px','original direct native text does not duplicate the short label');
  assert.equal(f.style(label).fontSize,phone?'13px':'12px');
  assert.equal(f.style(label).lineHeight,phone?'16px':'14px');
  f.dom.window.close();
});

test(`the common body removes inherited edge insets while keeping row padding (${device})`, () => {
  const f = makePage(`<section ${CARD}><div data-bb-chat-ui-card-body style="padding:8px 0 10px"><p style="margin:6px 0">Text</p><div ${cardSlot.row}>Row</div></div></section>`);
  const body = f.document.querySelector('[data-bb-chat-ui-card-body]')!;
  assert.equal(f.style(body).paddingTop, '0px');
  assert.equal(f.style(body).paddingBottom, '0px');
  assert.equal(f.style(body.querySelector('p')!).marginTop, '0px');
  assert.equal(f.style(body.querySelector(`[${cardSlot.row}]`)!).padding, phone ? '6px' : '4px');
  f.dom.window.close();
});

test(`card type has three levels for long prose, list names and headings across host mobile utilities (${device})`, () => {
  const f=makePage(`<section ${CARD}><header ${cardSlot.head}><span ${cardSlot.title} class="text-xs" data-heading>Goal</span></header><div ${cardSlot.body}><p class="text-xs leading-relaxed" data-prose>Goal objective <strong class="text-sm" data-inline>emphasis</strong></p><div data-bb-chat-ui-card-prose><span class="text-xs" data-prose>User message</span></div><div ${cardSlot.row}><span class="text-xs" data-list>Workflow phase</span></div><span class="text-sm" data-list>Notice</span><span class="text-2xs leading-none">Count</span><p ${cardSlot.meta} class="text-xs">Usage</p><pre><code class="text-xs">code</code></pre><div contenteditable="true"><p class="text-xs">draft</p><span class="text-2xs" data-editor-caption>Editor caption</span></div></div></section><p class="text-xs" data-outside>Native paragraph</p>`);
  const host=f.document.createElement('style');
  host.textContent='.text-xs { font-size:14px; line-height:20px; } .text-sm { font-size:15px; line-height:22px; } .text-2xs { font-size:10px; line-height:14px; } .leading-none { line-height:1; } .leading-relaxed { line-height:1.625; }';
  f.document.head.prepend(host);
  for(const node of f.document.querySelectorAll('[data-prose],[data-inline],[data-list],[data-heading]')){
    const s=f.style(node),heading=node.hasAttribute('data-heading'),list=node.hasAttribute('data-list');
    assert.equal(s.fontSize,heading?(phone?'14px':'13px'):list?(phone?'13px':'12px'):(phone?'12px':'11px'),`${node.textContent}: the content role determines the size`);
    assert.equal(s.lineHeight,heading?(phone?'18px':'15px'):list?(phone?'16px':'14px'):'18px');
  }
  assert.equal(f.style(f.document.querySelector(`[${cardSlot.meta}]`)!).fontSize,phone?'12px':'11px');
  const caption=f.style(f.document.querySelector('span.leading-none')!);
  assert.equal(caption.fontSize,phone?'12px':'11px','counts use the secondary scale, regardless of the host utility');
  assert.equal(caption.lineHeight,'18px');
  assert.equal(f.style(f.document.querySelector('[data-editor-caption]')!).fontSize,'10px','editor captions keep their own type');
  for(const selector of ['code','[contenteditable] p','[data-outside]']){
    const s=f.style(f.document.querySelector(selector)!);
    assert.equal(s.fontSize,'14px',`${selector}: typography outside the main card text stays native`);
    assert.equal(s.lineHeight,'20px');
  }
  f.dom.window.close();
});

test(`text actions are hairline pills without a second surface (${device})`, () => {
  const f = makePage(`<section ${CARD}><div ${cardSlot.head}><button ${cardSlot.button}>Goal 해제</button></div></section>`);
  const s = f.style(f.document.querySelector(`[${cardSlot.button}]`)!);
  assert.equal(s.fontSize, phone ? "13px" : "12px", "text actions use the same readable size as the main content");
  assert.equal(s.lineHeight, phone ? "16px" : "14px");
  assert.equal(s.height, phone ? "32px" : "24px");
  assert.equal(s.borderRadius, "999px");
  assert.equal(s.borderTopWidth, "1px");
  assert.equal(s.borderTopStyle, "solid");
  assert.equal(s.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(s.boxShadow, "none");
  assert.equal(s.getPropertyValue("backdrop-filter"), "none");
  f.document.documentElement.setAttribute("data-bb-chat-ui-root-hit-target", "large");
  assert.equal(f.style(f.document.querySelector(`[${cardSlot.button}]`)!).height, phone ? "32px" : "24px", "a finger keeps the 32px hit target");
  f.dom.window.close();
});

test(`an external action follows the title without an expanding title spacer (${device})`, () => {
  const f = makePage(`<section ${CARD}></section>`);
  const card = f.document.querySelector(`[${CARD}]`)!;
  const action = createCardAction(f.document, "패널 열기", "M3 3h6");
  const head = createCardHead(f.document, { title: "Code Diff", icon: null, actions: [action] });
  card.append(head);
  const title = head.querySelector(`[${cardSlot.title}]`)!;
  assert.equal(title.nextElementSibling, action);
  assert.equal(f.style(title).flexGrow, "0", "short titles leave the action beside their text");
  assert.equal(f.style(title).flexShrink, "1", "long titles still shrink before the action and close");
  f.dom.window.close();
});

test(`list rows share one geometry and paint only on hover (${device})`, () => {
  const f = makePage(`<section ${CARD}><div ${cardSlot.list}><button ${cardSlot.row}>a</button><div ${cardSlot.row}>b</div></div></section>`);
  const list = f.style(f.document.querySelector(`[${cardSlot.list}]`)!);
  assert.equal(list.display, "flex");
  assert.equal(list.flexDirection, "column");
  assert.equal(list.rowGap, "6px");
  for (const row of f.document.querySelectorAll(`[${cardSlot.row}]`)) {
    const s = f.style(row);
    assert.equal(s.minHeight, phone ? "32px" : "24px");
    assert.equal(s.padding, phone ? "6px" : "4px");
    assert.equal(s.borderRadius, phone ? "10px" : "8px");
    assert.equal(s.marginLeft, phone ? "-6px" : "-4px");
    assert.equal(s.marginRight, phone ? "-6px" : "-4px");
    assert.equal(s.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(s.boxShadow, "none");
  }
  assert.ok(infoCardCss().includes(`[${cardSlot.row}]:is(:hover, :focus-visible, :focus-within) { background-color:color-mix(in oklab,var(--foreground) 6%,transparent) !important; }`), "rows paint 6% only on hover");
  assert.equal(f.style(f.document.querySelector(`button[${cardSlot.row}]`)!).cursor, "pointer");
  assert.equal(f.style(f.document.querySelector(`div[${cardSlot.row}]`)!).cursor, "auto", "decorative rows never gain a pointer");
  f.dom.window.close();
});

test(`plain buttons and links inside a card never paint a second surface (${device})`, () => {
  const f = makePage(`<section ${CARD}><button class="glassy">native</button><a href="#">link</a><input value="x"></section>`);
  const extra = f.document.createElement("style");
  extra.textContent = `.glassy { background:red; box-shadow:0 1px 2px black; backdrop-filter:blur(4px); }`;
  f.document.head.prepend(extra);
  for (const node of f.document.querySelectorAll("button, a")) {
    const s = f.style(node);
    assert.equal(s.backgroundColor, "rgba(0, 0, 0, 0)", node.outerHTML);
    assert.equal(s.boxShadow, "none", node.outerHTML);
    assert.equal(s.getPropertyValue("backdrop-filter"), "none", node.outerHTML);
  }
  assert.ok(NESTED_SURFACE_EXEMPT.includes("input"), "inputs keep their own field");
  f.dom.window.close();
});

test(`meta and section labels share one secondary size (${device})`, () => {
  const f = makePage(`<section ${CARD}><h4 ${cardSlot.section}>커밋</h4><span ${cardSlot.meta}>gpt · high</span></section>`);
  for (const node of f.document.querySelectorAll(`[${cardSlot.section}], [${cardSlot.meta}]`)) {
    const s = f.style(node);
    assert.equal(s.fontSize, phone ? "12px" : "11px");
    assert.equal(s.lineHeight, "18px");
    assert.equal(s.fontWeight, "400");
    assert.equal(s.color, "var(--subtle-foreground)");
  }
  f.dom.window.close();
});

test(`a custom root reuses the anatomy without the default attribute (${device})`, () => {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${device}"><head><style>${infoCardCss("[data-demo-card]")}</style></head><body><div data-demo-card><div ${cardSlot.head}>t</div></div></body></html>`);
  const s = resolvedStyle(dom.window.document.querySelector("[data-demo-card]")!);
  assert.equal(s.borderRadius, "18px");
  assert.equal(s.padding, "12px 16px");
  dom.window.close();
});

}

// Changing viewport must not change the device scale, and missing device defaults to desktop.
test("desktop card type steps down via root tokens while phone and geometry stay unchanged", () => {
  for (const device of [null, 'desktop', 'phone']) {
    const f = page(`<section ${CARD}><header ${cardSlot.head}><span ${cardSlot.title}>Title</span></header><div ${cardSlot.row}>List</div><p ${cardSlot.prose}>Body</p><span ${cardSlot.meta}>Meta</span><button ${cardSlot.button}>Action</button><button ${cardSlot.close}>×</button></section><section ${CARD} ${cardSlot.layout}="single-row"><a ${cardSlot.row} ${cardSlot.navigation}>Parent</a></section>`);
    try {
      f.document.documentElement.removeAttribute('data-bb-chat-ui-root-device');
      if (device) f.document.documentElement.setAttribute('data-bb-chat-ui-root-device', device);
      const phone = device === 'phone';
      for (const width of [390, 1280]) {
        Object.defineProperty(f.dom.window, 'innerWidth', { value: width, configurable: true });
        const get = (selector: string) => resolvedStyle(f.document.querySelector(selector)!);
        const title = get(`[${cardSlot.title}]`), head = get(`[${cardSlot.head}]`), row = get(`[${cardSlot.row}]`), body = get(`[${cardSlot.prose}]`), meta = get(`[${cardSlot.meta}]`), action = get(`[${cardSlot.button}]`), close = get(`[${cardSlot.close}]`), single = get(`[${cardSlot.navigation}]`);
        assert.equal(title.fontSize, phone ? '14px' : '13px', `${device}/${width}: title`);
        assert.equal(title.lineHeight, phone ? '18px' : '15px');
        assert.equal(title.fontWeight, '600');
        assert.equal(single.fontSize, phone ? '14px' : '13px');
        assert.equal(single.lineHeight, phone ? '18px' : '15px');
        assert.equal(single.fontWeight, '400');
        assert.equal(row.fontSize, phone ? '13px' : '12px');
        assert.equal(action.fontSize, phone ? '13px' : '12px');
        assert.equal(meta.fontSize, phone ? '12px' : '11px');
        assert.equal(body.fontSize, phone ? '12px' : '11px');
        for (const style of [row, action]) assert.equal(style.lineHeight, phone ? '16px' : '14px');
        for (const style of [meta, body]) assert.equal(style.lineHeight, '18px');
        assert.equal(head.height, phone ? '32px' : '30px'); assert.equal(row.minHeight, phone ? '32px' : '24px'); assert.equal(row.padding, phone ? '6px' : '4px');
        assert.equal(action.height, phone ? '32px' : '24px'); assert.equal(close.width, phone ? '24px' : '20px'); assert.equal(close.height, phone ? '24px' : '20px');
        f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target', 'large');
        assert.equal(get(`[${cardSlot.button}]`).height, phone ? '32px' : '24px');
        f.document.documentElement.removeAttribute('data-bb-chat-ui-root-hit-target');
      }
    } finally { f.dom.window.close(); }
  }
});
