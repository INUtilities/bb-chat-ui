import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";

import { composerInfoCss } from "./composer-info.ts";
import { quotePreviewCss } from "./quote-preview.ts";
import { composerMenuGlassCss } from "./composer-menu-glass.ts";
import { queuedMessagesCss } from "./queued-messages.ts";
import { infoCardCss } from "./info-card.ts";
import {
  PHONE_SHEET_STYLE_ID, SHEET, attachSheet, injectPhoneSheet, phoneDrawerCss, phoneSheetCss, sheetLayout,
  type SheetBounds, type SheetGeometry,
} from "./phone-sheet.ts";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

// Latest 높이 수정 두 곳만 역변환해 기존 CSS 기준과 나머지 바이트를 계속 비교한다.
const withoutLatestLayout = () => {
  const bar = '[data-bb-chat-ui-info-bar] { position:relative; display:flex; align-items:center; gap:8px; height:auto; max-height:32px;';
  const jump = '[data-bb-chat-ui-info-bar][data-bb-chat-ui-info-layout="dock"] > [data-bb-chat-ui-info-jump] { position:absolute; right:0; bottom:0;';
  assert.equal(composerInfoCss.split(bar).length - 1, 1);
  assert.equal(composerInfoCss.split(jump).length - 1, 1);
  return composerInfoCss.replace(bar, bar.replace('height:auto; max-height:32px;', 'height:32px;'))
    .replace(jump, jump.replace('bottom:0;', 'top:0;'));
};

test("Latest layout stabilization keeps all other CSS bytes and selectors", () => {
  assert.equal(sha(withoutLatestLayout()), "ad6710f789a9df175ae7d37e7badf489c1e10d842f61b63d8a65f871f9030c92");
});

// 요청 숨김 규칙 외의 CSS를 기존 hash와 계속 비교한다. 실제 cascade는 native browser 회귀에서 확인한다.
const requestSignalCss = `/* Keep request removal synchronous; the display rule itself need not contain :has(). */
@supports (display:revert-rule) {
  [data-scroll-footer]:has([data-bb-chat-ui-info-request]) { --bb-chat-ui-request-jump-display:none; }
  [data-scroll-footer][data-scroll-footer] button[aria-label="Scroll to latest event"] { display:var(--bb-chat-ui-request-jump-display,revert-rule) !important; }
}
@supports not (display:revert-rule) {
  [data-scroll-footer]:has([data-bb-chat-ui-info-request]) button[aria-label="Scroll to latest event"] { display:none !important; }
}`;
const legacyRequestCss = `[data-scroll-footer]:has([data-bb-chat-ui-info-request]) button[aria-label="Scroll to latest event"] { display:none !important; }`;
const withoutRequestSignal = () => {
  const css = withoutLatestLayout();
  assert.equal(css.split(requestSignalCss).length - 1, 1);
  return css.replace(requestSignalCss, legacyRequestCss);
};

// 카드는 Workflow selector 최적화 기준을 반영하며 아래 역변환 검사로 나머지 바이트를 보존한다. 인용은 기존 기준을 유지한다. 메뉴는 plugin wrapper 항목의 공통 모서리 수정(2026-10-28)을 반영한다.
// Queue는 SDK wrapper를 사이에 둔 편집 form의 자체 grid 수정 기준을 반영한다.
test("desktop card, menu and quote CSS stay byte-identical", () => {
  assert.equal(sha(withoutRequestSignal()), "319a8ed9d6e0f555707d3e067def85f7ed72f8c76596e3865580e87bdccba253");
  assert.equal(sha(quotePreviewCss), "71f4f433df57b51d308983e6fa392465a60e4edcc03633d68f33483652252af6");
  assert.equal(sha(composerMenuGlassCss), "eb18fa958d725987aa3771b491418430b5d9e4ef678704258b64239e2dc5ccc9");
  assert.equal(sha(queuedMessagesCss), "55646dbd272cff7f0a53d83096929f1ea130bb8762b304b4a91812912dff2576");
  assert.equal(sha(infoCardCss()), "8c9e1d7134c5cff3b1c27635e919b338f58c5960f224a8ef13c443cb8228d3cc");
});


