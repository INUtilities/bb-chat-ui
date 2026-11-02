export const TOC_REPLY_MARK = "data-bb-chat-ui-toc-reply";

export interface TocOutline {
  items: readonly { id: string; role: "user" | "assistant"; preview: string }[];
}
export type TocOutlineReader = (threadId: string, signal: AbortSignal) => Promise<TocOutline>;
interface ReaderSource { read: TocOutlineReader; pending: Set<AbortController>; }
interface ReplyState {
  threadId: string;
  reader: TocOutlineReader;
  source?: ReaderSource;
  controller: AbortController;
  item: HTMLElement;
  reply: HTMLElement;
  userId: string;
  index?: Map<string, string | null>;
  failed?: boolean;
}
const sources = new WeakMap<Document, Set<ReaderSource>>();
const states = new WeakMap<HTMLElement, ReplyState>();

// 앱 전체 SDK owner가 읽기를 제공하며 해제 시 미완의 요청도 중단한다.
export function registerTocOutlineReader(doc: Document, read: TocOutlineReader): () => void {
  let owners = sources.get(doc);
  if (!owners) sources.set(doc, owners = new Set());
  const source: ReaderSource = { read, pending: new Set() };
  owners.add(source);
  return () => {
    owners.delete(source);
    for (const controller of source.pending) controller.abort();
    source.pending.clear();
    if (!owners.size) sources.delete(doc);
  };
}
function activeSource(doc: Document): ReaderSource | undefined { return [...(sources.get(doc) ?? [])].at(-1); }
function threadId(root: HTMLElement): string | null {
  const id = root.querySelector('button.no-scrollbar')?.getAttribute('aria-controls');
  const prefix = 'thread-toc-panel-';
  return id?.startsWith(prefix) ? id.slice(prefix.length) || null : null;
}
function userId(item: HTMLElement): string | null {
  const fields = item as unknown as Record<string, unknown>;
  const field = Object.keys(fields).find(key => key.startsWith('__reactFiber$'));
  const fiber = (field ? fields[field] : null) as {key?: unknown; alternate?: {key?: unknown}} | null;
  return typeof fiber?.key === 'string' && (!fiber.alternate || fiber.alternate.key === fiber.key) ? fiber.key : null;
}
function replyIndex(outline: TocOutline): Map<string, string | null> {
  const index = new Map<string, string | null>();
  let current: string | null = null;
  for (const item of outline.items) {
    if (item.role === 'user') { current = item.id; index.set(current, null); }
    else if (item.role === 'assistant' && current && item.preview.trim()) index.set(current, item.preview.replace(/\s+/g, ' ').trim().slice(0, 2000));
  }
  return index;
}
function cancel(root: HTMLElement): void {
  states.get(root)?.controller.abort();
  states.delete(root);
}
function render(root: HTMLElement, state: ReplyState): void {
  if (states.get(root) !== state || state.controller.signal.aborted || !root.isConnected ||
    threadId(root) !== state.threadId || !root.contains(state.item) || userId(state.item) !== state.userId ||
    state.reply.parentElement !== state.item.querySelector('button') ||
    (state.source && activeSource(root.ownerDocument) !== state.source)) return;
  const value = state.index?.get(state.userId);
  const text = state.failed ? '응답 미리보기를 불러오지 못했습니다.' : !state.index ? '응답을 불러오는 중…'
    : value === undefined ? '응답 미리보기를 불러오지 못했습니다.' : value ?? '표시할 응답이 없습니다.';
  if (state.reply.textContent !== text) state.reply.textContent = text;
}

// 닫거나 분리된 목차는 요청과 캐시를 해제한다. 다시 열면 새 목차를 읽는다.
export function clearTocReplies(root: HTMLElement): void {
  cancel(root);
  for (const reply of Array.from(root.querySelectorAll(`[${TOC_REPLY_MARK}]`))) reply.remove();
}

// 열린 목차의 공개 outline을 공유하므로 눈금을 옮길 때마다 조회하지 않는다.
export function paintTocReply(root: HTMLElement, item: HTMLElement, readOutline?: TocOutlineReader): void {
  const button = item.querySelector('button');
  if (!(button instanceof HTMLElement)) return;
  for (const reply of Array.from(root.querySelectorAll(`[${TOC_REPLY_MARK}]`))) if (reply.parentElement !== button) reply.remove();
  let reply = button.querySelector<HTMLElement>(`[${TOC_REPLY_MARK}]`);
  if (!reply) { reply = root.ownerDocument.createElement('span'); reply.setAttribute(TOC_REPLY_MARK, ''); button.append(reply); }
  const id = threadId(root), user = userId(item), source = readOutline ? undefined : activeSource(root.ownerDocument);
  const reader = readOutline ?? source?.read;
  if (!id || !user || !reader) {
    cancel(root);
    const text = '응답 미리보기를 불러오지 못했습니다.';
    if (reply.textContent !== text) reply.textContent = text;
    return;
  }
  let state = states.get(root);
  if (!state || state.threadId !== id || state.reader !== reader || state.source !== source || state.controller.signal.aborted) {
    cancel(root);
    state = {threadId: id, reader, source, controller: new AbortController(), item, reply, userId: user};
    states.set(root, state);
    const pending = state;
    source?.pending.add(pending.controller);
    void Promise.resolve().then(() => reader(id, pending.controller.signal)).then(outline => {
      if (pending.controller.signal.aborted) return;
      pending.index = replyIndex(outline);
      render(root, pending);
    }).catch(() => {
      pending.failed = true;
      render(root, pending);
    }).finally(() => source?.pending.delete(pending.controller));
  }
  state.item = item; state.reply = reply; state.userId = user;
  render(root, state);
}
