import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { injectPhoneSheet, PHONE_DRAWERS, PHONE_SHEET_STYLE_ID, SHEET } from "./phone-sheet.ts";

function fixture() {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="phone"><head></head><body>
    <div data-thread-window><div data-bb-chat-ui-info-stack>
      <section id="goal" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="goal"><button data-bb-chat-ui-info-dismiss>Close</button><p>Goal body</p></section>
      <section id="all" data-bb-chat-ui-info-menu><button>Goal</button></section>
    </div><section id="quote" data-bb-chat-ui-quote-preview-card><p>Quoted text</p></section></div>
    <section id="plus" data-persistent-drawer-content data-bb-plugin="bb--composer" data-state="open"><div aria-label="Prompt actions"><button role="menuitem">Attach file</button></div></section>
    <section id="model" data-persistent-drawer-content data-bb-plugin="bb--composer" data-bb-chat-ui-model-menu data-state="open"><input placeholder="Search models"><button>Model A</button></section>
    <section id="send" data-persistent-drawer-content data-bb-plugin="bb--composer" data-state="open"><div aria-label="Send options"><button role="menuitem">Queue</button></div></section>
    <section id="merge" data-persistent-drawer-content data-bb-chat-ui-pr-menu data-state="open"><button>Squash merge</button></section>
    <section id="other" data-persistent-drawer-content data-bb-plugin="other-plugin" data-state="open"><button>Other plugin</button></section>
  </body></html>`, { pretendToBeVisual:true });
  const d = dom.window.document;
  return { dom, d, w:dom.window };
}

const flush = async (w:Window) => new Promise(resolve => w.requestAnimationFrame(resolve));

test("phone option sheets leave information pills, the catalog and quote previews in their native popovers", async () => {
  const f = fixture();
  const cards = ["goal", "all", "quote"].map(id => f.d.getElementById(id)!);
  const before = cards.map(card => card.outerHTML);
  const stop = injectPhoneSheet(f.d);
  try {
    await flush(f.w);
    for (let i=0;i<cards.length;i++) {
      assert.equal(cards[i].hasAttribute(SHEET), false, cards[i].id);
      assert.equal(cards[i].outerHTML, before[i], `${cards[i].id} retains its layout and controls`);
    }
    assert.doesNotMatch(f.d.getElementById(PHONE_SHEET_STYLE_ID)!.textContent!, /\[data-bb-chat-ui-sheet\]/,
      "the runtime installs only native option drawer styling");
  } finally { stop(); f.dom.window.close(); }
});

test("sheet styling covers composer option drawers and PR methods while excluding other plugin drawers", () => {
  const f = fixture();
  try {
    assert.deepEqual(Array.from(f.d.querySelectorAll(PHONE_DRAWERS)).map(el=>el.id), ["plus", "model", "send", "merge"]);
  } finally { f.dom.window.close(); }
});

test("device changes and disposal restore option drawer styling without touching native actions", async () => {
  const f = fixture();
  const before = f.d.body.innerHTML;
  let clicked = 0;
  f.d.querySelector("#plus button")!.addEventListener("click", () => clicked++);
  const stop = injectPhoneSheet(f.d);
  try {
    await flush(f.w);
    assert.ok(f.d.getElementById(PHONE_SHEET_STYLE_ID));
    (f.d.querySelector("#plus button") as HTMLElement).click();
    assert.equal(clicked, 1);
    assert.equal(f.d.body.innerHTML, before);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "desktop");
    await flush(f.w);
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
    await flush(f.w);
    assert.equal(f.d.querySelectorAll(`#${PHONE_SHEET_STYLE_ID}`).length, 1);
    stop();
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    assert.equal(f.d.body.innerHTML, before);
  } finally { stop(); f.dom.window.close(); }
});