// Workflow의 네 selector와 두 class 표기 외에는 모든 CSS 바이트를 보존한다.
test("Workflow selector optimization keeps all other card CSS bytes", () => {
  const detail = '[data-promptbox-shell] > .grid[data-bb-chat-ui-info-stack] [data-bb-chat-ui-info-unit][data-bb-chat-ui-info-open]:not([hidden])';
  const oldRow = `${detail}[data-bb-chat-ui-info-open="workflow"] section[role="region"] [class~="min-h-7"]:has(> span[class~="truncate"])`;
  const markedRow = `${detail}[data-bb-chat-ui-info-open="workflow"] section[role="region"]:is(section) [data-bb-chat-ui-info-workflow-agent-row][data-bb-chat-ui-info-workflow-agent-row]`;
  assert.equal(composerInfoCss.split(markedRow).length - 1, 4);
  const restored = withoutRequestSignal().replaceAll(markedRow, oldRow)
    .replace(`${oldRow} > span.truncate`, `${oldRow} > span[class~="truncate"]`)
    .replace(`${oldRow} > span.ml-auto`, `${oldRow} > span[class~="ml-auto"]`);
  assert.equal(sha(restored), "e937a5b1a6fb7100ae5ff0b6d92a114dd9e654a0ca022714e8158810f8714419");
});

function selectors(css: string): string[] {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "");
  const out: string[] = [];
  for (const match of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    let depth = 0, part = "";
    for (const ch of match[1]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(part.trim()); part = ""; } else part += ch;
    }
    if (part.trim()) out.push(part.trim());
  }
  return out;
}

test("every phone sheet and drawer rule is scoped to the phone root", () => {
  const all = selectors(phoneSheetCss() + phoneDrawerCss());
  assert.ok(all.length > 10);
  for (const selector of all) {
    assert.match(selector, /^html(\.dark)?\[data-bb-chat-ui-root-device="phone"\]/, selector);
  }
});

// A :has() nested inside another :has() is invalid and drops the whole rule in the browser.
test("no phone rule nests :has() inside :has()", () => {
  for (const selector of selectors(phoneSheetCss() + phoneDrawerCss())) {
    let depth = 0, inside = -1;
    for (let i = 0; i < selector.length; i++) {
      if (selector.startsWith(":has(", i)) { assert.equal(inside, -1, selector); inside = depth; }
      if (selector[i] === "(") depth++;
      if (selector[i] === ")") { depth--; if (depth === inside) inside = -1; }
    }
  }
});

const bounds: SheetBounds = { top: 48, bottom: 844, left: 0, right: 390, keyboard: 0, safeBottom: 34 };
const geometry: SheetGeometry = { inset: 8, bottom: 8, padTop: 24, topGap: 8, collapsedMax: 416, closeRatio: 0.25 };

test("layout floats a short card 8px from the sides and bottom and does not expand it", () => {
  const m = sheetLayout(300, bounds, geometry);
  assert.deepEqual([m.topC, m.heightC, m.expandable], [536, 300, false]);
  assert.deepEqual([m.leftC, m.widthC, m.leftE, m.widthE], [8, 374, 0, 390]);
  assert.equal(m.bottomE, 844);
});

test("layout caps a long card at the shared maximum and expands under the thread header", () => {
  const m = sheetLayout(900, bounds, geometry);
  assert.deepEqual([m.topC, m.heightC, m.topE, m.expandable], [420, 416, 56, true]);
});

test("layout lifts both stages above the keyboard and drops the safe-area padding", () => {
  const m = sheetLayout(900, { ...bounds, keyboard: 336 }, geometry);
  assert.equal(m.bottomC, 844 - 336 - 8);
  assert.equal(m.bottomE, 844 - 336);
  assert.equal(m.topC, 500 - 416);
  assert.deepEqual([m.safeC, m.safeE], [0, 0]);
  const open = sheetLayout(900, bounds, geometry);
  assert.deepEqual([open.safeC, open.safeE], [26, 34]);
});

function fixture(device: "phone" | "desktop" = "phone") {
  const dom = new JSDOM(`<html data-bb-chat-ui-root-device="${device}"><body><div data-thread-window><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack>
    <section id="card" data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="goal"><button id="close" data-bb-chat-ui-info-dismiss>x</button><p>body</p></section>
  </div></div></div><button id="outside">outside</button></body></html>`, { pretendToBeVisual: true });
  return { dom, d: dom.window.document, w: dom.window, card: dom.window.document.getElementById("card") as HTMLElement };
}

// JSDOM has no layout: give the sheet a natural height and a containing-block origin of (16, 738).
// While measuring, the sheet sits at the origin; otherwise its box follows the CSS variables.
function stubLayout(el: HTMLElement, natural: number, shift = () => 0) {
  Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => natural });
  const css = (name: string) => Number.parseFloat(el.style.getPropertyValue(`--bb-chat-ui-sheet-${name}`)) || 0;
  el.getBoundingClientRect = () => {
    const measuring = el.hasAttribute("data-bb-chat-ui-sheet-measure");
    const top = 738 - shift() + (measuring ? 0 : css("t") + css("y")), left = 16 + (measuring ? 0 : css("x"));
    return { x: left, y: top, left, top, right: left + 358, bottom: top + 90, width: 358, height: 90, toJSON() {} } as DOMRect;
  };
}

