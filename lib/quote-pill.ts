import { PHONE_NARROW, SMALL_HIT_TARGET } from "./device-chrome.ts";

const STYLE_ID = "bb-chat-ui-quote-pill";
const REMOVE_ZONE_PX = 28;

const USER_QUOTE = "[data-message-column] > .group\\/message blockquote";
const COMPOSER_QUOTE =
  "[data-promptbox-editor-scroll] [data-promptbox-editor-content]:not([data-promptbox-compact-content]) .ProseMirror blockquote";
const PENDING_COMPOSER_QUOTE =
  "[data-promptbox-editor-scroll] [data-promptbox-editor-content] .ProseMirror blockquote";
const QUOTE_MENTION_PILL =
  '.prompt-mention-pill[data-prompt-mention-resource*=\'"itemId":"quote:\']';
const COMPOSER_QUOTE_MENTION = `[data-promptbox-editor-scroll] [data-promptbox-editor-content] ${QUOTE_MENTION_PILL}`;
// mention-pill marks the compact editor wrapper that holds a quote pill (was .ProseMirror:has(...) > *).
const COMPACT_QUOTE_MENTION_LINE = `[data-promptbox-compact-content][data-bb-chat-ui-has-quote-mention] .ProseMirror`;
const SENT_MENTION_PILL =
  "[data-message-column] [data-markdown-preview] .prompt-mention-pill";

const QUOTE_ICON = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="black" d="M3.2 6.1c0-1.9 1.3-3.3 3-3.3.4 0 .6.2.6.6v.7c0 .3-.2.5-.6.5-1 0-1.6.7-1.6 1.7v.2h1.5c.6 0 1.1.5 1.1 1.1v1.7c0 .6-.5 1.1-1.1 1.1H4.3c-.6 0-1.1-.5-1.1-1.1V6.1zm6.4 0c0-1.9 1.3-3.3 3-3.3.4 0 .6.2.6.6v.7c0 .3-.2.5-.6.5-1 0-1.6.7-1.6 1.7v.2H12c.6 0 1.1.5 1.1 1.1v1.7c0 .6-.5 1.1-1.1 1.1H10.7c-.6 0-1.1-.5-1.1-1.1V6.1z"/></svg>`,
);
export const QUOTE_MARK_MASK = `url("data:image/svg+xml,${QUOTE_ICON}") center / contain no-repeat`;

interface ResolvedFrom {
  parentOffset: number;
  parent: { content: { size: number } };
}

interface QuoteDoc {
  resolve: (pos: number) => unknown;
}

interface QuoteSelection {
  from: number;
  to: number;
  empty: boolean;
  $from?: ResolvedFrom;
  constructor: QuoteSelectionCtor;
}

interface QuoteSelectionCtor {
  create: (doc: QuoteDoc, anchor: number, head?: number) => QuoteSelection;
  near?: ($pos: unknown, bias?: number) => QuoteSelection;
  fromJSON?: (
    doc: QuoteDoc,
    json: { type: string; anchor: number; head?: number },
  ) => QuoteSelection;
}

interface QuoteTransaction {
  delete: (from: number, to: number) => QuoteTransaction;
  setSelection: (selection: unknown) => QuoteTransaction;
  scrollIntoView: () => QuoteTransaction;
}

interface QuoteView {
  state: {
    doc: QuoteDoc;
    selection: QuoteSelection;
    tr: QuoteTransaction;
  };
  dispatch: (transaction: unknown) => void;
}

interface QuoteViewDesc {
  posBefore: number;
  posAfter: number;
  view: QuoteView;
}

type QuoteElement = HTMLElement & { pmViewDesc?: QuoteViewDesc };

interface QuoteRelation {
  inside: HTMLElement | null;
  before: HTMLElement | null;
  after: HTMLElement | null;
  partial: HTMLElement | null;
}

const EMPTY_RELATION: QuoteRelation = {
  inside: null,
  before: null,
  after: null,
  partial: null,
};

export type QuoteKeyAction =
  | "ignore"
  | "block"
  | "delete"
  | "skip-before"
  | "skip-after";
export type QuotePointerAction = "ignore" | "block" | "remove";

export function quotePillCss(): string {
  return `
