import { createElement, Fragment, useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback } from "react";
import { experimental_Icon, experimental_ProviderIcon, experimental_useProviders, UrlLink, useBbNavigate, useComposer, useSdk, useSettings } from "@get-bb/plugin-sdk/app";
import { backgroundActivities } from "./background-activity.ts";
import { publishInfoData, clearComposerData } from "./composer-data.ts";
import { composerInfoReads, infoKinds, listedInfo } from "./composer-info-settings.ts";
import { childExecutionLabel, childState, childUnread } from "./composer-child.ts";
import { startComposerInfoRefresh, type ComposerInfoSnapshot } from "./composer-info-refresh.ts";
import { createThreadRestorer, type RestoreState } from "./composer-restore.ts";
import { cardSlot } from "./info-card.ts";

const mark = "data-bb-chat-ui-info";

export function ComposerInfoBridge() {
  const sdk = useSdk();
  const navigate = useBbNavigate();
  const { scope } = useComposer();
  const { values, isLoading } = useSettings();
  const reads = composerInfoReads(values ?? {});
  const listed = listedInfo(values ?? {});
  const { providers } = experimental_useProviders();
  const threadId = scope.kind === "thread" ? scope.threadId : null;
  const [snapshot, setSnapshot] = useState<ComposerInfoSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [restoreStates, setRestoreStates] = useState<Record<string, RestoreState>>({});
  const source = useRef<HTMLSpanElement>(null);
  const openThread = useCallback((id: string) => navigate.toThread(id), [navigate]);
  useLayoutEffect(() => {
    const node = source.current;
    return () => { if (node) clearComposerData(node); };
  }, [threadId]);
  useLayoutEffect(() => {
    if (!source.current) return;
    const data = snapshot?.threadId === threadId ? snapshot : null;
    publishInfoData(source.current, {
      settings: values ?? {}, parent: reads.parent ? data?.parent ?? null : null, openThread,
      children: (reads.children ? data?.children ?? [] : []).map(child => ({ id: child.id, title: child.title ?? child.titleFallback ?? "Child Thread", providerId: child.providerId, unread: childUnread(child), state: childState(child.runtime.displayStatus, child.hasPendingInteraction) })),
      background: listed.includes("background") ? backgroundActivities(data?.timeline) : [],
    });
  }, [threadId, snapshot, values, openThread]);
  const restore = useMemo(() => createThreadRestorer(sdk.threads, state => setRestoreStates(previous => ({ ...previous, [state.threadId]:state }))), [sdk]);
  useEffect(() => {
    if (!threadId || isLoading) return;
    const refresh = startComposerInfoRefresh(sdk, threadId, setSnapshot, setError, reads);
    window.addEventListener("focus", refresh.refresh);
    return () => { refresh.stop(); window.removeEventListener("focus", refresh.refresh); };
  }, [sdk, threadId, isLoading, reads.timeline, reads.children, reads.parent, reads.queue, reads.pullRequest]);
  if (!threadId) return null;
  const data = snapshot?.threadId === threadId ? snapshot : null;
  const restoring = restoreStates[threadId];
  const timeline = data?.timeline;
  const children = reads.children ? data?.children ?? [] : [];
  const parent = reads.parent ? data?.parent ?? null : null;
  const providerIcon = (providerId:string) => createElement(experimental_ProviderIcon, {
    providerKind:"agent", provider:providers.find(provider => provider.id === providerId) ?? { id:providerId },
    fallback:"UserRound", className:"size-4", "aria-hidden":true,
  });
  const pullRequest = reads.pullRequest && data?.pullRequest?.outcome === "available" ? data.pullRequest.pullRequest : null;
  const section = (kind: string, title: string, icon: "FileText" | "ListTodo" | "Target" | "UserRound" | "CircleAlert", content: ReturnType<typeof createElement>) => createElement("section", {
    key:kind, [`${mark}-kind`]:kind, "aria-label":title,
  }, createElement("h3", { [cardSlot.head]:"" },
    createElement("span", { [cardSlot.icon]:"", "aria-hidden":true }, createElement(experimental_Icon, { name:icon, "aria-hidden":true })),
    createElement("span", { [cardSlot.title]:"" }, title)),
    kind === "children" ? createElement("button", { type:"button", [`${mark}-dismiss`]:kind, [cardSlot.close]:"", "aria-label":"Child Threads 닫기", title:"Child Threads 닫기" }, "×") : null, content);
  return createElement(Fragment, null,
    createElement("span", {
      ref:source, hidden:true,
      [`${mark}-thread`]:threadId,
      [`${mark}-settings`]:"",
      [`${mark}-pr-title`]:pullRequest?.title ?? undefined,
      [`${mark}-read-only-label`]:data?.readOnly.label ?? undefined,
    }, ...infoKinds.map(kind => createElement("span", { key:kind.key, [`${mark}-icon`]:kind.key },
      createElement(experimental_Icon, { name:kind.icon, "aria-hidden":true }))),
      ...children.map(child => createElement("span", { key:child.id, [`${mark}-child-icon`]:child.id }, providerIcon(child.providerId))),
      parent ? createElement("span", { key:"parent-icon", [`${mark}-parent-icon`]:parent.id }, providerIcon(parent.providerId)) : null,
      createElement("button", { type:"button", [`${mark}-restore-source`]:"unarchive", disabled:restoring?.pending === true,
        [`${mark}-restore-error`]:restoring?.error ?? undefined, onClick:() => void restore(threadId, "unarchive") }, restoring?.pending ? "Unarchiving..." : "Unarchive"),
      createElement("button", { type:"button", [`${mark}-restore-source`]:"environment", disabled:restoring?.pending === true || !data?.readOnly.canRestore,
        [`${mark}-restore-error`]:restoring?.error ?? undefined, onClick:() => void restore(threadId, "environment") }, restoring?.pending ? "Restoring..." : !data ? "불러오는 중" : data.readOnly.canRestore ? "Restore workspace" : "복구 불가")),
    createElement("div", { [`${mark}-supplements`]:"" },
      listed.includes("plan") && timeline?.activePromptMode ? section("plan", "Plan", "FileText", createElement("p", null, timeline.activePromptMode.prompt)) : null,
      listed.includes("goal") && timeline?.goal ? section("goal", "Goal", "Target", createElement("div", null,
        createElement("p", null, timeline.goal.objective),
        createElement("p", { className:"text-subtle-foreground" }, `${timeline.goal.status} · ${timeline.goal.tokensUsed.toLocaleString()}${timeline.goal.tokenBudget == null ? "" : ` / ${timeline.goal.tokenBudget.toLocaleString()}`} tokens · ${Math.round(timeline.goal.timeUsedSeconds)}s`))) : null,
      listed.includes("todos") && timeline?.pendingTodos ? section("todos", "할 일", "ListTodo", createElement("ul", null, ...timeline.pendingTodos.items.map(item => createElement("li", { key:item.id }, `${item.status === "completed" ? "✓" : item.status === "in_progress" ? "◉" : "○"} ${item.text}`)))) : null,
      children.length ? section("children", "Child Threads", "UserRound", createElement("div", { [cardSlot.list]:"" }, ...children.map(child => {
        const title = child.title ?? child.titleFallback ?? "Child Thread";
        const state = childState(child.runtime.displayStatus, child.hasPendingInteraction);
        const metadata = childExecutionLabel(child.executionOptions);
        return createElement("button", { key:child.id, type:"button", [`${mark}-child-row`]:"", [cardSlot.row]:"", onClick:() => navigate.toThread(child.id) },
          createElement("span", { [`${mark}-avatar`]:"", "data-state":state, "data-unread":String(childUnread(child)), "aria-hidden":true },
            createElement("span", { [`${mark}-provider-icon`]:"" }, providerIcon(child.providerId)),
            createElement("span", { [`${mark}-avatar-dot`]:"" })),
          createElement("span", { [`${mark}-child-main`]:"" },
            createElement("span", { [`${mark}-child-title`]:"" }, title),
            metadata ? createElement("span", { [`${mark}-child-meta`]:"", title:metadata }, metadata) : null),
          createElement("span", { [`${mark}-child-status`]:"" }, child.runtime.displayStatus));
      }))) : null,
      reads.queue && data?.queue.length ? section("queue", "대기 메시지", "ListTodo", createElement("div", null, ...data.queue.map(row => createElement("div", { key:row.id },
        createElement("p", null, row.content.filter(part => part.visibility !== "agent-only").map(part => part.type === "text" ? part.text : part.type === "localFile" ? part.name ?? part.path : part.type === "localImage" ? part.path : "Image").join("\n")),
        createElement("p", { className:"text-subtle-foreground" }, row.failureReason ?? (row.sendAt ? new Date(row.sendAt).toLocaleString() : "Queued")))))) : null,
      pullRequest ? section("pullRequest", "Pull request", "ListTodo", createElement("div", null, createElement(UrlLink, { href:pullRequest.url }, `#${pullRequest.number} · ${pullRequest.title}`), createElement("p", null, `${pullRequest.state} · ${pullRequest.checks.state} · ${pullRequest.review.state}`))) : null,
      error && !data ? section("other", "정보를 불러오지 못했습니다", "CircleAlert", createElement("p", null, "연결이 복구되면 다시 읽습니다. 현재 표시된 BB 정보는 계속 열 수 있습니다.")) : null,
    ));
}
