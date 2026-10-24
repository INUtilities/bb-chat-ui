import { QUOTE_PREVIEW_MARK } from "./quote-preview.ts";
import { deleteWithCaret } from "./delete-with-caret.ts";
import { LEGACY_QUOTE_REMOVE, LEGACY_QUOTE_HOST, installLegacyQuoteControls, legacyQuoteFromButton } from "./legacy-quote-controls.ts";
import { pillStyle, referenceVariableStyle, referencePhoneVariableStyle, REFERENCE_PHONE } from "./pill.ts";

const STYLE_ID = "bb-chat-ui-quote-pill";


const USER_QUOTE = "[data-message-column] > .group\\/message blockquote";
const COMPOSER_QUOTE =
  "[data-promptbox-editor-scroll] [data-promptbox-editor-content]:not([data-promptbox-compact-content]) .ProseMirror blockquote";
const PENDING_COMPOSER_QUOTE =
  "[data-promptbox-editor-scroll] [data-promptbox-editor-content] .ProseMirror blockquote";
// mention-pill marks the compact editor wrapper that holds a quote pill (was .ProseMirror:has(...) > *).
const COMPACT_QUOTE_MENTION_LINE = `[data-promptbox-compact-content][data-bb-chat-ui-has-quote-mention] .ProseMirror`;
// Lucide 0.300.0 icons/quote.svg (ISC), rotated and centered at 85% for an opening quote; see THIRD_PARTY_NOTICES.md.
const QUOTE_ICON = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(1.8 1.8) scale(.85) rotate(180 12 12)"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></g></svg>`,
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
  focus?: () => void;
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
${pillStyle.legacyQuote}
${referenceVariableStyle}
  transition-property: background-color, color !important;
${pillStyle.referenceFace}
}
${USER_QUOTE}::before,
${USER_QUOTE}::before,
${PENDING_COMPOSER_QUOTE}::before {
${pillStyle.legacyQuoteIcon}
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
${PENDING_COMPOSER_QUOTE} { ${pillStyle.removeReserve} }
[${LEGACY_QUOTE_HOST}] {position:absolute;inset:0;pointer-events:none;}
[${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}] {
  ${pillStyle.remove}
  display:inline-flex !important; flex:none !important; pointer-events:auto; right:auto; --bb-chat-ui-legacy-remove-inset:3px;
}
[${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}]::before { ${pillStyle.removeGlyph} ${pillStyle.removeCross} }
[${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}]:hover { ${pillStyle.removeHover} }
[${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}]:focus-visible { ${pillStyle.removeFocus} }
${REFERENCE_PHONE} [${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}] { ${pillStyle.removePhone} right:auto; --bb-chat-ui-legacy-remove-inset:4px; }
${REFERENCE_PHONE} [${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}]::after { ${pillStyle.removeHitPhone} }
${REFERENCE_PHONE} [${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}]::before { ${pillStyle.removeGlyphPhone} }
@media (prefers-reduced-motion: reduce) { [${LEGACY_QUOTE_HOST}] > button[${LEGACY_QUOTE_REMOVE}] { transition:none; } }

${USER_QUOTE} > :not(:first-child),
${PENDING_COMPOSER_QUOTE} > :not(:first-child) {
  display: none !important;
}
${USER_QUOTE} > :first-child,
${PENDING_COMPOSER_QUOTE} > :first-child {
  line-height: 16px !important;
}
${USER_QUOTE}::before,
${PENDING_COMPOSER_QUOTE}::before {
  flex-basis: 14px;
  width: 14px;
  height: 14px;
}
  ${REFERENCE_PHONE} ${USER_QUOTE}, ${REFERENCE_PHONE} ${PENDING_COMPOSER_QUOTE} {
${referencePhoneVariableStyle}
  }
  ${REFERENCE_PHONE} ${USER_QUOTE} > :first-child,
  ${REFERENCE_PHONE} ${PENDING_COMPOSER_QUOTE} > :first-child {
    line-height: 18px !important;
  }
  ${REFERENCE_PHONE} ${USER_QUOTE}::before,
  ${REFERENCE_PHONE} ${PENDING_COMPOSER_QUOTE}::before {
    flex-basis: 16px;
    width: 16px;
    height: 16px;
  }
${REFERENCE_PHONE} ${PENDING_COMPOSER_QUOTE} { ${pillStyle.removeReservePhone} }

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

export function quotePointerAction(input: {insideQuote: boolean; removeButton: boolean}): QuotePointerAction {
  if (!input.insideQuote) return "ignore";
  return input.removeButton ? "remove" : "block";
}


export function injectQuotePill(document: Document): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = quotePillCss();
  document.head.append(style);

  const stopControls = typeof document.querySelectorAll === "function" ? installLegacyQuoteControls(document) : () => {};

  const removeButton = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLButtonElement>(`button[${LEGACY_QUOTE_REMOVE}]`) : null;
  let dragging = false;
  let ejecting = false;
  let lastEjectKey = "";

  const onKeyDown = (event: KeyboardEvent) => {
    dragging = false;
    const button = removeButton(event.target);
    if (button) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); event.stopPropagation();
        const quote = legacyQuoteFromButton(button);
        if (quote) deleteQuote(quote);
      }
      return;
    }
    if (event.target instanceof HTMLElement && event.target.hasAttribute(QUOTE_PREVIEW_MARK) && document.activeElement === event.target && ["Enter", " ", "Tab"].includes(event.key)) return;
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
    if (removeButton(event.target)) { event.preventDefault(); event.stopPropagation(); return; }
    event.preventDefault();
    event.stopPropagation();
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
    const button = removeButton(event.target);
    const quote = legacyQuoteFromButton(button) ?? composerQuote(event.target);
    const action = quotePointerAction({insideQuote:!!quote, removeButton:!!button});
    if (action === "ignore") return;
    event.preventDefault(); event.stopPropagation();
    if (action === "remove" && quote) deleteQuote(quote);
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
    stopControls();
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
      const view = (current as HTMLElement & {editor?:{view?:QuoteView}}).editor?.view ?? desc?.view;
      if (view?.state?.selection && typeof view.dispatch === "function") return view;
    }
    current = current.parentNode;
  }
  return null;
}

function quoteDesc(quote: HTMLElement): QuoteViewDesc | null {
  const desc = (quote as QuoteElement).pmViewDesc;
  const view = desc?.view ?? editorViewOf(quote);
  if (!desc || !view?.dispatch || !view.state?.tr?.delete) return null;
  if (!Number.isInteger(desc.posBefore) || !Number.isInteger(desc.posAfter)) {
    return null;
  }
  if (desc.posAfter <= desc.posBefore) return null;
  return {posBefore:desc.posBefore, posAfter:desc.posAfter, view};
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
    deleteWithCaret(desc.view, desc.posBefore, desc.posAfter);
  } catch {
    return;
  }
}
