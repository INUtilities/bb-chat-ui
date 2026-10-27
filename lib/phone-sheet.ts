import { cardStyle } from "./info-card.ts";
import { EASE } from "./motion.ts";
import { acceptJumpPulse, postHaptic, readHapticBridge } from "./send-haptic.ts";

/**
 * phone의 컴포저 옵션 drawer를 떠 있는 하단 시트로 꾸민다.
 * 독립 시트 controller는 확정된 디자인 레퍼런스·데모에서 재사용한다.
 * 실제 앱의 정보 pill·전체 정보·인용 원문에는 controller를 연결하지 않는다.
 * DOM을 옮기거나 새 노드를 끼우지 않는다. 대상 요소에 표식과 inline CSS 변수만 쓰고,
 * 손잡이는 배경 그림이라 grid·flex 카드의 배치를 바꾸지 않는다.
 * 컴포저 조상에는 container-type(layout containment)이 있어 position:fixed의 기준이 화면이 아니다.
 * 그래서 위치는 화면 좌표로 계산한 뒤 실제 기준 상자의 좌표로 바꿔 쓴다.
 */
export const SHEET = "data-bb-chat-ui-sheet";
export const PHONE_SHEET_STYLE_ID = "bb-chat-ui-phone-sheet";
const ANIM = `${SHEET}-anim`;
const DRAG = `${SHEET}-dragging`;
const MEASURE = `${SHEET}-measure`;
const PHONE = 'html[data-bb-chat-ui-root-device="phone"]';
const PHONE_DARK = 'html.dark[data-bb-chat-ui-root-device="phone"]';
const OPEN_MS = 320;
const CLOSE_MS = 260;
const GRAB = "color-mix(in oklab,var(--muted-foreground) 45%,transparent)";

/** 떠 있는 모양만 바꾸는 BB drawer. 위치·끌기·닫기는 BB가 소유해 펼친 단계는 없다. */
export const PHONE_DRAWERS = [
  '[data-persistent-drawer-content][data-bb-plugin="bb--composer"]',
  '[data-persistent-drawer-content]:has(> div[aria-label="Prompt actions"])',
  "[data-persistent-drawer-content][data-bb-chat-ui-pr-menu]",
  "[data-persistent-drawer-content][data-bb-chat-ui-model-menu]",
].join(", ");

// :has() cannot nest, so each backdrop names its drawer by the drawer's own child or mark.
const BACKDROPS = [
  ':has(+ [data-persistent-drawer-content][data-bb-plugin="bb--composer"])',
  ':has(+ [data-persistent-drawer-content] > div[aria-label="Prompt actions"])',
  ":has(+ [data-persistent-drawer-content][data-bb-chat-ui-pr-menu])",
  ":has(+ [data-persistent-drawer-content][data-bb-chat-ui-model-menu])",
].join(", ");

export type SheetStage = "collapsed" | "expanded";
/** px. 사진 실측(3x): 좌우·아래 8pt, 모서리 30pt, 손잡이 40×4pt·위 8pt. */
export interface SheetGeometry { inset: number; bottom: number; padTop: number; topGap: number; collapsedMax: number; closeRatio: number }
/** 화면 좌표. top은 스레드 창 위(헤더 아래), keyboard는 아래에서 가린 높이다. */
export interface SheetBounds { top: number; bottom: number; left: number; right: number; keyboard: number; safeBottom: number }

export const SHEET_GEOMETRY: SheetGeometry = { inset: 8, bottom: 8, padTop: 24, topGap: 8, collapsedMax: 416, closeRatio: 0.25 };

// :not(#…)는 id 하나만큼 우선순위를 올린다. 원래 카드 규칙을 이기되 그 문자열은 건드리지 않는다.
const S = `${PHONE} [${SHEET}]:not(#bb-chat-ui-sheet)`;

