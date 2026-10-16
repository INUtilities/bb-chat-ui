import { QUOTE_MARK_MASK } from "./quote-pill.ts";
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
const MESSAGE_GLYPH = "data-bb-chat-ui-quote-glyph";
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

  const lock = () => lockQuoteMentions(doc);
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
    const collect = (element: Element) => {
      if (element instanceof HTMLElement && element.hasAttribute(MENTION_RESOURCE)) candidates.add(element);
      for (const node of Array.from(element.querySelectorAll(`[${MENTION_RESOURCE}]`))) {
        if (node instanceof HTMLElement) candidates.add(node);
      }
    };
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const mention = target?.closest(`[${MENTION_RESOURCE}]`);
      if (mention instanceof HTMLElement) candidates.add(mention);
      if (record.type === "attributes" && target) collect(target);
      for (const node of Array.from(record.addedNodes)) {
        if (!(node instanceof Element)) continue;
        collect(node);
        // Code quotes can arrive before the host supplies their source icon.
        if (node.matches(DIFF_ICON_SOURCE) || node.querySelector(DIFF_ICON_SOURCE)) collect(root);
      }
    }
    for (const node of candidates) if (node.isConnected) lockQuoteMention(node, doc);
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
  lock();

  return () => {
    observer.disconnect();
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

function lockQuoteMentions(doc: Document) {
  for (const node of Array.from(doc.querySelectorAll(`[${MENTION_RESOURCE}]`))) {
    if (node instanceof HTMLElement) lockQuoteMention(node, doc);
  }
}

function lockQuoteMention(node: HTMLElement, doc: Document) {
  const resource = mentionResource(node);
  if (!isQuoteMentionResource(resource)) return;
  const root = mentionRoot(node) ?? node;
  if (root.contentEditable !== "false") root.contentEditable = "false";
  if (root.style.maxWidth !== "100%") root.style.maxWidth = "100%";
  if (root.style.whiteSpace !== "nowrap") root.style.whiteSpace = "nowrap";
  paintMentionIcon(root, resource, doc);
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
    paintCodeIcon(root, doc);
    return;
  }
  if (record.icon === QUOTE_WHOLE_ICON) {
    mark("whole");
    const icon = iconRoot(root);
    if (icon) clearQuoteGlyph(icon);
    return;
  }
  mark("selection");
  paintMessageIcon(root);
}

function iconRoot(root: HTMLElement): Element | null {
  return root.querySelector("[data-icon-root]");
}

function paintCodeIcon(root: HTMLElement, doc: Document) {
  const icon = iconRoot(root);
  if (!icon) return;
  clearQuoteGlyph(icon);
  if (icon.getAttribute("data-icon") === QUOTE_CODE_ICON) return;
  if (icon.querySelector(`[${CODE_CLONE}]`)) return;
  const source = doc.querySelector(DIFF_ICON_SOURCE);
  if (!(source instanceof HTMLElement)) return;
  const clone = source.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return;
  clone.setAttribute(CODE_CLONE, "");
  icon.replaceChildren(clone);
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
  glyph.style.display = "inline-block";
  glyph.style.width = "14px";
  glyph.style.height = "14px";
  glyph.style.flex = "0 0 14px";
  glyph.style.alignSelf = "center";
  glyph.style.backgroundColor = "var(--pill-icon, currentColor)";
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