${USER_QUOTE},
${PENDING_COMPOSER_QUOTE} {
  display: inline-flex !important;
  align-items: center;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  min-height: 28px;
  min-width: 0;
  gap: 6px;
  margin: 0.25rem 0 !important;
  border: 1px solid var(--pill-surface-border, var(--border)) !important;
  border-radius: 9999px !important;
  background: var(--pill-surface, var(--card));
  color: var(--pill-foreground, var(--muted-foreground));
  box-shadow: var(--pill-shadow);
  padding: 6px 14px 6px 12px !important;
  overflow: hidden;
  vertical-align: middle;
  white-space: nowrap !important;
  user-select: none;
  cursor: default;
}
${USER_QUOTE}::before,
${PENDING_COMPOSER_QUOTE}::before {
  content: "";
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  background-color: var(--pill-icon, currentColor);
  -webkit-mask: ${QUOTE_MARK_MASK};
  mask: ${QUOTE_MARK_MASK};
}
${USER_QUOTE} > *,
${PENDING_COMPOSER_QUOTE} > * {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  line-height: 1.25;
  white-space: nowrap !important;
  text-overflow: ellipsis;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}
${USER_QUOTE} br,
${PENDING_COMPOSER_QUOTE} br {
  display: none !important;
}
${USER_QUOTE} {
  pointer-events: none;
}
${COMPOSER_QUOTE}::after {
  content: "×";
  display: none;
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  box-sizing: border-box;
  align-items: center;
  justify-content: flex-end;
  width: 32px;
  height: 100%;
  padding-right: 14px;
  border-radius: 0 9999px 9999px 0;
  background-image: linear-gradient(90deg, transparent, var(--pill-surface, var(--card)) 58%);
  color: var(--pill-icon, currentColor);
  font: 500 15px/1 inherit;
  text-align: right;
  pointer-events: none;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
  ${SMALL_HIT_TARGET} ${COMPOSER_QUOTE}:hover::after {
    display: flex;
  }

${PENDING_COMPOSER_QUOTE} {
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  max-width: min(140px, calc(100% - 6px)) !important;
  gap: 4px !important;
  margin: 3px !important;
  padding: 4px 12px 4px 10px !important;
  font-size: 12px !important;
  line-height: 16px !important;
  overflow: hidden;
}
${PENDING_COMPOSER_QUOTE} > :not(:first-child) {
  display: none !important;
}
${PENDING_COMPOSER_QUOTE} > :first-child {
  line-height: 16px !important;
}
${PENDING_COMPOSER_QUOTE}::before {
  flex-basis: 14px;
  width: 14px;
  height: 14px;
}
  ${PHONE_NARROW} ${PENDING_COMPOSER_QUOTE} {
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
  ${PHONE_NARROW} ${PENDING_COMPOSER_QUOTE} > :first-child {
    line-height: 18px !important;
  }
  ${PHONE_NARROW} ${PENDING_COMPOSER_QUOTE}::before {
    flex-basis: 16px;
    width: 16px;
    height: 16px;
  }

${COMPOSER_QUOTE_MENTION} {
  align-items: center !important;
  flex-shrink: 0 !important;
  gap: 6px !important;
  box-sizing: border-box;
  min-height: 32px;
  max-height: none !important;
  padding: 6px 14px 6px 12px !important;
  vertical-align: middle;
}
${COMPACT_QUOTE_MENTION_LINE} {
  display: flex !important;
  align-items: center !important;
  height: 100%;
  max-height: none !important;
  overflow: hidden !important;
}
${COMPACT_QUOTE_MENTION_LINE} > * {
  display: flex !important;
  align-items: center !important;
  height: 100%;
  min-width: 0;
  margin: 0 !important;
}
${SENT_MENTION_PILL} {
  align-items: center !important;
  box-sizing: border-box;
  gap: 6px !important;
  min-height: 32px;
  padding: 6px 14px 6px 12px !important;
  font-size: inherit !important;
  line-height: 1.25 !important;
  vertical-align: middle;
}
`;
}

export function quoteKeyAction(input: {
  key: string;
  insideQuote: boolean;
  quoteBeforeCaret: boolean;
  quoteAfterCaret: boolean;
  modifier?: boolean;
}): QuoteKeyAction {
  if (input.modifier) return "ignore";
  if (input.insideQuote) {
    if (
      input.key === "ArrowLeft" ||
      input.key === "Home" ||
      input.key === "ArrowUp"
    ) {
      return "skip-before";
    }
    if (
      input.key === "ArrowRight" ||
      input.key === "End" ||
      input.key === "ArrowDown"
    ) {
      return "skip-after";
    }
    if (input.key === "Backspace" || input.key === "Delete") return "delete";
    if (input.key === "Enter" || input.key.length === 1) return "block";
    return "ignore";
  }
  if (input.key === "Backspace" && input.quoteBeforeCaret) return "delete";
  if (input.key === "Delete" && input.quoteAfterCaret) return "delete";
  if (input.key === "ArrowLeft" && input.quoteBeforeCaret) return "skip-before";
  if (input.key === "ArrowRight" && input.quoteAfterCaret) return "skip-after";
  return "ignore";
}

export function quoteInputAction(input: {
  inputType: string;
  insideQuote: boolean;
  quoteBeforeCaret: boolean;
  quoteAfterCaret: boolean;
}): "ignore" | "block" | "delete" {
  const backward = input.inputType === "deleteContentBackward";
  const forward = input.inputType === "deleteContentForward";
  if (backward && (input.insideQuote || input.quoteBeforeCaret)) return "delete";
  if (forward && (input.insideQuote || input.quoteAfterCaret)) return "delete";
  if (!input.insideQuote) return "ignore";
  if (
    input.inputType.startsWith("insert") ||
    input.inputType === "deleteByCut" ||
    input.inputType === "formatBold" ||
    input.inputType === "historyUndo" ||
    input.inputType === "historyRedo"
  ) {
    return "block";
  }
  return "ignore";
}

export function quotePointerAction(input: {
  insideQuote: boolean;
  hovering: boolean;
  clientX: number;
  quoteRight: number;
  removeZonePx: number;
}): QuotePointerAction {
  if (!input.insideQuote) return "ignore";
  const inRemoveZone = input.quoteRight - input.clientX <= input.removeZonePx;
  if (input.hovering && inRemoveZone) return "remove";
  return "block";
}

export function injectQuotePill(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = quotePillCss();
  document.head.append(style);

  let dragging = false;
  let ejecting = false;
  let lastEjectKey = "";

  const onKeyDown = (event: KeyboardEvent) => {
    dragging = false;
    const relation = quoteRelation(document);
    const inside =
      relation.inside ?? relation.partial ?? composerQuote(event.target);
    const action = quoteKeyAction({
      key: event.key,
      insideQuote: inside !== null,
      quoteBeforeCaret: relation.before !== null,
      quoteAfterCaret: relation.after !== null,
      modifier: event.metaKey || event.ctrlKey,
    });
    if (action === "ignore") return;
    if (
      (action === "skip-before" || action === "skip-after") &&
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const quote = quoteForKey(relation, inside, action, event.key);
    if (!quote || action === "block") return;
    if (action === "delete") {
      deleteQuote(quote);
      return;
    }
    moveCaret(quote, action === "skip-before" ? "before" : "after");
  };
  const onBeforeInput = (event: InputEvent) => {
    const relation = quoteRelation(document);
    const inside = relation.inside ?? relation.partial;
    const action = quoteInputAction({
      inputType: event.inputType,
      insideQuote: inside !== null,
      quoteBeforeCaret: relation.before !== null,
      quoteAfterCaret: relation.after !== null,
    });
    if (action === "ignore") return;
    event.preventDefault();
    event.stopPropagation();
    if (action !== "delete") return;
    const quote =
      inside ??
      (event.inputType === "deleteContentForward" ? relation.after : relation.before);
    if (quote) deleteQuote(quote);
  };
  const onCompositionStart = (event: Event) => {
    if (!editingQuote(document, event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const quote = composerQuote(event.target);
    if (!quote) {
      dragging = true;
      return;
    }
    const action = pointerAction(quote, event.clientX);
    if (action === "ignore") return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "remove") {
      deleteQuote(quote);
      return;
    }
    const rect = quote.getBoundingClientRect();
    moveCaret(
      quote,
      event.clientX <= rect.left + rect.width / 2 ? "before" : "after",
    );
  };
  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    settleSelection(document);
  };
  const onClick = (event: MouseEvent) => {
    if (!composerQuote(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onPasteOrDrop = (event: Event) => {
    if (!editingQuote(document, event.target)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onSelectionChange = () => {
    if (dragging || ejecting) return;
    settleSelection(document);
  };

  function settleSelection(doc: Document) {
    let relation: QuoteRelation;
    try {
      relation = quoteRelation(doc);
    } catch {
      return;
    }
    const quote = relation.inside ?? relation.partial;
    if (!quote) {
      lastEjectKey = "";
      return;
    }
    const selection = doc.getSelection?.();
    const ejectKey = selection
      ? `${selection.anchorOffset}:${selection.focusOffset}:${relation.inside ? "in" : "part"}`
      : "part";
    if (ejectKey === lastEjectKey) return;
    lastEjectKey = ejectKey;
    ejecting = true;
    try {
      if (relation.inside) moveCaret(relation.inside, closerEdge(relation.inside));
      else expandToCover(quote);
    } catch {
      return;
    } finally {
      ejecting = false;
    }
  }

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("beforeinput", onBeforeInput, true);
  document.addEventListener("compositionstart", onCompositionStart, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("pointerdown", onMouseDown, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("paste", onPasteOrDrop, true);
  document.addEventListener("drop", onPasteOrDrop, true);
  document.addEventListener("selectionchange", onSelectionChange, true);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("beforeinput", onBeforeInput, true);
    document.removeEventListener("compositionstart", onCompositionStart, true);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("pointerdown", onMouseDown, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("paste", onPasteOrDrop, true);
    document.removeEventListener("drop", onPasteOrDrop, true);
    document.removeEventListener("selectionchange", onSelectionChange, true);
    style.remove();
  };
}

function quoteForKey(
  relation: QuoteRelation,
  inside: HTMLElement | null,
  action: QuoteKeyAction,
  key: string,
): HTMLElement | null {
  if (action === "delete" && key === "Delete") {
    return inside ?? relation.after ?? relation.before;
  }
  if (action === "skip-after") {
    return inside ?? relation.after ?? relation.before;
  }
  return inside ?? relation.before ?? relation.after;
}

function pointerAction(quote: HTMLElement, clientX: number): QuotePointerAction {
  return quotePointerAction({
    insideQuote: true,
    hovering: quote.matches(":hover"),
    clientX,
    quoteRight: quote.getBoundingClientRect().right,
    removeZonePx: REMOVE_ZONE_PX,
  });
}

function composerQuote(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  const quote = element?.closest(COMPOSER_QUOTE);
  return quote instanceof HTMLElement ? quote : null;
}

function editingQuote(doc: Document, target: EventTarget | null): boolean {
  if (composerQuote(target)) return true;
  try {
    const relation = quoteRelation(doc);
    return relation.inside !== null || relation.partial !== null;
  } catch {
    return false;
  }
}

function quoteRelation(doc: Document): QuoteRelation {
  const selection = doc.getSelection?.();
  if (!selection) return EMPTY_RELATION;
  const view = editorViewOf(selection.anchorNode ?? selection.focusNode);
  if (view) return relationFromView(doc, view);
  return relationFromDom(selection);
}

function relationFromView(doc: Document, view: QuoteView): QuoteRelation {
  const selection = view.state.selection;
  const resolved = resolvedFrom(selection);
  let inside: HTMLElement | null = null;
  let before: HTMLElement | null = null;
  let after: HTMLElement | null = null;
  let partial: HTMLElement | null = null;
  eachComposerQuote(doc, (node) => {
    const desc = quoteDesc(node);
    if (!desc || desc.view !== view) return;
    const { posBefore, posAfter } = desc;
    if (
      selection.empty &&
      selection.from > posBefore &&
      selection.from < posAfter
    ) {
      inside = node;
    } else if (
      !selection.empty &&
      selection.from < posAfter &&
      selection.to > posBefore &&
      !(selection.from <= posBefore && selection.to >= posAfter)
    ) {
      partial = node;
    }
    if (selection.empty && isJustAfter(selection, resolved, posAfter)) {
      before = node;
    }
    if (selection.empty && isJustBefore(selection, resolved, posBefore)) {
      after = node;
    }
  });
  return { inside, before, after, partial };
}

function isJustAfter(
  selection: QuoteSelection,
  resolved: ResolvedFrom | null,
  posAfter: number,
): boolean {
  if (selection.from === posAfter) return true;
  return (
    resolved !== null &&
    selection.from === posAfter + 1 &&
    resolved.parentOffset === 0
  );
}

function isJustBefore(
  selection: QuoteSelection,
  resolved: ResolvedFrom | null,
  posBefore: number,
): boolean {
  if (selection.from === posBefore) return true;
  return (
    resolved !== null &&
    selection.from === posBefore - 1 &&
    resolved.parentOffset === resolved.parent.content.size
  );
}

function resolvedFrom(selection: QuoteSelection): ResolvedFrom | null {
  const from = selection.$from;
  if (!from) return null;
  if (typeof from.parentOffset !== "number") return null;
  if (typeof from.parent?.content?.size !== "number") return null;
  return from;
}

function relationFromDom(selection: Selection): QuoteRelation {
  if (selection.rangeCount === 0) return EMPTY_RELATION;
  const anchor = selection.anchorNode;
  const inside =
    interiorQuote(anchor) ?? interiorQuote(selection.focusNode);
  if (inside) {
    return selection.isCollapsed
      ? { inside, before: null, after: null, partial: null }
      : { inside: null, before: null, after: null, partial: inside };
  }
  if (!selection.isCollapsed || !anchor) return EMPTY_RELATION;
  const block = topLevelBlock(anchor);
  if (!block) return EMPTY_RELATION;
  return {
    inside: null,
    before: caretAtEdge(block, selection, "start")
      ? asComposerQuote(block.previousElementSibling)
      : null,
    after: caretAtEdge(block, selection, "end")
      ? asComposerQuote(block.nextElementSibling)
      : null,
    partial: null,
  };
}

function interiorQuote(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof Element && node.matches(COMPOSER_QUOTE)) return null;
  const element = node instanceof Element ? node : node.parentElement;
  const quote = element?.closest(COMPOSER_QUOTE);
  return quote instanceof HTMLElement ? quote : null;
}

function topLevelBlock(node: Node): HTMLElement | null {
  if (node instanceof Element && node.classList.contains("ProseMirror")) {
    return null;
  }
  let current: Node | null = node;
  while (current?.parentElement) {
    if (current.parentElement.classList.contains("ProseMirror")) {
      return current instanceof HTMLElement ? current : null;
    }
    current = current.parentElement;
  }
  return null;
}

function caretAtEdge(
  block: HTMLElement,
  selection: Selection,
  edge: "start" | "end",
): boolean {
  const node = selection.anchorNode;
  const offset = selection.anchorOffset;
  if (!node) return false;
  const range = block.ownerDocument.createRange();
  try {
    if (edge === "start") {
      range.setStart(block, 0);
      range.setEnd(node, offset);
    } else {
      range.setStart(node, offset);
      range.setEnd(block, block.childNodes.length);
    }
  } catch {
    return false;
  }
  return range.toString() === "";
}

function asComposerQuote(node: Element | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  return node.matches(COMPOSER_QUOTE) ? node : null;
}

function editorViewOf(node: Node | null): QuoteView | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element) {
      const desc = (current as QuoteElement).pmViewDesc;
      if (
        desc?.view?.state?.selection &&
        typeof desc.view.dispatch === "function"
      ) {
        return desc.view;
      }
    }
    current = current.parentNode;
  }
  return null;
}

function quoteDesc(quote: HTMLElement): QuoteViewDesc | null {
  const desc = (quote as QuoteElement).pmViewDesc;
  if (!desc?.view?.dispatch || !desc.view.state?.tr?.delete) return null;
  if (!Number.isInteger(desc.posBefore) || !Number.isInteger(desc.posAfter)) {
    return null;
  }
  if (desc.posAfter <= desc.posBefore) return null;
  return desc;
}

function closerEdge(quote: HTMLElement): "before" | "after" {
  const desc = quoteDesc(quote);
  if (!desc) return "after";
  const mid = (desc.posBefore + desc.posAfter) / 2;
  return desc.view.state.selection.from <= mid ? "before" : "after";
}

function moveCaret(quote: HTMLElement, edge: "before" | "after") {
  const desc = quoteDesc(quote);
  if (!desc) {
    placeCaretDom(quote, edge);
    return;
  }
  const pos = edge === "before" ? desc.posBefore : desc.posAfter;
  const bias = edge === "before" ? -1 : 1;
  const ctor = desc.view.state.selection.constructor;
  try {
    if (!ctor.near) {
      placeCaretDom(quote, edge);
      return;
    }
    const next = ctor.near(desc.view.state.doc.resolve(pos), bias);
    const landed = quoteContainingPoint(quote.ownerDocument, desc.view, next);
    if (landed) {
      selectWholeQuote(landed);
      return;
    }
    dispatchSelection(desc, next);
  } catch {
    placeCaretDom(quote, edge);
  }
}

function expandToCover(quote: HTMLElement) {
  const desc = quoteDesc(quote);
  if (!desc) {
    selectWholeQuote(quote);
    return;
  }
  const { from, to } = desc.view.state.selection;
  const nextFrom = Math.min(from, desc.posBefore);
  const nextTo = Math.max(to, desc.posAfter);
  if (nextFrom === desc.posBefore && nextTo === desc.posAfter) {
    selectWholeQuote(quote);
    return;
  }
  try {
    const next = desc.view.state.selection.constructor.create(
      desc.view.state.doc,
      nextFrom,
      nextTo,
    );
    if (next.from > desc.posBefore && next.to < desc.posAfter) {
      selectWholeQuote(quote);
      return;
    }
    dispatchSelection(desc, next);
  } catch {
    selectWholeQuote(quote);
  }
}

function selectWholeQuote(quote: HTMLElement) {
  const desc = quoteDesc(quote);
  if (!desc) {
    selectNodeDom(quote);
    return;
  }
  try {
    const next = nodeSelection(desc);
    if (!next) {
      selectNodeDom(quote);
      return;
    }
    dispatchSelection(desc, next);
  } catch {
    selectNodeDom(quote);
  }
}

function nodeSelection(desc: QuoteViewDesc): QuoteSelection | null {
  let current: unknown = desc.view.state.selection.constructor;
  const seen = new Set<unknown>();
  while (typeof current === "function" && !seen.has(current)) {
    seen.add(current);
    const fromJSON = (current as { fromJSON?: QuoteSelectionCtor["fromJSON"] })
      .fromJSON;
    if (typeof fromJSON === "function") {
      try {
        const next = fromJSON.call(current, desc.view.state.doc, {
          type: "node",
          anchor: desc.posBefore,
        });
        if (next?.from === desc.posBefore && next.to === desc.posAfter) {
          return next;
        }
      } catch {
        // This constructor parses a different selection JSON shape.
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return null;
}

function quoteContainingPoint(
  doc: Document,
  view: QuoteView,
  selection: { from: number; to: number; empty: boolean },
): HTMLElement | null {
  let found: HTMLElement | null = null;
  eachComposerQuote(doc, (node) => {
    if (found) return;
    const desc = quoteDesc(node);
    if (!desc || desc.view !== view) return;
    const pointInside =
      selection.empty &&
      selection.from > desc.posBefore &&
      selection.from < desc.posAfter;
    const rangeInside =
      !selection.empty &&
      selection.from > desc.posBefore &&
      selection.to < desc.posAfter;
    if (pointInside || rangeInside) found = node;
  });
  return found;
}

function eachComposerQuote(doc: Document, visit: (quote: HTMLElement) => void) {
  const quotes = doc.querySelectorAll(COMPOSER_QUOTE);
  for (let index = 0; index < quotes.length; index += 1) {
    const node = quotes.item(index);
    if (node instanceof HTMLElement) visit(node);
  }
}

function dispatchSelection(desc: QuoteViewDesc, selection: unknown) {
  const transaction = desc.view.state.tr;
  if (!transaction.setSelection || !transaction.scrollIntoView) return;
  desc.view.dispatch(transaction.setSelection(selection).scrollIntoView());
}

function placeCaretDom(quote: HTMLElement, edge: "before" | "after") {
  const selection = quote.ownerDocument.getSelection?.();
  if (!selection) return;
  const range = quote.ownerDocument.createRange();
  if (edge === "before") range.setStartBefore(quote);
  else range.setStartAfter(quote);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectNodeDom(quote: HTMLElement) {
  const selection = quote.ownerDocument.getSelection?.();
  if (!selection) return;
  const range = quote.ownerDocument.createRange();
  range.selectNode(quote);
  selection.removeAllRanges();
  selection.addRange(range);
}

function deleteQuote(quote: HTMLElement) {
  const desc = quoteDesc(quote);
  if (!desc) return;
  try {
    desc.view.dispatch(
      desc.view.state.tr.delete(desc.posBefore, desc.posAfter),
    );
  } catch {
    return;
  }
}