function sheetOptions(extra: Partial<Parameters<typeof attachSheet>[1]> = {}) {
  const haptics: string[] = [];
  let closed = 0;
  return {
    haptics, closed: () => closed,
    options: { geometry: () => geometry, bounds: () => bounds, reducedMotion: () => true, haptic: (kind: string) => { haptics.push(kind); }, onClose: () => { closed++; }, ...extra },
  };
}

// Each event is 150ms after the previous one, so releases carry no fling velocity.
let clock = 1000;
const tickClock = (w: Window) => { clock += 150; Object.defineProperty(w.performance, "now", { configurable: true, value: () => clock }); };
const pointer = (w: Window & typeof globalThis, target: EventTarget, type: string, y: number) => {
  tickClock(w);
  return target.dispatchEvent(new w.PointerEvent(type, { bubbles: true, cancelable: true, clientX: 195, clientY: y, button: 0, pointerType: "mouse" }));
};

test("positions in viewport coordinates converted to the fixed containing block", () => {
  const f = fixture(); stubLayout(f.card, 900);
  const s = sheetOptions();
  const sheet = attachSheet(f.card, s.options);
  try {
    assert.equal(f.card.getAttribute(SHEET), "collapsed");
    assert.equal(f.card.style.getPropertyValue("--bb-chat-ui-sheet-x"), `${8 - 16}px`);
    assert.equal(f.card.style.getPropertyValue("--bb-chat-ui-sheet-t"), `${420 - 738}px`);
    assert.equal(f.card.style.getPropertyValue("--bb-chat-ui-sheet-h"), "416px");
    assert.equal(f.card.style.getPropertyValue("--bb-chat-ui-sheet-w"), "374px");
  } finally { sheet.destroy(); f.dom.window.close(); }
});

test("dragging the grab strip snaps to expanded, back to collapsed, then closes with one haptic per stage", () => {
  const f = fixture(); stubLayout(f.card, 900);
  const s = sheetOptions();
  const sheet = attachSheet(f.card, s.options);
  try {
    pointer(f.w, f.card, "pointerdown", 430); pointer(f.w, f.w, "pointermove", 300); pointer(f.w, f.w, "pointermove", 130); pointer(f.w, f.w, "pointerup", 130);
    assert.equal(sheet.stage, "expanded");
    assert.equal(f.card.style.getPropertyValue("--bb-chat-ui-sheet-p"), "1");
    pointer(f.w, f.card, "pointerdown", 66); pointer(f.w, f.w, "pointermove", 300); pointer(f.w, f.w, "pointermove", 466); pointer(f.w, f.w, "pointerup", 466);
    assert.equal(sheet.stage, "collapsed");
    pointer(f.w, f.card, "pointerdown", 430); pointer(f.w, f.w, "pointermove", 560); pointer(f.w, f.w, "pointermove", 640); pointer(f.w, f.w, "pointerup", 640);
    assert.equal(s.closed(), 1);
    assert.deepEqual(s.haptics, ["impact-light", "impact-light", "impact-light"]);
  } finally { sheet.destroy(); f.dom.window.close(); }
});

// 사용자 확정(2026-10-27): 짧은 카드도 위로 끌면 사진 2처럼 화면 양옆에 붙는 펼친 단계가 된다.
// The containing block can move with the page (inline-vis iframe scroll); each gesture re-reads it.
test("a gesture re-reads the containing block origin after the page moves", () => {
  const f = fixture();
  let shift = 0;
  stubLayout(f.card, 900, () => shift);
  const s = sheetOptions({ bounds: () => ({ ...bounds, top: bounds.top - shift, bottom: bounds.bottom - shift }) });
  const sheet = attachSheet(f.card, s.options);
  try {
    shift = 300;
    pointer(f.w, f.card, "pointerdown", 430 - shift); pointer(f.w, f.w, "pointermove", 300 - shift); pointer(f.w, f.w, "pointermove", 130 - shift); pointer(f.w, f.w, "pointerup", 130 - shift);
    assert.equal(sheet.stage, "expanded");
    assert.equal(f.card.getBoundingClientRect().top, 56 - shift);
  } finally { sheet.destroy(); f.dom.window.close(); }
});