function phoneSheetTokensCss(): string {
  return `
${PHONE} {
  --bb-chat-ui-sheet-inset:${SHEET_GEOMETRY.inset}px; --bb-chat-ui-sheet-radius:30px; --bb-chat-ui-sheet-radius-expanded:30px;
  --bb-chat-ui-sheet-pad-top:${SHEET_GEOMETRY.padTop}px; --bb-chat-ui-sheet-grab-w:40px; --bb-chat-ui-sheet-grab-h:4px; --bb-chat-ui-sheet-grab-top:8px;
}
`;
}

/** 독립 시트 데모용 CSS. 실제 앱에는 아래의 옵션 drawer CSS만 설치한다. */
export function phoneSheetCss(): string {
  return `${phoneSheetTokensCss()}
${S} {
  --bb-chat-ui-sheet-p:0;
  --bb-chat-ui-card-close-top:calc(var(--bb-chat-ui-sheet-pad-top) + (var(--bb-chat-ui-card-head) - var(--bb-chat-ui-card-icon)) / 2 - .5px);
  position:fixed !important; inset:auto !important;
  top:var(--bb-chat-ui-sheet-t,0px) !important; left:var(--bb-chat-ui-sheet-x,0px) !important;
  width:var(--bb-chat-ui-sheet-w,auto) !important; max-width:none !important; min-height:0 !important;
  height:var(--bb-chat-ui-sheet-h,auto) !important; max-height:none !important;
  margin:0 !important; box-sizing:border-box !important; z-index:60 !important;
  transform:translateY(var(--bb-chat-ui-sheet-y,0px)) !important; translate:none !important; scale:none !important;
  border-radius:
    calc(var(--bb-chat-ui-sheet-radius) + (var(--bb-chat-ui-sheet-radius-expanded) - var(--bb-chat-ui-sheet-radius)) * var(--bb-chat-ui-sheet-p))
    calc(var(--bb-chat-ui-sheet-radius) + (var(--bb-chat-ui-sheet-radius-expanded) - var(--bb-chat-ui-sheet-radius)) * var(--bb-chat-ui-sheet-p))
    calc(var(--bb-chat-ui-sheet-radius) * (1 - var(--bb-chat-ui-sheet-p)))
    calc(var(--bb-chat-ui-sheet-radius) * (1 - var(--bb-chat-ui-sheet-p))) !important;
  padding-top:var(--bb-chat-ui-sheet-pad-top) !important;
  padding-bottom:calc(var(--bb-chat-ui-card-pad-y,12px) + var(--bb-chat-ui-sheet-safe,0px)) !important;
  overflow-x:hidden !important; overflow-y:hidden !important; overscroll-behavior:contain !important;
  animation:none !important; touch-action:none;
  background-image:
    radial-gradient(circle closest-side, ${GRAB} 96%, transparent),
    radial-gradient(circle closest-side, ${GRAB} 96%, transparent),
    linear-gradient(${GRAB}, ${GRAB}) !important;
  background-size:
    var(--bb-chat-ui-sheet-grab-h) var(--bb-chat-ui-sheet-grab-h),
    var(--bb-chat-ui-sheet-grab-h) var(--bb-chat-ui-sheet-grab-h),
    calc(var(--bb-chat-ui-sheet-grab-w) - var(--bb-chat-ui-sheet-grab-h)) var(--bb-chat-ui-sheet-grab-h) !important;
  background-position:
    calc(50% - (var(--bb-chat-ui-sheet-grab-w) - var(--bb-chat-ui-sheet-grab-h)) / 2) var(--bb-chat-ui-sheet-grab-top),
    calc(50% + (var(--bb-chat-ui-sheet-grab-w) - var(--bb-chat-ui-sheet-grab-h)) / 2) var(--bb-chat-ui-sheet-grab-top),
    50% var(--bb-chat-ui-sheet-grab-top) !important;
  background-repeat:no-repeat !important;
}
${S}[${SHEET}="expanded"] { overflow-y:auto !important; touch-action:pan-y; }
/* 카드 바깥의 스크롤 흐림 힌트는 시트 뒤에 깔리므로 시트가 열린 동안 숨긴다. */
${PHONE} [data-bb-chat-ui-info-stack]:has([${SHEET}]) [data-bb-chat-ui-info-scroll-hint] { display:none !important; }
${S}[${DRAG}] { user-select:none; -webkit-user-select:none; }
${S}[${MEASURE}] { height:auto !important; top:0 !important; left:0 !important; transform:none !important; transition:none !important; }
/* PR·Parent 한 줄 카드: 닫기와 hover 면을 손잡이 줄 아래 행에 맞춘다. 손잡이 줄을 눌러도 이동하지 않는다. */
${S}[data-bb-chat-ui-card-layout="single-row"] > [data-bb-chat-ui-card-close] {
  top:calc(var(--bb-chat-ui-sheet-pad-top) + (var(--bb-chat-ui-card-nav-height) - var(--bb-chat-ui-card-icon)) / 2) !important;
}
${S}[data-bb-chat-ui-card-layout="single-row"] [data-bb-chat-ui-card-navigation]::before {
  inset:var(--bb-chat-ui-sheet-pad-top) 0 0 0 !important;
  border-radius:0 0 calc(var(--bb-chat-ui-sheet-radius) * (1 - var(--bb-chat-ui-sheet-p))) calc(var(--bb-chat-ui-sheet-radius) * (1 - var(--bb-chat-ui-sheet-p))) !important;
}
${S}[${ANIM}="open"], ${S}[${ANIM}="settle"] {
  transition-property:height,top,left,width,border-radius,transform,padding-bottom;
  transition-duration:${OPEN_MS}ms; transition-timing-function:${EASE.out};
}
${S}[${ANIM}="close"] {
  transition-property:height,top,left,width,border-radius,transform,padding-bottom;
  transition-duration:${CLOSE_MS}ms; transition-timing-function:${EASE.exit};
}
@media (prefers-reduced-motion:reduce) { ${S} { transition:none !important; } }
`;
}

