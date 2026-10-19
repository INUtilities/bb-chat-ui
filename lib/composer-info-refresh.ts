import type { composerInfoReads } from "./composer-info-settings.ts";
import type { useSdk } from "@get-bb/plugin-sdk/app";
import { childEventRefreshes, childListArgs, timelineEventTypes, visibleChildren, type ChildChangeEvent } from "./composer-child.ts";
import { loadParent, parentEventMatters, type ParentSummary } from "./composer-parent.ts";

type Sdk = Pick<ReturnType<typeof useSdk>, "threads" | "environments" | "subscribe">;
type Timeline = Awaited<ReturnType<Sdk["threads"]["timeline"]>>;
type Children = Awaited<ReturnType<Sdk["threads"]["list"]>>;
type Queue = Awaited<ReturnType<Sdk["threads"]["queuedMessages"]["list"]>>;
type PullRequest = Awaited<ReturnType<Sdk["environments"]["pullRequest"]>>;
export interface ComposerInfoSnapshot {
  threadId:string; timeline:Timeline|null; children:Children; parent:ParentSummary|null;
  queue:Queue; pullRequest:PullRequest|null; readOnly:{label:string|null;canRestore:boolean};
}
type Part = "timeline" | "children" | "context" | "parent";
const all:readonly Part[] = ["timeline", "children", "context", "parent"];
type Scope = { threadId:string; parentId:string|null; childIds:ReadonlySet<string> };
function refreshTargets(event:ChildChangeEvent, scope:Scope):readonly Part[] {
  if (!childEventRefreshes(event,scope)) return [];
  if (!event.id) return all;
  if (event.id===scope.threadId) {
    const parts=new Set<Part>();
    for (const change of event.changes) {
      if (["read-state-changed","tabs-changed","terminals-changed","title-changed","pin-state-changed"].includes(change)) continue;
      if (change==="events-appended") {
        // Missing metadata cannot prove that only streaming text changed.
        if (!event.metadata?.eventTypes) { parts.add("timeline"); parts.add("context"); }
        else if (event.metadata.eventTypes.some(type=>(timelineEventTypes as readonly string[]).includes(type))) parts.add("timeline");
      } else if (["archived-changed","environment-changed","parent-changed","queue-changed","interactions-changed"].includes(change)) parts.add("context");
      else { parts.add("timeline"); parts.add("context"); }
    }
    return [...parts];
  }
  if (event.changes.some(change=>["thread-created","parent-changed","archived-changed"].includes(change))) return ["children"];
  if (event.id===scope.parentId) return ["parent"];
  return ["children"];
}

