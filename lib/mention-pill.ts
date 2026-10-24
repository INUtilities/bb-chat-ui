import { PHONE_NARROW } from "./device-chrome.ts";

const STYLE_ID = "bb-chat-ui-mention-pill";
const MARK = "data-bb-chat-ui-mention-pill";
const WIDE = "data-bb-chat-ui-mention-wide";
const REMOVE = "data-bb-chat-ui-mention-remove";
const RESOURCE = "data-prompt-mention-resource";
// Set on the compact editor wrapper (outside ProseMirror) instead of .ProseMirror:has(.prompt-mention-pill).
const HAS_MENTION = "data-bb-chat-ui-has-mention";
const HAS_QUOTE = "data-bb-chat-ui-has-quote-mention";
const SCOPE = ':is([data-promptbox-editor-content], [data-message-column], section[aria-label="Queued messages"])';
const PILL = `${SCOPE} .prompt-mention-pill`;
const PAINTED = `${PILL}[data-prompt-mention][${RESOURCE}]`;

const css = `
${PAINTED} {
  display: inline-flex !important;
  position: relative;
  box-sizing: border-box;
  align-items: center !important;
  flex-shrink: 0 !important;
  min-width: 0;
  width: auto;
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  max-width: min(140px, calc(100% - 6px)) !important;
  gap: 4px !important;
  margin: 3px !important;
  padding: 4px 12px 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 12px !important;
  line-height: 16px !important;
  vertical-align: middle;
  white-space: nowrap !important;
  overflow: hidden;
}
${PAINTED}[${WIDE}] {
  max-width: calc(100% - 6px) !important;
}
${PAINTED} > .truncate {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
${PAINTED}:not([${WIDE}]) > .truncate {
  /* Bound the label's intrinsic width when the parent sizes to its contents. */
  max-width: calc(140px - 10px - 12px - 2px - 4px - 14px);
}
${PAINTED} [data-icon-root],
${PAINTED} [data-section-mention-marker],
${PAINTED} [data-bb-chat-ui-quote-glyph] {
  flex: 0 0 14px !important;
  width: 14px !important;
  height: 14px !important;
  margin: 0 !important;
  align-self: center;
}
${PAINTED}:has(> [${REMOVE}]) {
  padding-right: 30px !important;
}
${PAINTED} > button[${REMOVE}] {
  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--pill-icon, currentColor);
  cursor: pointer;
}
${PAINTED} > button[${REMOVE}]::before {
  content: "";
  width: 10px;
  height: 10px;
  background: currentColor;
  opacity: 0.5;
  clip-path: polygon(12% 0, 50% 38%, 88% 0, 100% 12%, 62% 50%, 100% 88%, 88% 100%, 50% 62%, 12% 100%, 0 88%, 38% 50%, 0 12%);
}
${PAINTED} > button[${REMOVE}]:hover {
  background: var(--state-hover);
}
${PAINTED} > button[${REMOVE}]:focus-visible {
  outline: 1px solid var(--ring);
  outline-offset: -2px;
}
  ${PHONE_NARROW} ${PAINTED} {
    height: 32px !important;
    min-height: 32px !important;
    max-height: 32px !important;
    max-width: min(240px, calc(100% - 8px)) !important;
    gap: 6px !important;
    margin: 4px !important;
    padding: 6px 14px 6px 12px !important;
    font-size: 14px !important;
    line-height: 18px !important;
  }
  ${PHONE_NARROW} ${PAINTED}[${WIDE}] {
    max-width: calc(100% - 8px) !important;
  }
  ${PHONE_NARROW} ${PAINTED}:not([${WIDE}]) > .truncate {
    max-width: calc(240px - 12px - 14px - 2px - 6px - 16px);
  }
  ${PHONE_NARROW} ${PAINTED} [data-icon-root],
  ${PHONE_NARROW} ${PAINTED} [data-section-mention-marker],
  ${PHONE_NARROW} ${PAINTED} [data-bb-chat-ui-quote-glyph] {
    flex-basis: 16px !important;
    width: 16px !important;
    height: 16px !important;
  }
  ${PHONE_NARROW} ${PAINTED}:has(> [${REMOVE}]) {
    padding-right: 34px !important;
  }
  ${PHONE_NARROW} ${PAINTED} > button[${REMOVE}] {
    right: 4px;
    width: 24px;
    height: 24px;
    min-width: 24px;
    min-height: 24px;
  }
  ${PHONE_NARROW} ${PAINTED} > button[${REMOVE}]::before {
    width: 12px;
    height: 12px;
  }

[data-promptbox-compact-content][${HAS_MENTION}] .ProseMirror {
  display: flex !important;
  align-items: center !important;
  height: 100%;
  max-height: none !important;
  overflow: hidden !important;
}
[data-promptbox-compact-content][${HAS_MENTION}] .ProseMirror > * {
  display: flex !important;
  align-items: center !important;
  height: 100%;
  flex-shrink: 0;
  min-width: 0;
  margin: 0 !important;
}
`;

