import { parentEventMatters } from "./composer-parent.ts";

export type ChildState = "run" | "wait" | "done" | "error";
export interface ChildSummary { id:string; title:string; providerId?:string; state?:ChildState; running?:boolean; }

export function childInitial(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "↗";
  if (words[0].length <= 2 && /^[a-z\d]+$/i.test(words[0])) return words[0].toUpperCase();
  return (words.length > 1 ? Array.from(words[0])[0] + Array.from(words[1])[0] : Array.from(words[0]).slice(0, 2).join("")).toUpperCase();
}

export function childState(status: string, needsInput: boolean): ChildState {
  if (needsInput || status === "waiting-for-host") return "wait";
  if (status === "error") return "error";
  return status === "idle" ? "done" : "run";
}

export function childExecutionLabel(options?: {model?:string;reasoningLevel?:string}|null):string {
  return [options?.model,options?.reasoningLevel].filter(Boolean).join(" · ");
}

export function childListArgs(parentThreadId: string, offset: number, signal?: AbortSignal) {
  return { parentThreadId, limit: 100, offset, archived: false as const, signal };
}

export function visibleChildren<T extends { archivedAt: number | null }>(children: readonly T[]): T[] {
  return children.filter(child => child.archivedAt === null);
}

export interface ChildChangeEvent {
  id?: string;
  changes: readonly string[];
  metadata?: { eventTypes?: readonly string[] };
}

export const timelineEventTypes = [
  "thread/goal/updated", "thread/goal/cleared", "turn/plan/updated", "thread/extensionState/updated", "turn/completed",
  "item/backgroundTask/progress", "item/backgroundTask/completed", "item/delegation/progress", "item/delegation/completed",
] as const;

export function childEventRefreshes(
  event: ChildChangeEvent,
  scope: { threadId: string; parentId: string | null; childIds: ReadonlySet<string> },
): boolean {
  if (event.changes.includes("archived-changed")) return true;
  if (event.changes.some(change => change === "thread-created" || change === "parent-changed")) return true;
  if (scope.parentId && event.id === scope.parentId) return parentEventMatters(event.changes);
  if (event.id !== scope.threadId && (!event.id || !scope.childIds.has(event.id))) return false;
  if (event.changes.some(change => change !== "events-appended" && change !== "read-state-changed" && change !== "tabs-changed" && change !== "terminals-changed")) return true;
  const types = event.metadata?.eventTypes;
  return event.changes.includes("events-appended") && (!types || types.some(type => (timelineEventTypes as readonly string[]).includes(type)));
}
