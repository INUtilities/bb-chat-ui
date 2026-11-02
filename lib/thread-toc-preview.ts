export const TOC_REPLY_MARK = "data-bb-chat-ui-toc-reply";

// BB의 비공개 React 연결은 읽기만 하며 현재 구조를 확인할 수 없으면 표시를 중단한다.
interface NativeFiber {
  key?: string | null;
  memoizedProps?: unknown;
  return?: NativeFiber | null;
  alternate?: NativeFiber | null;
}

interface NativeRow {
  kind?: unknown;
  id?: unknown;
  role?: unknown;
  text?: unknown;
  threadId?: unknown;
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
  return matches.length === 1 ? matches[0] ?? null : null;
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
  for (const reply of Array.from(root.querySelectorAll(`[${TOC_REPLY_MARK}]`))) reply.remove();
}

// 선택한 사용자 항목에 응답 한 개만 표시하며 읽을 수 없는 자료를 추정하지 않는다.
export function paintTocReply(root: HTMLElement, item: HTMLElement): void {
  const button = item.querySelector("button");
  if (!(button instanceof HTMLElement)) return;
  for (const reply of Array.from(root.querySelectorAll(`[${TOC_REPLY_MARK}]`))) {
    if (reply.parentElement !== button) reply.remove();
  }
  const value = nativeReply(root, item);
  const text = value === undefined ? "응답 미리보기를 불러오지 못했습니다." : value ?? "표시할 응답이 없습니다.";
  let reply = button.querySelector<HTMLElement>(`[${TOC_REPLY_MARK}]`);
  if (!reply) {
    reply = root.ownerDocument.createElement("span");
    reply.setAttribute(TOC_REPLY_MARK, "");
    button.append(reply);
  }
  if (reply.textContent !== text) reply.textContent = text;
}
