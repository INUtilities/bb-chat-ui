import type { BackgroundActivity } from "./background-activity.ts";
import type { ChildSummary } from "./composer-child.ts";
import type { ParentSummary } from "./composer-parent.ts";
import type { WorkspaceDiffSnapshot } from "./workspace-diff-data.ts";

export const composerDataChanged = "bb-chat-ui:composer-data";
export interface ComposerInfoData {
  settings: Record<string, unknown>;
  children: readonly ChildSummary[];
  parent: ParentSummary | null;
  background?: readonly BackgroundActivity[];
  openThread?: (id: string) => void;
}
export interface ComposerDiffData {
  threadId: string;
  state: "loading" | "ready" | "unavailable";
  summary: Partial<WorkspaceDiffSnapshot> | null;
}
interface Snapshot<T> { value: T; revision: number; }
const info = new WeakMap<Element, Snapshot<ComposerInfoData> & { childrenRevision: number }>();
const diff = new WeakMap<Element, Snapshot<ComposerDiffData>>();
let revision = 0;

// SDK refreshes may return equal objects. Keep those updates quiet without a JSON round trip.
export function sameComposerData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  return left.length === right.length && left.every(key => Object.hasOwn(b, key) &&
    sameComposerData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function notify(source: Element) {
  const Event = source.ownerDocument.defaultView?.Event;
  if (Event) source.dispatchEvent(new Event(composerDataChanged, { bubbles: true }));
}
function publish<T>(map: WeakMap<Element, Snapshot<T>>, source: Element, value: T) {
  if (sameComposerData(map.get(source)?.value, value)) return;
  map.set(source, { value, revision: ++revision });
  notify(source);
}
export const readInfoData = (source: Element | null | undefined) => source ? info.get(source) : undefined;
export const readDiffData = (source: Element | null | undefined) => source ? diff.get(source) : undefined;
export function publishInfoData(source: Element, value: ComposerInfoData) {
  const previous = info.get(source);
  if (previous && sameComposerData(previous.value.settings, value.settings)
    && sameComposerData(previous.value.children, value.children) && sameComposerData(previous.value.parent, value.parent)
    && sameComposerData(previous.value.background, value.background)) {
    // Refresh action closures without turning them into a visual data change.
    if (previous.value.openThread !== value.openThread) info.set(source, { ...previous, value });
    return;
  }
  const childrenRevision = previous && sameComposerData(previous.value.children, value.children)
    ? previous.childrenRevision : ++revision;
  info.set(source, { value, revision: ++revision, childrenRevision });
  notify(source);
}
export function publishDiffData(source: Element, value: ComposerDiffData) { publish(diff, source, value); }
export function clearComposerData(source: Element) {
  const removedInfo = info.delete(source), removedDiff = diff.delete(source);
  if (removedInfo || removedDiff) notify(source);
}
