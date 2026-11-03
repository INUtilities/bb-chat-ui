export const TOC_REPLY_MARK = "data-bb-chat-ui-toc-reply";

// BB의 비공개 React 연결은 읽기만 하며 현재 구조를 확인할 수 없으면 표시를 중단한다.
interface NativeFiber {
  key?: string | null;
  memoizedProps?: unknown;
  return?: NativeFiber | null;
  alternate?: NativeFiber | null;
  stateNode?: { current?: NativeFiber } | null;
}

interface NativeRow {
  kind?: unknown;
  id?: unknown;
  role?: unknown;
  text?: unknown;
  threadId?: unknown;
}

type OutlineItem = { id: string; role: string; preview: string };
type OutlineReader = (signal: AbortSignal) => Promise<{ items: OutlineItem[] }>;
type Outline = { replies: Map<string, string | null>; loaded: boolean; stale: boolean; size: number };
const outlines = new Map<string, Outline>();
const active = new Map<string, { request: () => void; invalidate: () => void; stop: () => void }>();
const visible = new Map<string, { root: HTMLElement; item: HTMLElement }>();
const MAX_THREADS = 8, MAX_TEXT = 128_000, MAX_THREAD_TEXT = 32_000;

// 플러그인이 추가한 미리보기를 제거한다.
function removeReply(reply: HTMLElement): void {
  reply.remove();
}

// 최근 목차의 텍스트만 제한된 크기로 보관하고 DOM은 캐시에 넣지 않는다.
function remember(threadId: string, outline: Outline): void {
  outlines.delete(threadId); outlines.set(threadId, outline);
  let size = [...outlines.values()].reduce((sum, entry) => sum + entry.size, 0);
  while (outlines.size > MAX_THREADS || size > MAX_TEXT) {
    const oldest = outlines.keys().next().value!;
    size -= outlines.get(oldest)!.size; outlines.delete(oldest);
  }
}

// 목차를 사용할 때만 읽고 재방문 캐시는 사용 시점에 다시 확인한다.
export function registerTocOutlineReader(threadId: string, reader: OutlineReader): () => void {
  let stopped = false;
  let running = false;
  let revision = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  active.get(threadId)?.stop();
  const cached = outlines.get(threadId);
  if (cached) cached.stale = true;
  // 실제로 보고 있는 연결된 카드만 갱신한다.
  const repaint = () => {
    const target = visible.get(threadId);
    if (target?.root.isConnected && target.item.isConnected) paintTocReply(target.root, target.item);
    else visible.delete(threadId);
  };
  // 같은 요청을 합치고 사용하지 않는 목차는 읽지 않는다.
  const request = () => {
    if (stopped || running || outlines.get(threadId)?.stale === false) return;
    const target = visible.get(threadId);
    if (!target?.root.isConnected || !target.item.isConnected) return;
    clearTimeout(timer);
    running = true;
    const version = revision;
    controller = new AbortController();
    const signal = controller.signal;
    if (!outlines.has(threadId)) remember(threadId, { replies: new Map(), loaded: false, stale: true, size: 0 });
    void Promise.resolve().then(() => signal.aborted ? undefined : reader(signal)).then(result => {
      if (!result || stopped || version !== revision) return;
      const replies = new Map<string, string | null>();
      let size = 0;
      let userId: string | undefined;
      for (const item of result.items) {
        if (item.role === "user") { userId = item.id; replies.set(userId, null); }
        else if (item.role === "assistant" && userId && item.preview?.trim()) {
          size -= replies.get(userId)?.length ?? 0;
          const text = item.preview.trim().slice(0, 2000); replies.set(userId, text); size += text.length;
        }
        // 오래된 항목부터 비워 긴 채팅도 캐시 상한을 넘지 않게 한다.
        while (size > MAX_THREAD_TEXT || replies.size > 256) {
          const oldest = replies.keys().next().value!;
          size -= replies.get(oldest)?.length ?? 0; replies.delete(oldest);
        }
      }
      remember(threadId, { replies, loaded: true, stale: false, size });
      repaint();
    }).catch(() => {
      if (stopped || version !== revision) return;
      const previous = outlines.get(threadId);
      remember(threadId, { replies: previous?.replies ?? new Map(), loaded: true, stale: false, size: previous?.size ?? 0 });
      repaint();
    }).finally(() => {
      running = false;
      if (version !== revision && !stopped && visible.has(threadId)) timer = setTimeout(request, 500);
    });
  };
  // 화면 밖의 변경은 표시만 남기고 다음 사용 때 읽는다.
  const invalidate = () => {
    revision++;
    const outline = outlines.get(threadId); if (outline) outline.stale = true;
    const target = visible.get(threadId);
    if (target?.root.isConnected && target.item.isConnected) request();
  };
  // 전환 시 조회와 예약을 취소하되 제한된 텍스트 캐시는 유지한다.
  const stop = () => { stopped = true; clearTimeout(timer); controller?.abort(); visible.delete(threadId); };
  active.set(threadId, { request, invalidate, stop });
  return () => { if (active.get(threadId)?.stop === stop) { active.delete(threadId); stop(); } };
}

