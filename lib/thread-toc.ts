import { DARK_GLASS_FACE, LIGHT_GLASS_FACE, glassSurfaceScopeCss } from "./glass-surface.ts";
import { TOC_REPLY_MARK, clearTocReplies, paintTocReply } from "./thread-toc-preview.ts";

const STYLE_ID = "bb-chat-ui-thread-toc";
const RAIL_MARK = "data-bb-chat-ui-toc-rail";
const ROOT_MARK = "data-bb-chat-ui-toc-root";
const CURRENT_MARK = "data-bb-chat-ui-toc-current";
const SELECTED_MARK = "data-bb-chat-ui-toc-selected";
const USER_TAB_LABEL = "Your messages";
const TICK_MAX_PX = 32;
const TICK_MIN_PX = 10;
const TICK_REACH_PX = 48;
const TICK_GAP_PX = 4;

export const threadTocCss = `
${glassSurfaceScopeCss}
[id^="thread-toc-panel-"] > .rounded-lg > .flex.items-center {
  display: none !important;
}
[id^="thread-toc-panel-"] .bg-gradient-to-b,
[id^="thread-toc-panel-"] .bg-gradient-to-t {
  display: none !important;
}
[id^="thread-toc-panel-"] ul > li {
  display: none !important;
}
[id^="thread-toc-panel-"] ul > li[${CURRENT_MARK}] {
  display: block !important;
}
[id^="thread-toc-panel-"] li button {
  background-color: transparent !important;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
}
[id^="thread-toc-panel-"] li button > span:first-child {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}
[id^="thread-toc-panel-"] .max-h-64 {
  max-height: 48rem !important;
}
[id^="thread-toc-panel-"] .line-clamp-2 {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}
[id^="thread-toc-panel-"] [${TOC_REPLY_MARK}] {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
}
[id^="thread-toc-panel-"] > .rounded-lg {
  border-radius: 18px !important;
  transform-origin: right center;
  transition: transform 140ms ease-out;
  background: ${LIGHT_GLASS_FACE} !important;
  border-color: transparent !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  box-shadow:
    0 6px 18px -12px color-mix(in oklab, var(--ink, var(--foreground)) 22%, transparent),
    inset 0 1px 3px color-mix(in oklab, var(--popover) 35%, transparent);
}
.dark [id^="thread-toc-panel-"] > .rounded-lg {
  background: ${DARK_GLASS_FACE} !important;
  border-color: transparent !important;
  box-shadow:
    0 6px 18px -12px color-mix(in oklab, black 60%, transparent),
    inset 0 1px 3px color-mix(in oklab, var(--foreground) 8%, transparent);
}
[id^="thread-toc-panel-"]:hover > .rounded-lg {
  transform: scale(1.05);
}
[data-thread-toc] button.no-scrollbar,
[data-thread-toc] button.no-scrollbar > span {
  align-items: flex-end !important;
  gap: ${TICK_GAP_PX}px !important;
}
[data-thread-toc] button.no-scrollbar span.rounded-full {
  width: ${TICK_MIN_PX}px;
  background-color: color-mix(in oklab, var(--foreground) 20%, transparent) !important;
  transition: none;
}
[data-thread-toc] button.no-scrollbar span.rounded-full[${SELECTED_MARK}] {
  background-color: color-mix(in oklab, var(--foreground) 72%, transparent) !important;
}
`;

const hoveredTickByRoot = new WeakMap<HTMLElement, number>();
const pendingNavigationByRoot = new WeakMap<HTMLElement, number>();
const currentItemByRoot = new WeakMap<HTMLElement, HTMLElement>();
const selectedTickByRoot = new WeakMap<HTMLElement, HTMLElement>();
const invalidateRail = new WeakMap<HTMLElement, () => void>();

export function tickWidth(distancePx: number): number {
  const distance = Math.max(0, distancePx);
  if (distance >= TICK_REACH_PX) return TICK_MIN_PX;
  const closeness = 1 - distance / TICK_REACH_PX;
  return TICK_MIN_PX + (TICK_MAX_PX - TICK_MIN_PX) * closeness * closeness;
}

