import { decorateQuotePreview, clearQuotePreview } from "./quote-preview.ts";
import { deleteWithCaret } from "./delete-with-caret.ts";
import { pillSlot, pillStyle } from "./pill.ts";
import { QUOTE_MARK_MASK, QUOTE_MESSAGE_MASK, QUOTE_CODE_MASK, REFERENCE_FILE_MASK } from "./quote-icons.ts";
import { decorateLegacyQuote, LEGACY_QUOTE_REMOVE, pruneLegacyQuoteControls } from "./legacy-quote-controls.ts";
import {
  isCodeQuoteIcon,
  QUOTE_GESTURE_ATTR,
  QUOTE_WHOLE_ICON,
  isQuoteMentionResource,
  quoteGestureFromControl,
} from "./quote-text.ts";

const MENTION_RESOURCE = "data-prompt-mention-resource";
const ICON_MARK = "data-bb-chat-ui-quote-icon";
const MESSAGE_GLYPH = pillSlot.icon;

interface QuoteIconState {
  glyph: HTMLElement;
  native: HTMLElement | SVGElement | null;
  display: string;
  priority: string;
  mark: string | null;
  mask: string;
}

interface MentionView {
  state: { tr: { delete: (from: number, to: number) => unknown } };
  dispatch: (transaction: unknown) => void;
}

interface MentionDesc {
  posBefore: number;
  posAfter: number;
  node?: { attrs?: { resource?: unknown; mention?: unknown } };
  view: MentionView;
}

type MentionElement = HTMLElement & { pmViewDesc?: MentionDesc };

// 인용·파일의 공통 아이콘과 인용 전용 편집 동작을 설치하고 해제한다.
export function injectQuoteMentions(doc: Document): () => void {
  const root = doc.documentElement;
  if (!root) return () => {};

  const icons = new Map<HTMLElement, QuoteIconState>();
  // 연결된 인용·파일을 장식하고 재사용된 다른 멘션의 자산을 복구한다.
  const decorate = (node: HTMLElement) => {
    if (!node.isConnected) { clearQuoteGlyph(node, icons); return; }
    lockQuoteMention(node, icons);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const mention = quoteMentionFromTarget(event.target) ?? quoteMentionFromSelection(doc);
    if (!mention) return;
    event.preventDefault();
    event.stopPropagation();
    deleteMention(mention);
  };
  const onBeforeInput = (event: InputEvent) => {
    const mention = quoteMentionFromTarget(event.target) ?? quoteMentionFromSelection(doc);
    if (!mention) return;
    event.preventDefault();
    event.stopPropagation();
    if (
      event.inputType === "deleteContentBackward" ||
      event.inputType === "deleteContentForward"
    ) {
      deleteMention(mention);
    }
  };

  // 바뀐 부분 트리와 인용만 갱신하고 소유 자산의 분리도 처리한다.
  const observer = new MutationObserver(records => {
    const candidates = new Set<HTMLElement>();
    const subtrees = new Set<Element>();
    for (const record of records) {
      // 분리된 부분 트리에서만 소유 자산을 해제하고 문서 전체를 다시 찾지 않는다.
      for (const removed of Array.from(record.removedNodes)) {
        if (!(removed instanceof HTMLElement) || removed.isConnected || !icons.size) continue;
        clearQuoteGlyph(removed, icons);
        for (const node of Array.from(removed.querySelectorAll(`[${ICON_MARK}]`))) {
          if (node instanceof HTMLElement) clearQuoteGlyph(node, icons);
        }
      }
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      // These records are our completed lock/glyph writes, not native changes.
      if (record.attributeName === "contenteditable" && target instanceof HTMLElement && target.contentEditable === "false") continue;
      if (record.type === "childList" && record.addedNodes.length && Array.from(record.addedNodes).every(node =>
        node instanceof Element && (node.hasAttribute(MESSAGE_GLYPH) || node.hasAttribute(LEGACY_QUOTE_REMOVE)))) continue;
      const legacy = target?.closest("blockquote");
      if (legacy instanceof HTMLElement) { decorateLegacyQuote(legacy); decorateQuotePreview(legacy); }
      const mention = target?.closest(`[${MENTION_RESOURCE}]`);
      if (mention instanceof HTMLElement) candidates.add(mention);
      if (record.attributeName === MENTION_RESOURCE && target instanceof HTMLElement) candidates.add(target);
      const added = Array.from(record.addedNodes).filter((node): node is Element => node instanceof Element);
      const addedSet = new Set(added);
      if (target && added.length > 1 && Array.from(target.children).every(node => addedSet.has(node))) subtrees.add(target);
      else for (const node of added) subtrees.add(node);
    }
    // Mutation batches can contain both a newly inserted ancestor and its children.
    for (const subtree of subtrees) {
      let parent = subtree.parentElement;
      while (parent && !subtrees.has(parent)) parent = parent.parentElement;
      if (parent) continue;
      if (subtree instanceof HTMLElement) {
        if (subtree.hasAttribute(MENTION_RESOURCE)) candidates.add(subtree);
        if (subtree.tagName === "BLOCKQUOTE") { decorateLegacyQuote(subtree); decorateQuotePreview(subtree); }
      }
      for (const node of Array.from(subtree.querySelectorAll(`[${MENTION_RESOURCE}], blockquote`))) {
        if (node instanceof HTMLElement) { if (node.tagName === "BLOCKQUOTE") { decorateLegacyQuote(node); decorateQuotePreview(node); } else candidates.add(node); }
      }
    }
    for (const node of candidates) decorate(node);
    pruneLegacyQuoteControls(doc);
  });
  observer.observe(root, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: [MENTION_RESOURCE, "contenteditable"],
  });
  const onQuoteGesture = (event: Event) => {
    const gesture = quoteGestureFromTarget(event.target);
    if (!gesture) return;
    doc.documentElement.setAttribute(QUOTE_GESTURE_ATTR, gesture);
  };
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("beforeinput", onBeforeInput, true);
  doc.addEventListener("pointerdown", onQuoteGesture, true);
  doc.addEventListener("click", onQuoteGesture, true);
  doc.addEventListener("pointerup", onQuoteGesture, true);
  for (const node of Array.from(doc.querySelectorAll(`[${MENTION_RESOURCE}], blockquote`))) if (node instanceof HTMLElement) {
    if (node.tagName === "BLOCKQUOTE") { decorateLegacyQuote(node); decorateQuotePreview(node); } else decorate(node);
  }

  // 관찰과 입력 처리를 해제하고 원래 아이콘 표시를 복구한다.
  return () => {
    observer.disconnect();
    for (const node of icons.keys()) clearQuoteGlyph(node, icons);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("beforeinput", onBeforeInput, true);
    doc.removeEventListener("pointerdown", onQuoteGesture, true);
    doc.removeEventListener("click", onQuoteGesture, true);
    doc.removeEventListener("pointerup", onQuoteGesture, true);
  };
}