// 같은 스레드의 변경을 짧게 모아 목차를 갱신한다.
export function refreshTocOutline(threadId: string): void {
  active.get(threadId)?.invalidate();
}

// DOM에 연결된 fiber가 현재 React 트리에 속하는지 판별한다.
function isCurrentFiber(fiber: NativeFiber): boolean {
  let root = fiber;
  while (root.return) root = root.return;
  return root.stateNode?.current === root;
}

// 호스트 DOM의 현재 props와 일치하는 fiber만 선택하고 모호한 이전 트리는 제외한다.
function currentFiber(node: HTMLElement): NativeFiber | null {
  const fields = node as unknown as Record<string, unknown>;
  const keys = Object.keys(fields);
  const fiberKey = keys.find(key => key.startsWith("__reactFiber$"));
  const propsKey = keys.find(key => key.startsWith("__reactProps$"));
  if (!fiberKey || !propsKey) return null;
  const fiber = fields[fiberKey] as NativeFiber | undefined;
  const matches = [fiber, fiber?.alternate].filter(candidate => candidate?.memoizedProps === fields[propsKey]);
  if (matches.length === 1) return matches[0] ?? null;
  const current = matches.filter((candidate): candidate is NativeFiber => !!candidate && isCurrentFiber(candidate));
  return current.length === 1 ? current[0] : null;
}

// 같은 native 목차의 사용자 ID 뒤부터 다음 사용자 앞까지 마지막 응답을 읽는다.
function nativeReply(root: HTMLElement, item: HTMLElement): string | null | undefined {
  const userId = currentFiber(item)?.key;
  if (typeof userId !== "string") return undefined;
  let fiber = currentFiber(root);
  for (let depth = 0; fiber && depth < 32; depth++, fiber = fiber.return ?? null) {
    const props = fiber.memoizedProps as { threadId?: unknown; timelineRows?: unknown } | null;
    if (typeof props?.threadId !== "string" || !Array.isArray(props.timelineRows)) continue;
    const rows = props.timelineRows as NativeRow[];
    const index = rows.findIndex(row => row?.kind === "conversation" && row.id === userId && row.role === "user" && row.threadId === props.threadId);
    if (index < 0) return undefined;
    let reply: string | null = null;
    for (const row of rows.slice(index + 1)) {
      // 펼치지 않은 요약 안의 사용자 경계를 건너 다른 응답을 연결하지 않는다.
      if (row?.kind === "turn") return reply?.replace(/\s+/g, " ").trim().slice(0, 2000) ?? undefined;
      if (row?.kind !== "conversation") continue;
      if (row.threadId !== props.threadId) return undefined;
      if (row.role === "user") break;
      if (row.role === "assistant" && typeof row.text === "string" && row.text.trim()) reply = row.text;
    }
    return reply?.replace(/\s+/g, " ").trim().slice(0, 2000) ?? null;
  }
  return undefined;
}

// 플러그인이 추가한 응답만 제거하고 native 사용자 메시지와 클릭을 유지한다.
export function clearTocReplies(root: HTMLElement): void {
  for (const [threadId, target] of visible) if (target.root === root) visible.delete(threadId);
  for (const reply of Array.from(root.querySelectorAll<HTMLElement>(`[${TOC_REPLY_MARK}]`))) removeReply(reply);
}

// 선택한 사용자 항목에 응답 한 개만 표시하며 읽을 수 없는 자료를 추정하지 않는다.
export function paintTocReply(root: HTMLElement, item: HTMLElement): void {
  const button = item.querySelector("button");
  if (!(button instanceof HTMLElement)) return;
  for (const reply of Array.from(root.querySelectorAll<HTMLElement>(`[${TOC_REPLY_MARK}]`))) {
    if (reply.parentElement !== button) removeReply(reply);
  }
  const userId = currentFiber(item)?.key;
  const panel = root.querySelector<HTMLElement>('[id^="thread-toc-panel-"]');
  const threadId = panel?.id.slice("thread-toc-panel-".length);
  if (threadId) { visible.set(threadId, { root, item }); active.get(threadId)?.request(); }
  const outline = threadId ? outlines.get(threadId) : undefined;
  const value = typeof userId === "string" && outline?.replies.has(userId)
    ? outline.replies.get(userId) : nativeReply(root, item);
  const text = value === undefined
    ? outline && !outline.loaded ? "응답 미리보기를 불러오는 중…" : "응답 미리보기를 불러오지 못했습니다."
    : value ?? "표시할 응답이 없습니다.";
  let reply = button.querySelector<HTMLElement>(`[${TOC_REPLY_MARK}]`);
  if (!reply) {
    reply = root.ownerDocument.createElement("span");
    reply.setAttribute(TOC_REPLY_MARK, "");
    button.append(reply);
  }
  if (reply.textContent !== text) reply.textContent = text;
}