/**
 * BB 기본 drawer(+ 메뉴·모델·PR 머지 방식)를 떠 있는 모양과 frost 한 겹으로 바꾼다.
 * BB가 키보드 때 inline bottom을 쓰므로 bottom 대신 translate로 띄운다.
 */
export function phoneDrawerCss(drawers: string = PHONE_DRAWERS): string {
  const D = `${PHONE} :is(${drawers}):not(#bb-chat-ui-sheet)`;
  return `
${D} { ${cardStyle.face} }
${PHONE_DARK} :is(${drawers}):not(#bb-chat-ui-sheet) { ${cardStyle.faceDark} }
${D} > div[aria-label="Prompt actions"] { ${cardStyle.flat} }
${PHONE} [data-persistent-drawer-content][data-bb-chat-ui-model-menu] > div[class~="bg-background"],
${PHONE} [data-persistent-drawer-content][data-bb-chat-ui-model-menu] > div > div[class~="bg-background"] { background:transparent !important; }
${D} {
  --bb-chat-ui-card-menu-pad:4px; --bb-chat-ui-card-menu-radius:10px;
  left:var(--bb-chat-ui-sheet-inset) !important; right:var(--bb-chat-ui-sheet-inset) !important;
  width:auto !important; max-width:none !important;
  border-radius:var(--bb-chat-ui-sheet-radius) !important; overflow:hidden;
  max-height:calc(92dvh - var(--bb-drawer-keyboard-inset,0px) - var(--bb-chat-ui-sheet-inset)) !important;
  padding-bottom:max(0px, calc(var(--bb-safe-area-bottom,env(safe-area-inset-bottom,0px)) - var(--bb-chat-ui-sheet-inset))) !important;
}
${D}[data-state="open"] { translate:0 calc(-1 * var(--bb-chat-ui-sheet-inset)); }
${D} > [data-persistent-drawer-handle] { height:var(--bb-chat-ui-sheet-pad-top) !important; padding-top:var(--bb-chat-ui-sheet-grab-top); align-items:flex-start !important; background:transparent !important; }
${D} > [data-persistent-drawer-handle] > div { width:var(--bb-chat-ui-sheet-grab-w) !important; height:var(--bb-chat-ui-sheet-grab-h) !important; background:${GRAB} !important; }
${PHONE} [data-persistent-drawer-backdrop]:is(${BACKDROPS}) { background:transparent !important; }
`;
}