test("a short card also expands when dragged up", () => {
  const f = fixture(); stubLayout(f.card, 300);
  const s = sheetOptions();
  const sheet = attachSheet(f.card, s.options);
  try {
    pointer(f.w, f.card, "pointerdown", 546); pointer(f.w, f.w, "pointermove", 300); pointer(f.w, f.w, "pointermove", 200); pointer(f.w, f.w, "pointerup", 200);
    assert.equal(sheet.stage, "expanded");
    assert.deepEqual(s.haptics, ["impact-light"]);
  } finally { sheet.destroy(); f.dom.window.close(); }
});

function touch(w: Window & typeof globalThis, target: EventTarget, type: string, y: number): Event {
  tickClock(w);
  const event = new w.Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: 195, clientY: y };
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [point] });
  target.dispatchEvent(event);
  return event;
}

// iOS hands the gesture to native scrolling unless the first touch events are cancelled.
test("touch drags claim the gesture from the first event in the grab strip and while collapsed", () => {
  const f = fixture(); stubLayout(f.card, 900);
  const sheet = attachSheet(f.card, sheetOptions().options);
  try {
    assert.equal(touch(f.w, f.card, "touchstart", 430).defaultPrevented, true, "grab strip start");
    assert.equal(touch(f.w, f.card, "touchmove", 427).defaultPrevented, true, "grab strip first move");
    touch(f.w, f.card, "touchend", 427);
    assert.equal(touch(f.w, f.card, "touchstart", 600).defaultPrevented, false, "content start keeps taps");
    assert.equal(touch(f.w, f.card, "touchmove", 597).defaultPrevented, true, "collapsed content first move");
    for (const y of [560, 400, 200]) touch(f.w, f.card, "touchmove", y);
    touch(f.w, f.card, "touchend", 200);
    assert.equal(sheet.stage, "expanded");
    Object.defineProperty(f.card, "scrollTop", { configurable: true, value: 120, writable: true });
    touch(f.w, f.card, "touchstart", 400);
    assert.equal(touch(f.w, f.card, "touchmove", 410).defaultPrevented, false, "expanded scrolled content scrolls");
    touch(f.w, f.card, "touchend", 410);
    assert.equal(sheet.stage, "expanded");
  } finally { sheet.destroy(); f.dom.window.close(); }
});

test("destroy restores the native node", () => {
  const f = fixture(); stubLayout(f.card, 300);
  const before = f.card.getAttribute("style");
  const sheet = attachSheet(f.card, sheetOptions().options);
  sheet.destroy();
  assert.equal(f.card.getAttribute("style"), before);
  for (const name of f.card.getAttributeNames()) assert.doesNotMatch(name, /sheet/);
  f.dom.window.close();
});

const flush = async (w: Window) => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => w.requestAnimationFrame(() => r(null))); };

test("the content script styles only phone option drawers and follows the device attribute", async () => {
  const f = fixture("desktop"); stubLayout(f.card, 300);
  const stop = injectPhoneSheet(f.d);
  try {
    await flush(f.w);
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    assert.equal(f.card.hasAttribute(SHEET), false);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
    await flush(f.w);
    assert.ok(f.d.getElementById(PHONE_SHEET_STYLE_ID));
    assert.equal(f.card.hasAttribute(SHEET), false);
    f.card.removeAttribute("data-bb-chat-ui-info-open");
    await flush(f.w);
    assert.equal(f.card.hasAttribute(SHEET), false);
    f.card.setAttribute("data-bb-chat-ui-info-open", "goal");
    await flush(f.w);
    assert.equal(f.card.hasAttribute(SHEET), false);
    f.d.documentElement.setAttribute("data-bb-chat-ui-root-device", "desktop");
    await flush(f.w);
    assert.equal(f.d.getElementById(PHONE_SHEET_STYLE_ID), null);
    assert.equal(f.card.hasAttribute(SHEET), false);
  } finally { stop(); f.dom.window.close(); }
});

test("an explicitly attached reference sheet closes through its supplied native dismiss action", async () => {
  const f = fixture(); stubLayout(f.card, 300);
  let dismissed = 0;
  f.d.getElementById("close")!.addEventListener("click", () => dismissed++);
  Object.defineProperty(f.w, "matchMedia", { configurable: true, value: () => ({ matches: true }) });
  const sheet = attachSheet(f.card, { ...sheetOptions().options, onClose: () => f.d.getElementById("close")!.click() });
  try {
    await flush(f.w);
    pointer(f.w, f.card, "pointerdown", 546); pointer(f.w, f.w, "pointermove", 556); pointer(f.w, f.w, "pointermove", 720); pointer(f.w, f.w, "pointerup", 720);
    assert.equal(dismissed, 1);
  } finally { sheet.destroy(); f.dom.window.close(); }
});
