import { CARD, createCardClose, cardSlot, cardStyle, infoCardCss } from './info-card.ts';
import { isQuoteMentionResource, isCodeQuoteIcon, quoteMentionIcon } from './quote-text.ts';
import { acceptJumpPulse, postHaptic, readHapticBridge } from './send-haptic.ts';
import { EASE, popoverRise } from './motion.ts';
import { SHEET_GEOMETRY } from './phone-sheet.ts';
import {COMPOSER_LEGACY_QUOTE,LEGACY_QUOTE_OPEN,legacyQuoteFromPreview,legacyQuotePreviewControl} from './legacy-quote-controls.ts';

export const QUOTE_PREVIEW_MARK='data-bb-chat-ui-quote-preview';
const MARK=QUOTE_PREVIEW_MARK, PANEL=MARK+'-card', DRAWER=MARK+'-drawer';
const LEGACY='[data-message-column] > .group\\/message blockquote, [data-promptbox-editor-scroll] [data-promptbox-editor-content] .ProseMirror blockquote';
const REMOVE='[data-bb-chat-ui-mention-remove], [data-bb-chat-ui-legacy-quote-remove]';
const before=new WeakMap<HTMLElement,Map<string,string|null>>();
type Reader=(id:string)=>Promise<string|null>;
const readers=new WeakMap<Document,Set<Reader>>();
export interface QuotePreviewOptions {readQuote?:Reader;}
// 문서의 원문 읽기 연결을 등록하고 해제한다.
export function registerQuoteReader(doc:Document,reader:Reader):()=>void {
 let set=readers.get(doc);if(!set)readers.set(doc,set=new Set());set.add(reader);
 return()=>{set!.delete(reader);if(!set!.size)readers.delete(doc);};
}
// 인용 필에 저장된 resource를 안전하게 읽는다.
function resource(node:Element):Record<string,unknown>|null {try{const value:unknown=JSON.parse(node.getAttribute('data-prompt-mention-resource')??'null');return value&&typeof value==='object'?value as Record<string,unknown>:null;}catch{return null;}}
// 원문 미리보기 대상인 인용만 판별한다.
function isQuote(node:HTMLElement):boolean {return !!legacyQuoteFromPreview(node)||node.matches(LEGACY)||isQuoteMentionResource(resource(node));}
// 입력 문서 밖의 인용에 접근성 표식만 추가한다.
export function decorateQuotePreview(node:HTMLElement):void {
 if(!isQuote(node)||node.matches(COMPOSER_LEGACY_QUOTE))return;
 if(!before.has(node))before.set(node,new Map(['tabindex','role','aria-haspopup','aria-expanded',MARK].map(a=>[a,node.getAttribute(a)])));
 for(const[a,v]of Object.entries({[MARK]:'',tabindex:'0',role:'button','aria-haspopup':'dialog'}))if(node.getAttribute(a)!==v)node.setAttribute(a,v);
 if(!node.hasAttribute('aria-expanded'))node.setAttribute('aria-expanded','false');
}
// 원래 접근성 속성을 복구한다.
export function clearQuotePreview(node:HTMLElement):void {const saved=before.get(node);if(!saved)return;for(const[a,v]of saved){if(v===null)node.removeAttribute(a);else node.setAttribute(a,v);}before.delete(node);}
// 기존 인용의 문단과 코드 줄바꿈을 원문으로 읽는다.
export function quoteDomText(node:HTMLElement):string {
 const block=(n:Node)=>n.nodeType===1&&/^(P|DIV|PRE|LI|BLOCKQUOTE)$/.test((n as Element).tagName);
 const visit=(n:Node):string=>{if(n.nodeType===3)return n.nodeValue??'';if(n.nodeType!==1)return'';const e=n as Element;
  if(e.matches('button,svg,[data-bb-chat-ui-legacy-quote-controls]'))return'';if(e.tagName==='BR')return'\n';
  return Array.from(e.childNodes).map((child,i,all)=>(i>0&&(block(child)||block(all[i-1]))?'\n':'')+visit(child)).join('');};
 return visit(node);
}