export function listIndexForTick(
  tickIndex: number,
  tickCount: number,
  listCount: number,
): number {
  if (listCount <= 1 || tickCount <= 1) return 0;
  const index = Math.round(
    (tickIndex * (listCount - 1)) / (tickCount - 1),
  );
  return Math.min(listCount - 1, Math.max(0, index));
}

// native 목차의 표시·이동을 보완하고 소유 스타일과 응답을 해제한다.
export function injectThreadToc(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = threadTocCss;
  document.head.append(style);

  const cleanups = new Map<HTMLElement, () => void>();
  // 분리된 연결을 해제하고 현재 목차만 갱신한다.
  const paint = () => {
    for (const [node, cleanup] of cleanups) {
      if (node.isConnected) continue;
      cleanup();
      cleanups.delete(node);
    }
    for (const node of Array.from(
      document.querySelectorAll("[data-thread-toc] button.no-scrollbar"),
    )) {
      if (node instanceof HTMLButtonElement) bindRail(node, cleanups);
    }
    for (const node of Array.from(
      document.querySelectorAll("[data-thread-toc]"),
    )) {
      if (node instanceof HTMLElement) syncHoveredMessage(node);
    }
  };
  // 소유 응답의 변경은 제외하고 native 변경만 반영한다.
  const observer = new MutationObserver(records => {
    let changedToc = Array.from(cleanups.keys()).some(node => !node.isConnected);
    for (const record of records) {
      const target = record.target instanceof HTMLElement ? record.target : record.target.parentElement;
      if (target?.closest(`[${TOC_REPLY_MARK}]`)) continue;
      const changed = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes ?? [])];
      if (changed.length && changed.every(node => node instanceof HTMLElement && node.hasAttribute(TOC_REPLY_MARK))) continue;
      const rail = target?.closest<HTMLElement>('button.no-scrollbar');
      if (rail) invalidateRail.get(rail)?.();
      if (changedToc) continue;
      changedToc = !!target?.closest("[data-thread-toc]") || Array.from(record.addedNodes).some(node => node instanceof HTMLElement &&
        (node.matches("[data-thread-toc]") || node.querySelector("[data-thread-toc]")),
      );
    }
    if (changedToc) paint();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  paint();

  return () => {
    observer.disconnect();
    for (const cleanup of cleanups.values()) cleanup();
    cleanups.clear();
    style.remove();
  };
}