export interface SheetLayout {
  topC: number; heightC: number; bottomC: number; leftC: number; widthC: number; safeC: number;
  topE: number; bottomE: number; leftE: number; widthE: number; safeE: number; expandable: boolean;
}

/** 접힘·펼침 단계의 화면 좌표. natural은 접힘 padding을 넣은 카드 본래 높이다. */
export function sheetLayout(natural: number, b: SheetBounds, g: SheetGeometry, allowShortExpand = false): SheetLayout {
  const bottomC = b.bottom - b.keyboard - g.bottom, bottomE = b.bottom - b.keyboard;
  const topE = b.top + g.topGap;
  const cap = Math.max(96, Math.min(g.collapsedMax, bottomC - topE));
  const heightC = Math.min(natural, cap);
  const width = b.right - b.left;
  return {
    topC: bottomC - heightC, heightC, bottomC, leftC: b.left + g.inset, widthC: width - 2 * g.inset,
    safeC: b.keyboard ? 0 : Math.max(0, b.safeBottom - g.bottom),
    topE, bottomE, leftE: b.left, widthE: width, safeE: b.keyboard ? 0 : b.safeBottom,
    expandable: natural > cap + 1 || allowShortExpand,
  };
}

export interface SheetOptions {
  bounds(): SheetBounds;
  onClose(): void;
  geometry?: () => SheetGeometry;
  /** 짧은 카드도 펼친 단계로 끌 수 있다. 기본은 허용. */
  allowShortExpand?: () => boolean;
  reducedMotion?: () => boolean;
  haptic?: (kind: "impact-light") => void;
  onStage?: (stage: SheetStage | "closed" | "dragging") => void;
}

