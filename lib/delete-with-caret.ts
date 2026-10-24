interface DeletionTransaction {
  doc?: { content: { size: number }; resolve(pos: number): unknown };
  setSelection?(selection: unknown): DeletionTransaction;
}

interface DeletionView {
  state: {
    tr: { delete(from: number, to: number): unknown };
    selection?: { constructor: { near?($pos: unknown, bias: number): unknown } };
  };
  dispatch(transaction: unknown): void;
  focus?(): void;
}

// Keep deletion and caret placement in the same native history transaction.
// A block boundary may need to resolve into the next (or final previous) paragraph.
export function deleteWithCaret(view: DeletionView, from: number, to: number): void {
  const transaction = view.state.tr.delete(from, to) as DeletionTransaction;
  const selection = view.state.selection?.constructor;
  if (transaction.doc && transaction.setSelection && selection?.near) {
    transaction.setSelection(selection.near(transaction.doc.resolve(Math.min(from, transaction.doc.content.size)), 1));
  }
  view.dispatch(transaction);
  view.focus?.();
}