// 목차 눈금의 포인터·이동 동작을 한 번만 연결한다.
function bindRail(button: HTMLButtonElement, cleanups: Map<HTMLElement, () => void>) {
  if (button.hasAttribute(RAIL_MARK)) return;
  button.setAttribute(RAIL_MARK, "");
  const root = button.closest("[data-thread-toc]");
  const view = button.ownerDocument.defaultView;
  let frame = 0, clientY = 0, height: number | undefined;
  let geometry: { ticks: HTMLElement[]; centers: number[] } | undefined;
  // 대기 중인 이동을 취소하고 다음 진입 때 위치를 다시 읽는다.
  const reset = () => { if (frame) view?.cancelAnimationFrame(frame); frame = 0; geometry = undefined; };
  invalidateRail.set(button, reset);
  // 같은 프레임의 이동을 합치고 세로 위치를 읽은 뒤 너비를 바꾼다.
  const move = () => {
    frame = 0;
    if (!button.isConnected) return;
    const top = button.getBoundingClientRect().top;
    if (!geometry) {
      const ticks = tickElements(button);
      geometry = { ticks, centers: ticks.map(tick => { const rect = tick.getBoundingClientRect(); return rect.top - top + rect.height / 2; }) };
    }
    let index = 0, nearest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < geometry.ticks.length; i++) {
      const distance = Math.abs(clientY - top - geometry.centers[i]);
      if (distance < nearest) { nearest = distance; index = i; }
      const width = `${Math.round(tickWidth(distance))}px`;
      if (geometry.ticks[i].style.width !== width) geometry.ticks[i].style.width = width;
    }
    if (!(root instanceof HTMLElement)) return;
    if (hoveredTickByRoot.get(root) !== index) {
      hoveredTickByRoot.set(root, index);
      syncHoveredMessage(root);
    }
  };
  // 첫 진입은 즉시 처리하고 연속 이동은 다음 표시 프레임에 모은다.
  const onMove = (event: MouseEvent) => {
    clientY = event.clientY;
    if (!geometry || !view?.requestAnimationFrame) move();
    else if (!frame) frame = view.requestAnimationFrame(move);
  };
  // 너비 변화는 제외하고 목차 높이가 바뀔 때만 위치를 다시 읽는다.
  const resize = view && typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(entries => {
    const next = entries[0]?.contentRect.height;
    if (next !== height) { height = next; reset(); }
  }) : null;
  resize?.observe(button);
  view?.addEventListener('resize', reset);
  if (view) button.ownerDocument.addEventListener('scroll', reset, { capture: true, passive: true });
  // 실제 클릭은 최신 위치로 이동 대상을 확정한다.
  const onClick = (event: MouseEvent) => {
    reset();
    if (!(root instanceof HTMLElement) || tickElements(button).length === 0) return;
    const tickIndex = event.detail === 0
      ? hoveredTickByRoot.get(root) ?? 0
      : nearestTickIndex(button, event.clientY);
    hoveredTickByRoot.set(root, tickIndex);
    pendingNavigationByRoot.set(root, tickIndex);
    syncHoveredMessage(root);
  };
  button.addEventListener("mouseenter", onMove);
  button.addEventListener("mousemove", onMove);
  button.addEventListener("click", onClick);
  cleanups.set(button, () => {
    reset(); resize?.disconnect(); invalidateRail.delete(button);
    view?.removeEventListener('resize', reset);
    if (view) button.ownerDocument.removeEventListener('scroll', reset, true);
    button.removeEventListener("mouseenter", onMove);
    button.removeEventListener("mousemove", onMove);
    button.removeEventListener("click", onClick);
    button.removeAttribute(RAIL_MARK);
    clearTickWidths(button);
    for (const tick of tickElements(button)) tick.removeAttribute(SELECTED_MARK);
    if (root instanceof HTMLElement) {
      clearTocReplies(root);
      currentItemByRoot.get(root)?.removeAttribute(CURRENT_MARK); currentItemByRoot.delete(root);
      selectedTickByRoot.delete(root);
      hoveredTickByRoot.delete(root);
      pendingNavigationByRoot.delete(root);
    }
  });
  if (root instanceof HTMLElement) bindRootLeave(root, cleanups);
}

// 목차를 떠나거나 분리하면 미리보기와 눈금 상태를 지운다.
function bindRootLeave(root: HTMLElement, cleanups: Map<HTMLElement, () => void>) {
  if (root.hasAttribute(ROOT_MARK)) return;
  root.setAttribute(ROOT_MARK, "");
  // 목차 밖으로 나가면 예약 이동과 현재 표시를 함께 정리한다.
  const onLeave = (event: MouseEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.contains(next)) return;
    const rail = root.querySelector<HTMLElement>('button.no-scrollbar');
    if (rail) invalidateRail.get(rail)?.();
    releaseTocFocus(root);
    clearTocReplies(root);
    clearTickWidths(root);
    for (const tick of tickElements(root)) tick.removeAttribute(SELECTED_MARK);
    for (const item of Array.from(root.querySelectorAll(`[${CURRENT_MARK}]`))) {
      item.removeAttribute(CURRENT_MARK);
    }
    currentItemByRoot.delete(root); selectedTickByRoot.delete(root);
    hoveredTickByRoot.delete(root);
  };
  root.addEventListener("mouseleave", onLeave, true);
  cleanups.set(root, () => {
    clearTocReplies(root);
    root.removeEventListener("mouseleave", onLeave, true);
    root.removeAttribute(ROOT_MARK);
    clearTickWidths(root);
    for (const tick of tickElements(root)) tick.removeAttribute(SELECTED_MARK);
    for (const item of Array.from(root.querySelectorAll(`[${CURRENT_MARK}]`))) item.removeAttribute(CURRENT_MARK);
    hoveredTickByRoot.delete(root);
    pendingNavigationByRoot.delete(root);
    currentItemByRoot.delete(root); selectedTickByRoot.delete(root);
  });
}