interface MentionResource {
  kind?: string;
  itemId?: string;
  icon?: string | null;
  label?: string;
}

interface MentionNode {
  isAtom: boolean;
  isInline: boolean;
  attrs: { resource?: unknown };
  nodeSize: number;
}

interface MentionView {
  state: {
    doc: { nodeAt(pos: number): MentionNode | null };
    tr: { delete(from: number, to: number): unknown };
  };
  posAtDOM(node: Node, offset: number, bias?: number): number;
  nodeDOM(pos: number): Node | null;
  dispatch(transaction: unknown): void;
  focus(): void;
}

type EditorElement = HTMLElement & { editor?: { view: MentionView } };

function readResource(pill: Element): MentionResource | null {
  try {
    const parsed: unknown = JSON.parse(pill.getAttribute(RESOURCE) ?? "null");
    return typeof parsed === "object" && parsed !== null
      ? parsed as MentionResource
      : null;
  } catch {
    return null;
  }
}

function commitHash(resource: MentionResource | null): string | null {
  if (resource?.kind !== "plugin" || !resource.itemId?.startsWith("commit:")) return null;
  const hash = resource.itemId.match(/\/([0-9a-f]{7,64})$/i)?.[1]
    ?? resource.label?.match(/^([0-9a-f]{7,64})(?:\s|$)/i)?.[1];
  return hash?.slice(0, 7) ?? null;
}

function editableView(pill: HTMLElement): MentionView | null {
  const editor = pill.closest<EditorElement>(".ProseMirror");
  if (!editor) return null;
  if (editor.closest('[data-promptbox-editor-scroll][aria-busy="true"]')) return null;
  if (editor.getAttribute("contenteditable") !== "true" &&
      !editor.closest("[data-promptbox-compact-content]")) return null;
  return editor.editor?.view ?? null;
}

function removeMention(pill: HTMLElement): void {
  const view = editableView(pill);
  if (!view) return;
  try {
    const from = view.posAtDOM(pill, 0, -1);
    if (!Number.isInteger(from) || from < 0) return;
    const node = view.state.doc.nodeAt(from);
    if (!node?.isAtom || !node.isInline || !node.attrs.resource ||
        !view.nodeDOM(from)?.contains(pill)) return;
    view.dispatch(view.state.tr.delete(from, from + node.nodeSize));
    view.focus();
  } catch {
    // The editor may have unmounted between the pointer event and click.
  }
}