export interface SheetController {
  readonly stage: SheetStage;
  set(stage: SheetStage): void;
  close(): void;
  refresh(): void;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rubber = (distance: number) => distance * 0.5 / (1 + distance / 160);
const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const VARS = ["p", "t", "x", "w", "h", "y", "safe"].map(name => `--bb-chat-ui-sheet-${name}`);

export function attachSheet(el: HTMLElement, options: SheetOptions): SheetController {
  const view = el.ownerDocument.defaultView!;
  const geometry = options.geometry ?? (() => SHEET_GEOMETRY);
  const reduced = options.reducedMotion ?? (() => view.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const haptic = options.haptic ?? ((kind) => { postHaptic(readHapticBridge(view), kind); });
  const originalStyle = el.getAttribute("style");
  let stage: SheetStage = "collapsed";
  let top = 0, natural = 0, originX = 0, originY = 0;
  let timer = 0, frame = 0;
  let closing = false, destroyed = false;

  // Every card can expand: the user expects drag-up to reach the edge-to-edge stage (2026-10-27).
  const layout = () => sheetLayout(natural, options.bounds(), geometry(), options.allowShortExpand?.() ?? true);
  const write = (name: string, value: string) => { if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value); };

  // Viewport top → sheet geometry. Above the collapsed top it morphs toward the expanded stage.
  function render(nextTop: number) {
    const m = layout();
    top = nextTop;
    let p = 0, height = m.heightC, y = 0, t = m.topC;
    if (nextTop >= m.topC) y = nextTop - m.topC;
    else if (!m.expandable) y = -rubber(m.topC - nextTop);
    else {
      t = nextTop < m.topE ? m.topE - rubber(m.topE - nextTop) : nextTop;
      p = clamp((m.topC - t) / Math.max(1, m.topC - m.topE), 0, 1);
      height = m.bottomC + (m.bottomE - m.bottomC) * p - t;
    }
    write("--bb-chat-ui-sheet-p", String(Math.round(p * 10000) / 10000));
    write("--bb-chat-ui-sheet-t", px(t - originY));
    write("--bb-chat-ui-sheet-x", px(m.leftC + (m.leftE - m.leftC) * p - originX));
    write("--bb-chat-ui-sheet-w", px(m.widthC + (m.widthE - m.widthC) * p));
    write("--bb-chat-ui-sheet-h", px(height));
    write("--bb-chat-ui-sheet-y", px(y));
    write("--bb-chat-ui-sheet-safe", px(m.safeC + (m.safeE - m.safeC) * p));
  }

  // The measure mark pins the sheet at top:0/left:0, so its box also reveals the containing block origin.
  function measure() {
    el.setAttribute(MEASURE, "");
    write("--bb-chat-ui-sheet-p", "0");
    write("--bb-chat-ui-sheet-safe", px(sheetLayout(0, options.bounds(), geometry()).safeC));
    write("--bb-chat-ui-sheet-w", px(layout().widthC));
    natural = el.offsetHeight;
    const box = el.getBoundingClientRect();
    originX = box.left; originY = box.top;
    el.removeAttribute(MEASURE);
  }

  function animate(kind: "open" | "settle" | "close", nextTop: number, done?: () => void) {
    view.clearTimeout(timer);
    if (reduced()) { el.removeAttribute(ANIM); render(nextTop); done?.(); return; }
    el.setAttribute(ANIM, kind);
    render(nextTop);
    timer = view.setTimeout(() => { el.removeAttribute(ANIM); done?.(); }, (kind === "close" ? CLOSE_MS : OPEN_MS) + 40);
  }

  const targetTop = (next: SheetStage) => { const m = layout(); return next === "expanded" && m.expandable ? m.topE : m.topC; };

  function settle(next: SheetStage, kind: "open" | "settle" = "settle") {
    if (next === "expanded" && !layout().expandable) next = "collapsed";
    const changed = next !== stage;
    stage = next;
    el.setAttribute(SHEET, next);
    if (next === "collapsed") el.scrollTop = 0;
    animate(kind, targetTop(next));
    if (changed && kind === "settle") haptic("impact-light");
    options.onStage?.(next);
  }

  function close(feedback: boolean) {
    if (closing || destroyed) return;
    closing = true;
    if (feedback) haptic("impact-light");
    options.onStage?.("closed");
    const bounds = options.bounds();
    // The release click is already consumed; the card's own close must not be.
    animate("close", bounds.bottom + 24, () => { suppressClick = false; options.onClose(); });
  }

  // Input. The grab strip always drags. Content drags the sheet while collapsed, or while
  // expanded at scrollTop 0 moving down. iOS gives the gesture to native scrolling unless the
  // first touch events are cancelled, so the strip cancels touchstart and collapsed content
  // cancels its first touchmove; taps on content still click.
  type Track = { y0: number; x0: number; top0: number; active: boolean; samples: Array<[number, number]> };
  let track: Track | null = null;
  let suppressClick = false;

  const inGrab = (y: number) => y >= top - 4 && y - top < geometry().padTop;

  // The containing block can move with the page (for example an inline-vis iframe scroll).
  // One read per gesture re-derives its origin and the visible top from the current box.
  function reorigin() {
    const box = el.getBoundingClientRect();
    const read = (name: string) => Number.parseFloat(el.style.getPropertyValue(`--bb-chat-ui-sheet-${name}`)) || 0;
    originY = box.top - read("t") - read("y");
    originX = box.left - read("x");
    top = box.top;
  }

  function begin(x: number, y: number, target: EventTarget | null): boolean {
    if (closing) return false;
    reorigin();
    const grab = inGrab(y);
    if (!grab && target instanceof view.Element && target.closest("input, textarea, select, [contenteditable='true'], .cm-editor")) return false;
    el.removeAttribute(ANIM);
    track = { y0: y, x0: x, top0: top, active: grab, samples: [[view.performance.now(), y]] };
    if (grab) { el.setAttribute(DRAG, ""); options.onStage?.("dragging"); }
    return grab;
  }

  function move(x: number, y: number, event: Event) {
    if (!track) return;
    const dy = y - track.y0, dx = x - track.x0;
    if (!track.active) {
      if (stage === "expanded" && !(el.scrollTop <= 0 && dy > 0)) { if (Math.abs(dy) >= 6 || Math.abs(dx) >= 6) track = null; return; }
      if (event.cancelable) event.preventDefault();
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) { track = null; return; }
      track.active = true; track.y0 = y; track.top0 = top;
      el.setAttribute(DRAG, ""); options.onStage?.("dragging");
    }
    if (event.cancelable) event.preventDefault();
    track.samples.push([view.performance.now(), y]);
    if (track.samples.length > 8) track.samples.shift();
    render(track.top0 + (y - track.y0));
  }