export const quotePreviewCss=`
${infoCardCss(`[${PANEL}]`)}
[${MARK}] { cursor:pointer; pointer-events:auto; transition-property:background-color,color !important; }
[${LEGACY_QUOTE_OPEN}] { position:absolute; display:block; pointer-events:auto; transform:translateY(-50%); margin:0; padding:0; border:0; border-radius:999px; background:transparent; cursor:pointer; }
[${LEGACY_QUOTE_OPEN}]:focus-visible, [${MARK}]:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
[${PANEL}] { position:fixed; z-index:100; display:flex; flex-direction:column; max-height:var(--bb-chat-ui-info-max-height,min(50dvh,26rem)); }
[${PANEL}] > [${cardSlot.head}] { flex-shrink:0; }
[${PANEL}] > [${cardSlot.body}] { overflow:auto; min-height:0; overscroll-behavior:contain; }
[${PANEL}] [data-bb-chat-ui-quote-text] { ${cardStyle.prose} white-space:pre-wrap; overflow-wrap:anywhere; }
[${PANEL}] [data-bb-chat-ui-quote-text][data-code] { font-family:var(--font-mono,ui-monospace,monospace); }
[${PANEL}] [data-bb-chat-ui-quote-label] { ${cardStyle.titleText} margin:0 0 var(--bb-chat-ui-card-gap); overflow-wrap:anywhere; }
[${PANEL}] [${cardSlot.meta}] { ${cardStyle.meta} margin:0 0 var(--bb-chat-ui-card-gap); }
[${DRAWER}] { position:fixed; inset:0; width:100%; height:100%; max-width:none; max-height:none; margin:0; padding:0; border:0; background:transparent; overflow:hidden; color:inherit; }
[${DRAWER}]::backdrop { background:transparent; }
[${PANEL}][data-mode="phone"] {
  border-radius:30px !important;
  padding-top:calc(var(--bb-chat-ui-card-pad-y) + ${SHEET_GEOMETRY.padTop}px) !important;
  padding-bottom:calc(var(--bb-chat-ui-card-pad-y) + max(0px,calc(var(--bb-safe-area-bottom,env(safe-area-inset-bottom,0px)) - ${SHEET_GEOMETRY.bottom}px))) !important;
  --bb-chat-ui-card-close-top:calc(var(--bb-chat-ui-card-pad-y) + ${SHEET_GEOMETRY.padTop}px + (var(--bb-chat-ui-card-head) - var(--bb-chat-ui-card-icon)) / 2 - .5px);
  transition:translate 160ms ${EASE.out};
}
[${PANEL}][data-dragging] { transition:none; }
[${PANEL}] [data-bb-chat-ui-quote-handle] { position:absolute; top:0; left:0; width:100%; height:${SHEET_GEOMETRY.padTop}px; margin:0; padding:0; border:0; background:transparent; touch-action:none; cursor:grab; }
[${PANEL}] [data-bb-chat-ui-quote-handle]::before { content:""; position:absolute; top:8px; left:calc(50% - 20px); width:40px; height:4px; border-radius:999px; background:var(--muted-foreground); opacity:.4; }
@media(prefers-reduced-motion:reduce) { [${PANEL}] { transition:none !important; } }
`;