export function injectMentionPills(doc: Document): () => void {
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.append(style);
  const labels = new Map<HTMLElement, { original: string; display: string }>();
  const titles = new Map<HTMLElement, string>();
  const compactWrappers = new Map<HTMLElement, Set<HTMLElement>>();
  const pillWrappers = new WeakMap<HTMLElement, HTMLElement>();
  const quotePills = new WeakSet<HTMLElement>();
  const dirty = new Set<HTMLElement>();
  const dirtyWrappers = new Set<HTMLElement>();
  const collect = (node: Element) => {
    if (node instanceof HTMLElement && node.matches(".prompt-mention-pill")) dirty.add(node);
    for (const pill of Array.from(node.querySelectorAll<HTMLElement>(".prompt-mention-pill"))) dirty.add(pill);
  };
  const paint = () => {
    for (const pill of dirty) {
      const previous = pillWrappers.get(pill);
      if (previous) { compactWrappers.get(previous)?.delete(pill); dirtyWrappers.add(previous); pillWrappers.delete(pill); }
      if (!pill.isConnected || !pill.matches(PILL)) continue;
      const wrapper = pill.closest<HTMLElement>("[data-promptbox-compact-content]");
      if (!pill.hasAttribute(MARK)) pill.setAttribute(MARK, "");
      const resource = readResource(pill);
      if (resource?.kind === "plugin" && resource.itemId?.startsWith("quote:")) quotePills.add(pill);
      else quotePills.delete(pill);
      if (wrapper) {
        let members = compactWrappers.get(wrapper);
        if (!members) compactWrappers.set(wrapper, members = new Set());
        members.add(pill); pillWrappers.set(pill, wrapper); dirtyWrappers.add(wrapper);
      }
      const hash = commitHash(resource);
      const wide = hash !== null || resource?.icon === "FileDiff" ||
        (resource?.kind === "path" && /:\d+(?:[-–]\d+)?$/.test(resource.label ?? ""));
      if (pill.hasAttribute(WIDE) !== wide) pill.toggleAttribute(WIDE, wide);
      const label = pill.querySelector<HTMLElement>(":scope > .truncate");
      if (hash && label && label.textContent !== hash) {
        labels.set(label, { original: label.textContent ?? "", display: hash });
        label.textContent = hash;
      }
      if (!pill.hasAttribute("title") && resource?.label) {
        pill.title = resource.label;
        titles.set(pill, resource.label);
      }
      const button = pill.querySelector<HTMLButtonElement>(`:scope > [${REMOVE}]`);
      if (!editableView(pill)) {
        button?.remove();
      } else if (!button) {
        const remove = doc.createElement("button");
        remove.type = "button";
        remove.setAttribute(REMOVE, "");
        remove.setAttribute("aria-label", "Remove mention");
        remove.title = "Remove mention";
        remove.contentEditable = "false";
        pill.append(remove);
      }
    }
    dirty.clear();
    for (const wrapper of dirtyWrappers) {
      const members = compactWrappers.get(wrapper);
      const hasMention = !!members?.size && wrapper.isConnected && wrapper.hasAttribute("data-promptbox-compact-content");
      const quote = hasMention && [...members!].some(pill => quotePills.has(pill));
      if (wrapper.hasAttribute(HAS_MENTION) !== hasMention) wrapper.toggleAttribute(HAS_MENTION, hasMention);
      if (wrapper.hasAttribute(HAS_QUOTE) !== quote) wrapper.toggleAttribute(HAS_QUOTE, quote);
      if (!hasMention) compactWrappers.delete(wrapper);
    }
    dirtyWrappers.clear();
    for (const label of labels.keys()) if (!label.isConnected) labels.delete(label);
    for (const pill of titles.keys()) if (!pill.isConnected) titles.delete(pill);
  };

  const observer = new MutationObserver((mutations) => {
    const subtrees = new Set<Element>();
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (!target) continue;
      if (mutation.type === "attributes") {
        if (mutation.attributeName === RESOURCE) {
          const pill = target.closest<HTMLElement>(".prompt-mention-pill");
          if (pill) dirty.add(pill);
        } else if (target.matches('.ProseMirror, [data-promptbox-editor-scroll]') || mutation.attributeName === "data-promptbox-compact-content") {
          subtrees.add(target);
          if (target instanceof HTMLElement) dirtyWrappers.add(target);
        }
        continue;
      }
      const pill = target.closest<HTMLElement>(".prompt-mention-pill");
      // Appending our delete button is already complete; native removals still resync it.
      const ownAddition = mutation.addedNodes.length > 0 && !mutation.removedNodes.length &&
        Array.from(mutation.addedNodes).every(node => node instanceof Element && node.hasAttribute(REMOVE));
      if (pill && !ownAddition) dirty.add(pill);
      const added = new Set(Array.from(mutation.addedNodes).filter((node): node is Element => node instanceof Element));
      if (added.size > 1 && Array.from(target.children).every(node => added.has(node))) subtrees.add(target);
      else for (const node of added) if (!node.hasAttribute(REMOVE)) subtrees.add(node);
      if (compactWrappers.size) for (const node of Array.from(mutation.removedNodes)) if (node instanceof Element && !node.hasAttribute(REMOVE)) subtrees.add(node);
    }
    for (const subtree of subtrees) {
      let parent = subtree.parentElement;
      while (parent && !subtrees.has(parent)) parent = parent.parentElement;
      if (!parent) collect(subtree);
    }
    // No layout is read here. Decorate before the browser paints the new pill.
    if (dirty.size || dirtyWrappers.size) paint();
  });
  observer.observe(doc.body, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: [RESOURCE, "contenteditable", "aria-busy", "data-promptbox-compact-content"],
  });

  const removeButton = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    return element?.closest<HTMLButtonElement>(`button[${REMOVE}]`) ?? null;
  };
  const onPointerDown = (event: Event) => {
    if (!removeButton(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onClick = (event: Event) => {
    const button = removeButton(event.target);
    const pill = button?.closest<HTMLElement>(PILL);
    if (!pill) return;
    event.preventDefault();
    event.stopPropagation();
    removeMention(pill);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.key === "Enter" || event.key === " ") && removeButton(event.target)) {
      onClick(event);
    }
  };
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("mousedown", onPointerDown, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  collect(doc.body);
  paint();

  return () => {
    observer.disconnect();
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("mousedown", onPointerDown, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    for (const button of Array.from(doc.querySelectorAll(`[${REMOVE}]`))) button.remove();
    for (const pill of Array.from(doc.querySelectorAll(`[${MARK}]`))) {
      pill.removeAttribute(MARK);
      pill.removeAttribute(WIDE);
    }
    for (const wrapper of compactWrappers.keys()) { wrapper.removeAttribute(HAS_MENTION); wrapper.removeAttribute(HAS_QUOTE); }
    compactWrappers.clear();
    for (const [label, original] of labels) {
      if (label.textContent === original.display) label.textContent = original.original;
    }
    for (const [pill, title] of titles) if (pill.title === title) pill.removeAttribute("title");
    style.remove();
  };
}