  function end(cancelled: boolean) {
    const current = track;
    track = null;
    el.removeAttribute(DRAG);
    if (!current?.active) return;
    suppressClick = true;
    view.setTimeout(() => { suppressClick = false; }, 320);
    const now = view.performance.now();
    const recent = current.samples.filter(([at]) => now - at < 100);
    const first = recent[0], last = current.samples[current.samples.length - 1];
    const velocity = first && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : 0; // px/ms, + is down
    const m = layout();
    const projected = top + velocity * 140;
    if (!cancelled && (projected > m.topC + m.heightC * geometry().closeRatio || (velocity > 0.45 && top > m.topC + 4))) { close(true); return; }
    settle(cancelled ? stage : m.expandable && projected < (m.topC + m.topE) / 2 ? "expanded" : "collapsed");
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    begin(event.clientX, event.clientY, event.target);
    if (!track) return;
    view.addEventListener("pointermove", onPointerMove);
    view.addEventListener("pointerup", onPointerUp);
    view.addEventListener("pointercancel", onPointerCancel);
  };
  const onPointerMove = (event: PointerEvent) => move(event.clientX, event.clientY, event);
  const stopPointer = () => {
    view.removeEventListener("pointermove", onPointerMove);
    view.removeEventListener("pointerup", onPointerUp);
    view.removeEventListener("pointercancel", onPointerCancel);
  };
  const onPointerUp = () => { stopPointer(); end(false); };
  const onPointerCancel = () => { stopPointer(); end(true); };
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) { track = null; return; }
    const point = event.touches[0];
    if (begin(point.clientX, point.clientY, event.target) && event.cancelable) event.preventDefault();
  };
  const onTouchMove = (event: TouchEvent) => { const point = event.touches[0]; if (point) move(point.clientX, point.clientY, event); };
  const onTouchEnd = () => end(false);
  const onTouchCancel = () => end(true);
  const onClick = (event: MouseEvent) => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; } };
  // Keyboard and screen reader focus below the collapsed edge opens the expanded stage.
  const onFocusIn = (event: FocusEvent) => {
    if (stage !== "collapsed" || !(event.target instanceof view.Element) || event.target === el) return;
    const box = event.target.getBoundingClientRect();
    if (box.bottom > layout().bottomC) settle("expanded");
  };

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("touchstart", onTouchStart, { passive: false });
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd);
  el.addEventListener("touchcancel", onTouchCancel);
  el.addEventListener("click", onClick, true);
  el.addEventListener("focusin", onFocusIn);

  const schedule = () => {
    if (frame || destroyed) return;
    frame = view.requestAnimationFrame(() => { frame = 0; if (!track && !closing && !destroyed) { measure(); render(targetTop(stage)); } });
  };
  const mutations = new view.MutationObserver(schedule);
  mutations.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "aria-expanded", "open"] });
  view.addEventListener("resize", schedule);
  view.visualViewport?.addEventListener("resize", schedule);

  // Open: start below the visible bottom, then rise to the collapsed stage.
  el.setAttribute(SHEET, "collapsed");
  measure();
  el.setAttribute(ANIM, "none");
  render(options.bounds().bottom + 24);
  void el.offsetHeight;
  settle("collapsed", "open");

  return {
    get stage() { return stage; },
    set(next: SheetStage) { settle(next); },
    close: () => close(true),
    refresh: schedule,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      view.clearTimeout(timer);
      if (frame) view.cancelAnimationFrame(frame);
      mutations.disconnect();
      view.removeEventListener("resize", schedule);
      view.visualViewport?.removeEventListener("resize", schedule);
      stopPointer();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("focusin", onFocusIn);
      for (const name of [SHEET, ANIM, DRAG, MEASURE]) el.removeAttribute(name);
      for (const name of VARS) el.style.removeProperty(name);
      if (!el.style.length) { if (originalStyle === null) el.removeAttribute("style"); else el.setAttribute("style", originalStyle); }
    },
  };
}