// Hover 원문과 phone 모달 하나를 관리하고 소유 작업을 해제한다.
export function injectQuotePreview(doc: Document, options: QuotePreviewOptions = {}): () => void {
 const rootView = doc.defaultView;
 if (!rootView) return () => {};
 const view = rootView;
 const sheet = doc.createElement('style'); sheet.id = 'bb-chat-ui-quote-preview'; sheet.textContent = quotePreviewCss; doc.head.append(sheet);
 for (const node of Array.from(doc.querySelectorAll<HTMLElement>(`${LEGACY}, .prompt-mention-pill[data-prompt-mention-resource]`))) decorateQuotePreview(node);
 let active: { trigger: HTMLElement; card: HTMLElement; phone: boolean; mode: 'hover' | 'keyboard' | 'phone'; dialog: HTMLDialogElement | null; release: () => void; animation: Animation | null } | null = null;
 let disposed = false, leaveTimer: number | null = null;
 const pulses = new WeakMap<HTMLElement, number>();
 let cachedReader: Reader | undefined;
 const originals = new Map<string, { value: Promise<string | null>; size: number; expires: number }>();
 // 같은 연결의 원문 조회를 합치고 최근 원문만 1분간 제한된 크기로 보관한다.
 const readOriginal = (read: Reader, id: string): Promise<string | null> => {
  if (cachedReader !== read) { originals.clear(); cachedReader = read; }
  const cached = originals.get(id);
  if (cached && cached.expires > Date.now()) { originals.delete(id); originals.set(id, cached); return cached.value; }
  const entry = { value: read(id), size: 0, expires: Date.now() + 60_000 }; originals.delete(id); originals.set(id, entry);
  // 항목 수와 원문 글자 수를 함께 제한하며 오래된 항목부터 해제한다.
  const trim = () => {
   let size = [...originals.values()].reduce((sum, item) => sum + item.size, 0);
   while (originals.size > 16 || size > 128_000) { const oldest = originals.keys().next().value!; size -= originals.get(oldest)!.size; originals.delete(oldest); }
  };
  trim();
  void entry.value.then(text => {
   if (disposed || originals.get(id) !== entry) return;
   if (text === null) originals.delete(id);
   else { entry.size = text.length; trim(); }
  }, () => { if (originals.get(id) === entry) originals.delete(id); });
  return entry.value;
 };
 // BB의 device 표식으로 phone을 판별한다.
 const isPhone = () => doc.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone';
 // 두 번째 이후의 touch 조작을 제외한다.
 const secondary = (event: Event) => 'pointerType' in event && event.pointerType === 'touch' && 'isPrimary' in event && !event.isPrimary;
 // Phone의 명시적 조작에만 기존 간격으로 햅틱을 보낸다.
 const pulse = (trigger: HTMLElement, event?: Event) => {
  if ((event && secondary(event)) || !isPhone()) return;
  const at = acceptJumpPulse(pulses.get(trigger) ?? null, view.performance.now());
  if (at !== null && postHaptic(readHapticBridge(view), 'impact-light')) pulses.set(trigger, at);
 };
 // 삭제 조작을 제외하고 기존 인용과 원문 버튼을 찾는다.
 const fromTarget = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof view.Element) || target.closest(REMOVE)) return null;
  const control = target.closest<HTMLButtonElement>(`[${LEGACY_QUOTE_OPEN}]`);
  if (control && legacyQuoteFromPreview(control)) return control;
  const node = target.closest<HTMLElement>(`[${MARK}], blockquote, .prompt-mention-pill`);
  return node?.matches(COMPOSER_LEGACY_QUOTE) ? legacyQuotePreviewControl(node) : node && isQuote(node) ? node : null;
 };
 // Hover 닫기 대기를 취소한다.
 const cancelLeave = () => { if (leaveTimer !== null) view.clearTimeout(leaveTimer); leaveTimer = null; };
 // 카드와 모달·스크롤 잠금·예약 작업을 함께 해제한다.
 const close = (feedback = true, restore = true, event?: Event) => {
  cancelLeave(); if (!active) return;
  const state = active; active = null;
  state.trigger.setAttribute('aria-expanded', 'false'); state.animation?.cancel();
  if (state.dialog?.open) state.dialog.close();
  state.dialog?.remove(); state.card.remove(); state.release();
  view.removeEventListener('resize', place); view.visualViewport?.removeEventListener('resize', place); view.visualViewport?.removeEventListener('scroll', place);
  doc.removeEventListener('scroll', onScroll, true); view.removeEventListener('popstate', onNavigation);
  if (feedback) pulse(state.trigger, event);
  if (restore && state.trigger.isConnected) state.trigger.focus({ preventScroll: true });
 };
 // 필에서 카드로 포인터를 옮길 짧은 대기 시간을 둔다.
 const scheduleLeave = () => { cancelLeave(); leaveTimer = view.setTimeout(() => close(false, false), 120); };
 // Desktop은 필에 맞추고 phone은 보이는 화면의 아래에 고정한다.
 function place() {
  if (!active) return;
  const { trigger, card, phone } = active;
  if (!trigger.isConnected || phone !== isPhone()) { close(false, false); return; }
  const viewport = view.visualViewport;
  const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? view.innerWidth, height = viewport?.height ?? view.innerHeight;
  if (phone) {
   card.style.width = `${Math.max(0, width - SHEET_GEOMETRY.inset * 2)}px`;
   card.style.left = `${left + SHEET_GEOMETRY.inset}px`; card.style.top = 'auto';
   card.style.bottom = `${Math.max(0, view.innerHeight - top - height) + SHEET_GEOMETRY.bottom}px`;
   card.style.maxHeight = `min(var(--bb-chat-ui-info-max-height,min(50dvh,26rem)), ${Math.max(0, height - SHEET_GEOMETRY.inset * 2)}px)`;
   return;
  }
  const rect = (legacyQuoteFromPreview(trigger) ?? trigger).getBoundingClientRect();
  const cardWidth = Math.min(420, Math.max(0, width - 32)), above = rect.top - top >= 112;
  card.style.width = `${cardWidth}px`; card.style.left = `${Math.max(left + 16, Math.min(rect.left, left + width - cardWidth - 16))}px`;
  const available = above ? rect.top - top - 24 : top + height - rect.bottom - 24;
  card.style.maxHeight = `min(var(--bb-chat-ui-info-max-height,min(50dvh,26rem)), ${Math.max(64, available)}px)`;
  card.style.top = above ? 'auto' : `${rect.bottom + 8}px`;
  card.style.bottom = above ? `${view.innerHeight - rect.top + 8}px` : 'auto';
 }
 // Desktop 외부 스크롤은 닫고 원문 내부 스크롤은 유지한다.
 function onScroll(event: Event) { if (active && !active.phone && event.target instanceof view.Node && !active.card.contains(event.target)) close(false, false); }
 // Native 화면 이동 때 원문을 닫는다.
 function onNavigation() { close(false, false); }
 // Phone 손잡이를 아래로 당긴 조작만 닫기로 처리한다.
 function bindHandle(handle: HTMLElement, card: HTMLElement): () => void {
  let drag: { id: number; y: number; distance: number } | null = null;
  // 손잡이의 첫 포인터를 문서 안에서 추적한다.
  const start = (event: PointerEvent) => {
   if (event.button !== 0 || event.isPrimary === false) return;
   drag = { id: event.pointerId, y: event.clientY, distance: 0 }; card.setAttribute('data-dragging', '');
  };
  // 손잡이 밖으로 이동해도 같은 포인터의 하향 이동을 반영한다.
  const move = (event: PointerEvent) => {
   if (!drag || drag.id !== event.pointerId) return;
   drag.distance = Math.max(0, event.clientY - drag.y); card.style.translate = `0 ${drag.distance}px`;
  };
  // 취소되거나 끝난 끌기의 임시 위치를 복구한다.
  const reset = () => { drag = null; card.removeAttribute('data-dragging'); card.style.translate = ''; };
  // 기준 이동률을 넘으면 닫고 짧은 조작은 복구한다.
  const end = (event: PointerEvent) => {
   if (!drag || drag.id !== event.pointerId) return;
   const dismiss = drag.distance > card.getBoundingClientRect().height * SHEET_GEOMETRY.closeRatio;
   reset(); if (dismiss) close();
  };
  // 다른 포인터의 취소는 진행 중인 끌기에 영향을 주지 않는다.
  const cancel = (event: PointerEvent) => { if (drag?.id === event.pointerId) reset(); };
  handle.addEventListener('pointerdown', start);
  doc.addEventListener('pointermove', move, true); doc.addEventListener('pointerup', end, true); doc.addEventListener('pointercancel', cancel, true); view.addEventListener('blur', reset);
  return () => {
   reset(); handle.removeEventListener('pointerdown', start);
   doc.removeEventListener('pointermove', move, true); doc.removeEventListener('pointerup', end, true); doc.removeEventListener('pointercancel', cancel, true); view.removeEventListener('blur', reset);
  };
 }
 // 원문 하나만 열고 늦은 응답이 다른 인용을 덮어쓰지 않게 한다.
 async function open(trigger: HTMLElement, mode: 'hover' | 'keyboard' | 'phone', event: Event) {
  cancelLeave();
  if (active?.trigger === trigger) {
   if (mode === 'hover') return;
   if (active.mode === 'hover') { active.mode = mode; active.card.querySelector<HTMLButtonElement>(`[${cardSlot.close}]`)?.focus({ preventScroll: true }); return; }
   close(true, true, event); return;
  }
  close(false, false); decorateQuotePreview(trigger);
  const phone = isPhone(), card = doc.createElement('section');
  card.setAttribute(PANEL, ''); card.setAttribute(CARD, ''); if (!phone) card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', '인용 원문'); card.setAttribute('aria-busy', 'true'); card.setAttribute('data-mode', phone ? 'phone' : 'desktop');
  const head = doc.createElement('header'); head.setAttribute(cardSlot.head, '');
  const title = doc.createElement('span'); title.setAttribute(cardSlot.title, ''); title.textContent = '인용 원문'; head.append(title);
  const button = createCardClose(doc, '인용 원문 닫기'); button.removeAttribute('title');
  const body = doc.createElement('div'); body.setAttribute(cardSlot.body, '');
  const source = legacyQuoteFromPreview(trigger) ?? trigger, data = resource(source);
  const label = doc.createElement('h3'); label.setAttribute('data-bb-chat-ui-quote-label', '');
  label.textContent = typeof data?.label === 'string' && data.label.trim() ? data.label : quoteDomText(source).trim().split('\n')[0] || '인용';
  const location = doc.createElement('p'); location.setAttribute(cardSlot.meta, ''); location.textContent = '원문 위치 정보 없음';
  const text = doc.createElement('div'); text.setAttribute('data-bb-chat-ui-quote-text', ''); text.setAttribute(cardSlot.prose, ''); text.tabIndex = 0; text.textContent = '불러오는 중…';
  body.append(label, location, text); card.append(head, button, body);
  const dialog = phone ? doc.createElement('dialog') : null;
  const state = { trigger, card, phone, mode, dialog, release: () => {}, animation: null as Animation | null }; active = state;
  trigger.setAttribute('aria-expanded', 'true');
  if (dialog) {
   dialog.setAttribute(DRAWER, ''); dialog.setAttribute('aria-label', '인용 원문'); dialog.setAttribute('aria-modal', 'true'); dialog.append(card); doc.body.append(dialog);
   const handle = doc.createElement('div'); handle.setAttribute('data-bb-chat-ui-quote-handle', ''); handle.setAttribute('aria-hidden', 'true'); card.prepend(handle); const releaseHandle = bindHandle(handle, card);
   const style = doc.documentElement.style, overflow = style.getPropertyValue('overflow'), priority = style.getPropertyPriority('overflow');
   style.setProperty('overflow', 'hidden', 'important');
   state.release = () => { releaseHandle(); if (style.getPropertyValue('overflow') === 'hidden' && style.getPropertyPriority('overflow') === 'important') { if (overflow) style.setProperty('overflow', overflow, priority); else style.removeProperty('overflow'); } };
   dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
   if (typeof dialog.showModal !== 'function') { close(false, false); return; }
   try { dialog.showModal(); } catch { close(false, false); return; }
  } else doc.body.append(card);
  place();
  if (active !== state) return;
  if (mode !== 'hover') button.focus({ preventScroll: true });
  if (!trigger.isConnected) { close(false, false); return; }
  pulse(trigger, event); state.animation = popoverRise(card);
  view.addEventListener('resize', place); view.visualViewport?.addEventListener('resize', place); view.visualViewport?.addEventListener('scroll', place);
  doc.addEventListener('scroll', onScroll, { capture: true, passive: true }); view.addEventListener('popstate', onNavigation);
  try {
   let content: string | null;
   if (source.matches(LEGACY)) content = quoteDomText(source);
   else {
    const id = typeof data?.itemId === 'string' ? data.itemId.slice('quote:'.length) : '';
    const read = options.readQuote ?? [...(readers.get(doc) ?? [])].at(-1);
    if (!read) throw Error('reader unavailable'); content = await readOriginal(read, id);
   }
   if (disposed || active !== state) return;
   if (!trigger.isConnected) { close(false, false); return; }
   text.textContent = content ?? '인용 원문을 찾지 못했습니다.';
   if (isCodeQuoteIcon(data?.icon) || source.querySelector('pre,code') || isCodeQuoteIcon(quoteMentionIcon(content ?? ''))) text.setAttribute('data-code', '');
   place();
  } catch { if (active === state) text.textContent = '인용 원문을 불러오지 못했습니다.'; }
  finally { if (active === state) card.setAttribute('aria-busy', 'false'); }
 }
 // Desktop hover로 열고 카드 안으로 옮길 때는 유지한다.
 const onOver = (event: PointerEvent) => {
  if (isPhone() || event.pointerType === 'touch') return;
  if (active?.card.contains(event.target as Node)) { cancelLeave(); return; }
  const trigger = fromTarget(event.target); if (trigger) void open(trigger, 'hover', event);
 };
 // 필과 카드에서 벗어난 hover만 닫는다.
 const onOut = (event: PointerEvent) => {
  if (!active || active.mode !== 'hover') return;
  const next = event.relatedTarget;
  if (next instanceof view.Node && (active.trigger.contains(next) || active.card.contains(next))) { cancelLeave(); return; }
  scheduleLeave();
 };
 // Phone 탭과 닫기를 처리하고 desktop 클릭은 hover를 전환하지 않는다.
 const onClick = (event: MouseEvent) => {
  if (event.target instanceof view.Element && active?.card.contains(event.target)) {
   if (event.target.closest(`[${cardSlot.close}]`)) { event.preventDefault(); event.stopPropagation(); close(true, true, event); }
   return;
  }
  const trigger = fromTarget(event.target); if (!trigger || secondary(event)) return;
  event.preventDefault(); event.stopPropagation(); if (isPhone()) void open(trigger, 'phone', event);
 };
 // 키보드로도 열고 Escape로 원래 인용에 돌아간다.
 const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && active) { event.preventDefault(); event.stopPropagation(); close(true, active.mode !== 'hover', event); return; }
  if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
  const trigger = fromTarget(event.target); if (!trigger) return;
  event.preventDefault(); event.stopPropagation(); void open(trigger, isPhone() ? 'phone' : 'keyboard', event);
 };
 // 모달 배경과 바깥 누르기는 닫고 같은 필 클릭은 유지한다.
 const onOutside = (event: Event) => {
  if (!active || !(event.target instanceof view.Node) || active.card.contains(event.target) || active.trigger.contains(event.target)) return;
  const other = !!fromTarget(event.target); close(!other, !other && active.mode !== 'hover', event);
 };
 doc.addEventListener('pointerover', onOver, true); doc.addEventListener('pointerout', onOut, true);
 doc.addEventListener('click', onClick, true); doc.addEventListener('keydown', onKey, true); doc.addEventListener('pointerdown', onOutside, true);
 return () => {
  if (disposed) return; disposed = true; close(false, false); originals.clear(); cachedReader = undefined;
  doc.removeEventListener('pointerover', onOver, true); doc.removeEventListener('pointerout', onOut, true);
  doc.removeEventListener('click', onClick, true); doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('pointerdown', onOutside, true);
  for (const node of Array.from(doc.querySelectorAll<HTMLElement>(`[${MARK}]`))) clearQuotePreview(node);
  sheet.remove();
 };
}