export function startComposerInfoRefresh(
  sdk:Sdk, threadId:string, publish:(snapshot:ComposerInfoSnapshot)=>void, onError:(error:boolean)=>void,
  reads:Partial<ReturnType<typeof composerInfoReads>> = {},
) {
  const enabled = (part:Part) => part==="context" || reads[part]!==false;
  const active=all.filter(enabled);
  const controller = new AbortController();
  const { signal } = controller;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let fetching = false;
  let revision = 0;
  let snapshot:ComposerInfoSnapshot|null = null;
  let parentId:string|null = null;
  let readingParentId:string|null = null;
  let childIds = new Set<string>();
  const pending = new Set<Part>();
  const failed = new Set<Part>();
  const schedule = (parts:readonly Part[]) => {
    const targets=[...parts,...failed].filter(enabled);
    if (signal.aborted || !targets.length) return;
    revision++;
    for (const part of targets) pending.add(part);
    if (!timer) timer = setTimeout(() => { timer=undefined; void run(); },250);
  };
  const readChildren = async () => {
    const children:Children=[];
    for (let offset=0; !signal.aborted; offset+=100) {
      const page=await sdk.threads.list(childListArgs(threadId,offset,signal));
      children.push(...page);
      if (page.length<100) break;
    }
    return visibleChildren(children);
  };
  const readContext = async () => {
    const thread=await sdk.threads.get({threadId,include:"environment",signal});
    if (signal.aborted) throw new Error("Composer info refresh stopped");
    const environment="environment" in thread ? thread.environment : null;
    const lifecycle=environment?.hostLifecycle;
    const label=thread.archivedAt!==null ? "Archived thread" : lifecycle==="removed" ? "Machine removed"
      : lifecycle==="removing" ? "Machine removal in progress" : lifecycle==="cleanup-failed" ? "Machine cleanup failed"
      : environment?.status==="destroyed" ? "Environment unavailable" : null;
    const readOnly={label,canRestore:thread.canRestoreEnvironment};
    const results=await Promise.allSettled([
      label && reads.queue!==false ? sdk.threads.queuedMessages.list({threadId,signal}) : Promise.resolve([] as Queue),
      reads.pullRequest!==false && thread.environmentId ? sdk.environments.pullRequest({environmentId:thread.environmentId,signal}) : Promise.resolve(null),
    ]);
    return {queue:results[0].status==="fulfilled" ? results[0].value : [],
      pullRequest:results[1].status==="fulfilled" ? results[1].value : null,readOnly,parentThreadId:thread.parentThreadId};
  };
  const run = async () => {
    if (signal.aborted || fetching || !pending.size) return;
    fetching=true;
    const parts=new Set(snapshot ? pending : active);
    pending.clear();
    const current=revision;
    try {
      const [timeline,children,context]=await Promise.all([
        parts.has("timeline") ? sdk.threads.timeline({threadId,summaryOnly:"true",signal}) : snapshot?.timeline ?? null,
        parts.has("children") ? readChildren() : snapshot?.children ?? [],
        parts.has("context") ? readContext() : null,
      ]);
      if (signal.aborted) return;
      const nextParentId=reads.parent===false ? null : context ? context.parentThreadId : parentId;
      readingParentId=nextParentId;
      const parent=parts.has("parent") || nextParentId!==parentId
        ? await loadParent((id,parentSignal)=>sdk.threads.get({threadId:id,signal:parentSignal}),threadId,{id:threadId,parentThreadId:nextParentId},signal)
        : snapshot?.parent ?? null;
      if (signal.aborted) return;
      if (current!==revision) {
        // Keep the last coherent snapshot; retry in-flight sources together with queued changes.
        for (const part of parts) pending.add(part);
        return;
      }
      parentId=nextParentId;
      if (parts.has("children")) childIds=new Set(children.map(child=>child.id));
      snapshot={threadId,timeline,children,parent,
        queue:context ? context.queue : snapshot!.queue,
        pullRequest:context ? context.pullRequest : snapshot!.pullRequest,
        readOnly:context ? context.readOnly : snapshot!.readOnly};
      failed.clear();
      publish(snapshot);
      onError(false);
    } catch {
      if (!signal.aborted) {
        for (const part of parts) failed.add(part);
        onError(true);
      }
    } finally {
      readingParentId=null;
      fetching=false;
      if (pending.size) for (const part of failed) pending.add(part);
      if (pending.size && !signal.aborted && !timer) timer=setTimeout(()=>{timer=undefined;void run();},250);
    }
  };
  const stopThread=sdk.subscribe({event:"thread:changed",callback:event=>{
    schedule(event.id===readingParentId && parentEventMatters(event.changes)
      ? ["parent"] : refreshTargets(event,{threadId,parentId,childIds}));
  }});
  const stopConnection=sdk.subscribe({event:"realtime:connection",callback:event=>{
    if (event.state==="connected" && event.reconnected) schedule(all);
  }});
  for (const part of active) pending.add(part);
  void run();
  return {
    refresh:()=>schedule(all),
    stop:()=>{controller.abort();stopThread();stopConnection();clearTimeout(timer);pending.clear();},
  };
}