/** BB의 safe-area 변수(없으면 env)를 실제 px로 읽는다. */
function readSafeBottom(document: Document): number {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-bottom:var(--bb-safe-area-bottom,env(safe-area-inset-bottom,0px))";
  document.body.append(probe);
  const value = Number.parseFloat(document.defaultView!.getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return value;
}

/** 시트가 덮는 화면: 그 카드의 스레드 창(헤더 아래부터 화면 아래까지). 키보드는 visualViewport로 잰다. */
export function threadWindowBounds(el: HTMLElement): SheetBounds {
  const document = el.ownerDocument, view = document.defaultView!;
  const frame = el.closest("[data-thread-window]") ?? document.querySelector("[data-thread-window]");
  const box = frame?.getBoundingClientRect();
  const rect = box && box.height > 0 ? box : { top: 0, bottom: view.innerHeight, left: 0, right: view.innerWidth };
  const vv = view.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : view.innerHeight;
  const overlap = Math.round(rect.bottom - visibleBottom);
  // BB drawer uses the same 80px floor to ignore toolbar resizes.
  const keyboard = overlap >= 80 ? overlap : 0;
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, keyboard, safeBottom: keyboard ? 0 : readSafeBottom(document) };
}

/** phone 옵션 drawer에만 stylesheet를 둔다. 정보 카드·인용과 BB의 native 제스처는 그대로 둔다. */
export function injectPhoneSheet(document: Document): () => void {
  const view = document.defaultView;
  if (!view) return () => {};
  const root = document.documentElement;
  let style: HTMLStyleElement | null = null;
  let frame = 0;
  let disposed = false;
  let lastHandleAt: number | null = null;

  const phone = () => root.getAttribute("data-bb-chat-ui-root-device") === "phone";
  const onHandlePress = (event: PointerEvent) => {
    if (!phone() || event.button !== 0 || !(event.target instanceof view.Element)) return;
    const handle = event.target.closest("[data-persistent-drawer-handle]");
    if (!handle?.parentElement?.matches(PHONE_DRAWERS)) return;
    const next = acceptJumpPulse(lastHandleAt, view.performance.now());
    if (next === null) return;
    lastHandleAt = next;
    postHaptic(readHapticBridge(view), "impact-light");
  };
  document.addEventListener("pointerdown", onHandlePress, true);
  function sync() {
    frame = 0;
    if (disposed) return;
    if (!phone()) {
      style?.remove(); style = null;
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = PHONE_SHEET_STYLE_ID;
      style.textContent = phoneSheetTokensCss() + phoneDrawerCss();
      document.head.append(style);
    }
  }
  const schedule = () => { if (!frame && !disposed) frame = view.requestAnimationFrame(sync); };
  const rootObserver = new view.MutationObserver(schedule);
  rootObserver.observe(root, { attributes: true, attributeFilter: ["data-bb-chat-ui-root-device"] });
  schedule();

  return () => {
    if (disposed) return;
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    rootObserver.disconnect();
    document.removeEventListener("pointerdown", onHandlePress, true);
    style?.remove();
  };
}