function quoteGestureFromTarget(target: EventTarget | null) {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  const control = element?.closest("button, [role='menuitem']");
  if (!(control instanceof HTMLElement)) return null;
  return quoteGestureFromControl({
    role: control.getAttribute("role"),
    ariaLabel: control.getAttribute("aria-label"),
    text: control.textContent ?? "",
  });
}

// 파일에는 아이콘만 표시하고 인용에만 잠금과 원문 팝업을 적용한다.
function lockQuoteMention(node: HTMLElement, icons: Map<HTMLElement, QuoteIconState>) {
  const resource = mentionResource(node);
  const record = resource as { kind?: unknown; entryKind?: unknown; icon?: unknown; label?: unknown } | null;
  if (record?.kind === "path" && record.entryKind === "file") {
    clearQuotePreview(node);
    paintMentionIcon(node, REFERENCE_FILE_MASK, "file", icons);
    return;
  }
  const root = mentionRoot(node) ?? node;
  if (!isQuoteMentionResource(resource)) { clearQuotePreview(root); clearQuoteGlyph(root, icons); return; }
  decorateQuotePreview(root);
  if (root.contentEditable !== "false") root.contentEditable = "false";
  if (root.style.maxWidth !== "100%") root.style.maxWidth = "100%";
  if (root.style.whiteSpace !== "nowrap") root.style.whiteSpace = "nowrap";
  const code = isCodeQuoteIcon(record?.icon) ||
    (typeof record?.label === "string" && record.label.startsWith("diff --git "));
  const whole = record?.icon === QUOTE_WHOLE_ICON;
  paintMentionIcon(root, code ? QUOTE_CODE_MASK : whole ? QUOTE_MESSAGE_MASK : QUOTE_MARK_MASK,
    code ? "code" : whole ? "whole" : "selection", icons);
}