// 선택한 native 사용자 항목에 응답을 붙이고 기존 이동 동작을 유지한다.
function syncHoveredMessage(root: HTMLElement) {
  const tickIndex = pendingNavigationByRoot.get(root) ?? hoveredTickByRoot.get(root);
  if (tickIndex !== undefined) markSelectedTick(root, tickIndex);
  const panel = root.querySelector('[id^="thread-toc-panel-"]');
  if (!(panel instanceof HTMLElement)) return;
  showOnlyUserMessages(panel);
  if (tickIndex === undefined) return;
  const ticks = tickElements(root);
  const items = panel.querySelector('ul')?.children;
  if (!items) return;
  const listIndex = listIndexForTick(tickIndex, ticks.length, items.length);
  const current = items[listIndex];
  if (current instanceof HTMLElement) {
    const previous = currentItemByRoot.get(root);
    if (previous !== current) { previous?.removeAttribute(CURRENT_MARK); current.setAttribute(CURRENT_MARK, ''); currentItemByRoot.set(root, current); }
    paintTocReply(root, current);
  }
  const scroller = panel.querySelector(".overflow-y-auto");
  if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
  const tick = ticks[tickIndex];
  if (tick) placePanelBesideTick(panel, tick);
  if (pendingNavigationByRoot.has(root)) {
    const target = items[listIndex]?.querySelector("button");
    if (target instanceof HTMLButtonElement) {
      pendingNavigationByRoot.delete(root);
      target.click();
    }
  }
}

function releaseTocFocus(root: HTMLElement) {
  const active = root.ownerDocument.activeElement;
  if (active instanceof HTMLElement && root.contains(active)) active.blur();
}

// 이전 눈금과 새 눈금만 갱신한다.
function markSelectedTick(root: HTMLElement, tickIndex: number) {
  const tick = tickElements(root)[tickIndex], previous = selectedTickByRoot.get(root);
  if (previous === tick) return;
  previous?.removeAttribute(SELECTED_MARK);
  if (tick) { tick.setAttribute(SELECTED_MARK, ''); selectedTickByRoot.set(root, tick); }
  else selectedTickByRoot.delete(root);
}

function showOnlyUserMessages(panel: HTMLElement) {
  const tab = Array.from(panel.querySelectorAll("button[aria-pressed]")).find(
    (button) => button.textContent?.trim() === USER_TAB_LABEL,
  );
  if (!(tab instanceof HTMLButtonElement)) return;
  if (tab.getAttribute("aria-pressed") === "true") return;
  tab.click();
}

function placePanelBesideTick(panel: HTMLElement, tick: HTMLElement) {
  const parent = panel.offsetParent;
  if (!(parent instanceof HTMLElement)) return;
  const parentRect = parent.getBoundingClientRect();
  const tickRect = tick.getBoundingClientRect();
  const tickCenter = tickRect.top - parentRect.top + tickRect.height / 2;
  const rawTop = tickCenter - panel.offsetHeight / 2;
  const maxTop = Math.max(0, parent.clientHeight - panel.offsetHeight);
  panel.style.top = `${Math.round(Math.min(Math.max(0, rawTop), maxTop))}px`;
}

function nearestTickIndex(button: HTMLButtonElement, clientY: number): number {
  const ticks = tickElements(button);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [index, tick] of ticks.entries()) {
    const rect = tick.getBoundingClientRect();
    const distance = Math.abs(clientY - (rect.top + rect.height / 2));
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

function clearTickWidths(root: ParentNode) {
  for (const tick of tickElements(root)) {
    tick.style.removeProperty("width");
  }
}

function tickElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll("span.rounded-full")).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
}
