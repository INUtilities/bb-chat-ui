import { decorateQuotePreview, clearQuotePreview } from "./quote-preview.ts";
import { pillSlot, pillStyle } from "./pill.ts";
import { QUOTE_MARK_MASK } from "./quote-pill.ts";
import { decorateLegacyQuote, LEGACY_QUOTE_REMOVE, pruneLegacyQuoteControls } from "./legacy-quote-controls.ts";
import {
  QUOTE_CODE_ICON,
  QUOTE_GESTURE_ATTR,
  QUOTE_WHOLE_ICON,
  isQuoteMentionResource,
  quoteGestureFromControl,
} from "./quote-text.ts";

const MENTION_RESOURCE = "data-prompt-mention-resource";
const ICON_MARK = "data-bb-chat-ui-quote-icon";
const CODE_CLONE = "data-bb-chat-ui-code-icon";
const MESSAGE_GLYPH = pillSlot.icon;
const DIFF_ICON_SOURCE = "#thread-prompt-banner-git-toggle [data-icon=\"FileDiff\"]";

interface MentionView {
  state: { tr: { delete: (from: number, to: number) => unknown } };
  dispatch: (transaction: unknown) => void;
}

interface MentionDesc {
  posBefore: number;
  posAfter: number;
  node?: { attrs?: { resource?: unknown } };
  view: MentionView;
}

type MentionElement = HTMLElement & { pmViewDesc?: MentionDesc };

export function injectQuoteMentions(doc: Document): () => void {
  const root = doc.documentElement;
  if (!root) return () => {};

  const pendingCodes = new Set<HTMLElement>();
  const decorate = (node: HTMLElement) => {
    if (!node.isConnected) { pendingCodes.delete(node); return; }
    if (lockQuoteMention(node, doc)) pendingCodes.add(node);
    else pendingCodes.delete(node);
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

  const observer = new MutationObserver(records => {
    const candidates = new Set<HTMLElement>();
    const subtrees = new Set<Element>();
    for (const node of pendingCodes) if (!node.isConnected) pendingCodes.delete(node);
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      // These records are our completed lock/glyph writes, not native changes.
      if (record.attributeName === "contenteditable" && target instanceof HTMLElement && target.contentEditable === "false") continue;
      if (record.type === "childList" && record.addedNodes.length && Array.from(record.addedNodes).every(node =>
        node instanceof Element && (node.hasAttribute(MESSAGE_GLYPH) || node.hasAttribute(CODE_CLONE) || node.hasAttribute(LEGACY_QUOTE_REMOVE)))) continue;
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
      if (pendingCodes.size && (subtree.matches(DIFF_ICON_SOURCE) ||
        (subtree.id === "thread-prompt-banner-git-toggle" ? subtree.querySelector('[data-icon="FileDiff"]') : subtree.querySelector(DIFF_ICON_SOURCE)))) {
        for (const node of pendingCodes) candidates.add(node);
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

  return () => {
    observer.disconnect();
    pendingCodes.clear();
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

function lockQuoteMention(node: HTMLElement, doc: Document) {
  const resource = mentionResource(node);
  const root = mentionRoot(node) ?? node;
  if (!isQuoteMentionResource(resource)) { clearQuotePreview(root); return false; }
  decorateQuotePreview(root);
  if (root.contentEditable !== "false") root.contentEditable = "false";
  if (root.style.maxWidth !== "100%") root.style.maxWidth = "100%";
  if (root.style.whiteSpace !== "nowrap") root.style.whiteSpace = "nowrap";
  return paintMentionIcon(root, resource, doc);
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

function paintMentionIcon(root: HTMLElement, resource: unknown, doc: Document) {
  const record = resource as { icon?: unknown; label?: unknown };
  const code =
    record.icon === QUOTE_CODE_ICON ||
    (typeof record.label === "string" && record.label.startsWith("diff --git "));
  const mark = (value: string) => {
    if (root.getAttribute(ICON_MARK) !== value) root.setAttribute(ICON_MARK, value);
  };
  if (code) {
    mark("code");
    return paintCodeIcon(root, doc);
  }
  if (record.icon === QUOTE_WHOLE_ICON) {
    mark("whole");
    const icon = iconRoot(root);
    if (icon) clearQuoteGlyph(icon);
    return false;
  }
  mark("selection");
  paintMessageIcon(root);
  return false;
}

function iconRoot(root: HTMLElement): Element | null {
  return root.querySelector("[data-icon-root]");
}

function paintCodeIcon(root: HTMLElement, doc: Document) {
  const icon = iconRoot(root);
  if (!icon) return true;
  clearQuoteGlyph(icon);
  if (icon.getAttribute("data-icon") === QUOTE_CODE_ICON) return false;
  if (icon.querySelector(`[${CODE_CLONE}]`)) return false;
  const source = doc.querySelector(DIFF_ICON_SOURCE);
  if (!(source instanceof HTMLElement)) return true;
  const clone = source.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return true;
  clone.setAttribute(CODE_CLONE, "");
  icon.replaceChildren(clone);
  return false;
}

function paintMessageIcon(root: HTMLElement) {
  const icon = iconRoot(root);
  if (!icon) return;
  const parent = icon.parentElement;
  if (!parent) return;
  icon.querySelector(`[${CODE_CLONE}]`)?.remove();
  if ((icon instanceof HTMLElement || icon instanceof SVGElement) && icon.style.display !== "none") {
    icon.style.display = "none";
  }
  if (parent.querySelector(`:scope > [${MESSAGE_GLYPH}]`)) return;
  const glyph = parent.ownerDocument.createElement("span");
  glyph.setAttribute(MESSAGE_GLYPH, "");
  glyph.style.cssText = pillStyle.quoteGlyph;
  glyph.style.webkitMask = QUOTE_MARK_MASK;
  glyph.style.mask = QUOTE_MARK_MASK;
  parent.insertBefore(glyph, icon);
}

function clearQuoteGlyph(icon: Element) {
  icon.parentElement?.querySelector(`:scope > [${MESSAGE_GLYPH}]`)?.remove();
  if ((icon instanceof HTMLElement || icon instanceof SVGElement) && icon.style.display !== "") {
    icon.style.display = "";
  }
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
      if (desc?.node && isQuoteMentionResource(desc.node.attrs?.resource)) return current;
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
    desc.view.dispatch(desc.view.state.tr.delete(desc.posBefore, desc.posAfter));
  } catch {
    return;
  }
}
