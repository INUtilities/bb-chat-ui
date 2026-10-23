import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { CARD, cardSlot, infoCardCss, createCardClose, createCardAction, createCardHead, NESTED_SURFACE_EXEMPT } from "./info-card.ts";

function page(body: string) {
  const dom = new JSDOM(`<html class="dark"><head><style>${infoCardCss()}</style></head><body>${body}</body></html>`, { pretendToBeVisual: true });
  return { dom, document: dom.window.document, style: (node: Element) => dom.window.getComputedStyle(node) };
}

test("one card face: frost once, 18px radius, 16px 24px padding, no border", () => {
  const f = page(`<section ${CARD}><p>body</p></section>`);
  const card = f.style(f.document.querySelector(`[${CARD}]`)!);
  assert.equal(card.padding, "16px 24px");
  assert.equal(card.borderRadius, "18px");
  assert.equal(card.borderTopWidth, "0px");
  assert.equal(card.position, "relative", "the close button anchors to the card");
  assert.match(card.getPropertyValue("backdrop-filter"), /blur\(14px\) saturate\(1\.25\)/);
  assert.match(card.backgroundColor + card.background, /var\(--bb-chat-ui-card-face\)/);
  f.dom.window.close();
});

test("the head line is 28px and reserves the close gutter; icon, title, actions and close share its center", () => {
  const f = page(`<section ${CARD}></section>`);
  const card = f.document.querySelector<HTMLElement>(`[${CARD}]`)!;
  const close = createCardClose(f.document, "Goal 닫기");
  const action = createCardAction(f.document, "패널 열기", "M3 3h6");
  const head = createCardHead(f.document, { title: "Goal", icon: null, actions: [action] });
  card.append(head, close);
  const s = f.style(head);
  assert.equal(s.display, "flex");
  assert.equal(s.alignItems, "center");
  assert.equal(s.minHeight, "28px");
  assert.equal(s.height, "28px", "a larger touch action must not move the common title line");
  assert.equal(s.paddingRight, "32px", "24px close + 8px gap");
  assert.equal(s.fontSize, "12px");
  assert.equal(s.fontWeight, "600");
  const title = head.querySelector(`[${cardSlot.title}]`)!;
  assert.equal(title.textContent, "Goal");
  assert.equal(f.style(title).textOverflow, "ellipsis");
  assert.equal(f.style(title).whiteSpace, "nowrap");
  const c = f.style(close);
  assert.equal(c.position, "absolute");
  assert.equal(c.top, "18px", "16px padding + (28px line - 24px button) / 2");
  assert.equal(c.right, "16px");
  assert.equal(c.width, "24px");
  assert.equal(c.height, "24px");
  assert.equal(close.getAttribute("aria-label"), "Goal 닫기");
  assert.equal(close.textContent, "×");
  const a = f.style(action);
  assert.equal(a.width, "24px");
  assert.equal(a.height, "24px");
  assert.equal(a.borderRadius, "999px");
  assert.equal(a.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(action.getAttribute("aria-label"), "패널 열기");
  assert.equal(action.title, "패널 열기");
  f.dom.window.close();
});

test("a compact navigation card has one borderless 40px face and a full-card primary target", () => {
  const f = page(`<section ${CARD} data-bb-chat-ui-card-layout="single-row"><button ${cardSlot.row} data-bb-chat-ui-card-navigation>Parent thread</button></section>`);
  const card = f.document.querySelector(`[${CARD}]`)!;
  const close = createCardClose(f.document, "Parent 닫기");
  card.append(close);
  assert.equal(f.style(card).padding, "0px", "the card has no padding outside its click target");
  assert.equal(f.style(card).minHeight, "40px");
  assert.doesNotMatch(f.style(card).boxShadow,/inset/,"the compact face has no inset edge");
  const row=card.querySelector(`[${cardSlot.row}]`)!;
  assert.equal(f.style(row).width, "100%", "the primary target fills the card");
  assert.equal(f.style(row).minHeight,"40px");
  assert.equal(f.style(row).paddingRight,"40px","text leaves room for the separate close target");
  assert.equal(f.style(row).borderTopWidth,"0px");
  assert.equal(f.style(row).boxShadow,"none");
  assert.equal(f.style(close).top, "8px");
  assert.equal(f.style(close).right, "8px");
  const hitRule=[...f.document.styleSheets].flatMap(s=>[...s.cssRules]).find(r=>'selectorText' in r&&r.selectorText.endsWith('[data-bb-chat-ui-card-navigation]::before')) as CSSStyleRule;
  assert.ok(hitRule,"a primary action covers the face without wrapping sibling controls");
  assert.equal(hitRule.style.position,"absolute");
  assert.equal(hitRule.style.inset,"0px");
  f.dom.window.close();
});

test("a heading-only card leaves no body gap beneath its title", () => {
  const f = page(`<section ${CARD} data-bb-chat-ui-card-layout="heading-only"></section>`);
  const card = f.document.querySelector(`[${CARD}]`)!;
  const head = createCardHead(f.document, { title: 'Pull request', icon: null });
  card.append(head, createCardClose(f.document, 'PR 닫기'));
  assert.equal(f.style(head).marginBottom, '0px');
  f.dom.window.close();
});

test("the common body removes inherited edge insets while keeping row padding", () => {
  const f = page(`<section ${CARD}><div data-bb-chat-ui-card-body style="padding:8px 0 10px"><p style="margin:6px 0">Text</p><div ${cardSlot.row}>Row</div></div></section>`);
  const body = f.document.querySelector('[data-bb-chat-ui-card-body]')!;
  assert.equal(f.style(body).paddingTop, '0px');
  assert.equal(f.style(body).paddingBottom, '0px');
  assert.equal(f.style(body.querySelector('p')!).marginTop, '0px');
  assert.equal(f.style(body.querySelector(`[${cardSlot.row}]`)!).padding, '8px');
  f.dom.window.close();
});

test("main card text stays 12px/16px when host mobile utilities grow, without resizing metadata or editors", () => {
  const f=page(`<section ${CARD}><div ${cardSlot.body}><p class="text-xs leading-relaxed">Goal objective</p><span class="text-xs">Workflow phase</span><p ${cardSlot.meta} class="text-xs">Usage</p><pre><code class="text-xs">code</code></pre><div contenteditable="true"><p class="text-xs">draft</p></div></div></section><p class="text-xs" data-outside>Native paragraph</p>`);
  const host=f.document.createElement('style');
  host.textContent='.text-xs { font-size:14px; line-height:20px; } .leading-relaxed { line-height:1.625; }';
  f.document.head.prepend(host);
  for(const selector of ['p.leading-relaxed','span.text-xs']){
    const s=f.style(f.document.querySelector(selector)!);
    assert.equal(s.fontSize,'12px','host mobile utilities must not enlarge main card content');
    assert.equal(s.lineHeight,'16px');
  }
  assert.equal(f.style(f.document.querySelector(`[${cardSlot.meta}]`)!).fontSize,'11px');
  for(const selector of ['code','[contenteditable] p','[data-outside]']){
    const s=f.style(f.document.querySelector(selector)!);
    assert.equal(s.fontSize,'14px',`${selector}: typography outside the main card text stays native`);
    assert.equal(s.lineHeight,'20px');
  }
  f.dom.window.close();
});

test("text actions are hairline pills without a second surface", () => {
  const f = page(`<section ${CARD}><div ${cardSlot.head}><button ${cardSlot.button}>Goal 해제</button></div></section>`);
  const s = f.style(f.document.querySelector(`[${cardSlot.button}]`)!);
  assert.equal(s.height, "28px");
  assert.equal(s.borderRadius, "999px");
  assert.equal(s.borderTopWidth, "1px");
  assert.equal(s.borderTopStyle, "solid");
  assert.equal(s.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(s.boxShadow, "none");
  assert.equal(s.getPropertyValue("backdrop-filter"), "none");
  f.document.documentElement.setAttribute("data-bb-chat-ui-root-hit-target", "large");
  assert.equal(f.style(f.document.querySelector(`[${cardSlot.button}]`)!).height, "32px", "a finger keeps the 32px hit target");
  f.dom.window.close();
});

test("an external action follows the title without an expanding title spacer", () => {
  const f = page(`<section ${CARD}></section>`);
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

test("list rows share one geometry and paint only on hover", () => {
  const f = page(`<section ${CARD}><div ${cardSlot.list}><button ${cardSlot.row}>a</button><div ${cardSlot.row}>b</div></div></section>`);
  const list = f.style(f.document.querySelector(`[${cardSlot.list}]`)!);
  assert.equal(list.display, "flex");
  assert.equal(list.flexDirection, "column");
  assert.equal(list.rowGap, "2px");
  for (const row of f.document.querySelectorAll(`[${cardSlot.row}]`)) {
    const s = f.style(row);
    assert.equal(s.minHeight, "32px");
    assert.equal(s.padding, "8px");
    assert.equal(s.borderRadius, "10px");
    assert.equal(s.marginLeft, "-8px");
    assert.equal(s.marginRight, "-8px");
    assert.equal(s.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(s.boxShadow, "none");
  }
  assert.ok(infoCardCss().includes(`[${cardSlot.row}]:is(:hover, :focus-visible, :focus-within) { background-color:color-mix(in oklab,var(--foreground) 6%,transparent) !important; }`), "rows paint 6% only on hover");
  assert.equal(f.style(f.document.querySelector(`button[${cardSlot.row}]`)!).cursor, "pointer");
  assert.equal(f.style(f.document.querySelector(`div[${cardSlot.row}]`)!).cursor, "auto", "decorative rows never gain a pointer");
  f.dom.window.close();
});

test("plain buttons and links inside a card never paint a second surface", () => {
  const f = page(`<section ${CARD}><button class="glassy">native</button><a href="#">link</a><input value="x"></section>`);
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

test("meta and section labels share one secondary size", () => {
  const f = page(`<section ${CARD}><h4 ${cardSlot.section}>커밋</h4><span ${cardSlot.meta}>gpt · high</span></section>`);
  for (const node of f.document.querySelectorAll(`[${cardSlot.section}], [${cardSlot.meta}]`)) {
    const s = f.style(node);
    assert.equal(s.fontSize, "11px");
    assert.equal(s.lineHeight, "16px");
    assert.equal(s.fontWeight, "400");
    assert.equal(s.color, "var(--subtle-foreground)");
  }
  f.dom.window.close();
});

test("a custom root reuses the anatomy without the default attribute", () => {
  const dom = new JSDOM(`<html><head><style>${infoCardCss("[data-demo-card]")}</style></head><body><div data-demo-card><div ${cardSlot.head}>t</div></div></body></html>`);
  const s = dom.window.getComputedStyle(dom.window.document.querySelector("[data-demo-card]")!);
  assert.equal(s.borderRadius, "18px");
  assert.equal(s.padding, "16px 24px");
  dom.window.close();
});