function mentionResource(node: HTMLElement): unknown {
  const raw = node.getAttribute(MENTION_RESOURCE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 인용·파일의 공통 glyph를 표시하고 호스트 아이콘의 원래 상태를 보관한다.
function paintMentionIcon(root: HTMLElement, mask: string, mark: string, icons: Map<HTMLElement, QuoteIconState>) {
  let state = icons.get(root);
  if (!state) {
    const glyph = root.ownerDocument.createElement("span");
    glyph.setAttribute(MESSAGE_GLYPH, "");
    glyph.setAttribute("aria-hidden", "true");
    glyph.style.cssText = pillStyle.quoteGlyph;
    state = { glyph, native: null, display: "", priority: "", mark: root.getAttribute(ICON_MARK), mask: "" };
    icons.set(root, state);
  }
  if (root.getAttribute(ICON_MARK) !== mark) root.setAttribute(ICON_MARK, mark);
  const icon = iconRoot(root);
  const native = icon instanceof HTMLElement || icon instanceof SVGElement ? icon : null;
  if (state.native !== native) {
    restoreNativeIcon(state);
    state.native = native;
    state.display = native?.style.getPropertyValue("display") ?? "";
    state.priority = native?.style.getPropertyPriority("display") ?? "";
  }
  if (native && (native.style.display !== "none" || native.style.getPropertyPriority("display") !== "important")) {
    native.style.setProperty("display", "none", "important");
  }
  if (state.mask !== mask) {
    state.glyph.style.webkitMask = mask;
    state.glyph.style.mask = mask;
    state.mask = mask;
  }
  const parent = icon?.parentElement ?? root;
  if (state.glyph.parentElement !== parent) parent.insertBefore(state.glyph, icon ?? parent.firstChild);
}

// 호스트가 제공한 아이콘 자리만 찾는다.
function iconRoot(root: HTMLElement): Element | null {
  return root.querySelector("[data-icon-root]");
}

// 플러그인이 숨긴 호스트 아이콘의 원래 display 값만 복구한다.
function restoreNativeIcon(state: QuoteIconState) {
  if (state.native?.style.display !== "none" || state.native.style.getPropertyPriority("display") !== "important") return;
  if (state.display) state.native.style.setProperty("display", state.display, state.priority);
  else state.native.style.removeProperty("display");
}

// 소유 glyph와 표식만 제거하고 호스트 아이콘은 그대로 복구한다.
function clearQuoteGlyph(root: HTMLElement, icons: Map<HTMLElement, QuoteIconState>) {
  const state = icons.get(root);
  if (!state) return;
  state.glyph.remove();
  restoreNativeIcon(state);
  if (state.mark === null) root.removeAttribute(ICON_MARK);
  else root.setAttribute(ICON_MARK, state.mark);
  icons.delete(root);
}

function isQuoteMentionElement(node: HTMLElement): boolean {
  const raw = node.getAttribute(MENTION_RESOURCE);
  if (!raw) return false;
  try {
    return isQuoteMentionResource(JSON.parse(raw));
  } catch {
    return false;
  }
}

function mentionRoot(node: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      const desc = (current as MentionElement).pmViewDesc;
      if (desc?.node && isQuoteMentionResource(desc.node.attrs?.resource ?? desc.node.attrs?.mention)) return current;
    }
    current = current.parentElement;
  }
  return node.closest(".ProseMirror") ? node : null;
}

function quoteMentionFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  const marked = element?.closest(`[${MENTION_RESOURCE}]`);
  if (!(marked instanceof HTMLElement) || !isQuoteMentionElement(marked)) return null;
  return mentionRoot(marked);
}

function quoteMentionFromSelection(doc: Document): HTMLElement | null {
  const selection = doc.getSelection?.();
  return quoteMentionFromTarget(selection?.anchorNode ?? null);
}

function deleteMention(mention: HTMLElement) {
  const desc = (mention as MentionElement).pmViewDesc;
  if (!desc?.view?.dispatch || !desc.view.state?.tr?.delete) return;
  if (!Number.isInteger(desc.posBefore) || !Number.isInteger(desc.posAfter)) return;
  if (desc.posAfter <= desc.posBefore) return;
  try {
    deleteWithCaret(desc.view, desc.posBefore, desc.posAfter);
  } catch {
    return;
  }
}
