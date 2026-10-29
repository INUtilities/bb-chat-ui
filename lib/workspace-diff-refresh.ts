import type { useSdk } from "@get-bb/plugin-sdk/app";
import { readGitWorkspaceStatus, readGitFiles } from "./git-rpc.ts";
import { readWorkspaceDiff, type WorkspaceDiffSnapshot } from "./workspace-diff-data.ts";
import { readPullRequest, type PullRequestResult } from "./pull-request-rpc.ts";

type Sdk = Pick<ReturnType<typeof useSdk>, "threads" | "environments" | "plugins" | "subscribe">;

export function startWorkspaceDiffRefresh(sdk:Sdk, threadId:string, publish:(summary:WorkspaceDiffSnapshot | null) => void) {
  const controller = new AbortController();
  const { signal } = controller;
  let environmentId:string | null = null;
  let mergeBaseBranch:string | undefined;
  let contextDirty = true;
  let revision = 0;
  let fetching = false;
  let pending = false;
  let published = false;
  let prDirty = true;
  let prCache:{ environmentId:string; expiresAt:number; value:PullRequestResult } | null = null;
  const startedAt = Date.now();
  const refresh = async (forcePr = false) => {
    if (signal.aborted) return;
    if (forcePr) { prDirty = true; revision++; }
    if (fetching) { pending = true; return; }
    fetching = true;
    const current = revision;
    const refreshAt = Date.now();
    const stale = () => signal.aborted || current !== revision;
    const update = async (summary:WorkspaceDiffSnapshot | null) => {
      if (stale()) return;
      const remaining = published ? 0 : 500 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener("abort",finish); resolve(); };
        const timer = setTimeout(finish,remaining);
        signal.addEventListener("abort",finish,{ once:true });
      });
      if (stale()) return;
      published = true; publish(summary);
    };
    try {
      if (contextDirty) {
        const thread = await sdk.threads.get({ threadId, signal });
        if (stale()) return;
        const id = thread.environmentId;
        if (!id) { environmentId = null; await update(null); return; }
        const environment = await sdk.environments.get({ environmentId:id, signal });
        if (stale()) return;
        environmentId = id;
        mergeBaseBranch = environment.mergeBaseBranch || undefined;
        contextDirty = false;
      }
      if (!environmentId) return;
      const result = await readWorkspaceDiff({
        status:args => readGitWorkspaceStatus(sdk,args),
        diffFiles:args => readGitFiles(sdk,args),
        pullRequest:async args => {
          const cached = prCache?.environmentId === args.environmentId ? prCache : null;
          if (!prDirty && cached && Date.now() < cached.expiresAt) return cached.value;
          // Keep the regular 30s boundary even after a forced read between ticks.
          const expiresAt = startedAt + (Math.floor((refreshAt - startedAt) / 30000) + 1) * 30000;
          try {
            const value = await readPullRequest(sdk,args);
            if (value.outcome === "unavailable") return cached?.value ?? value;
            if (!stale()) { prCache = { environmentId:args.environmentId, expiresAt, value }; prDirty = false; }
            return value;
          } catch (error) {
            // Preserve a known PR base during failure, but retry next tick.
            if (cached) return cached.value;
            throw error;
          }
        },
      }, environmentId, mergeBaseBranch, signal);
      if (!stale()) {
        if (result) await update(result);
        else if (result === undefined || !published) await update(null);
      }
    } catch {
      // Keep the last summary during a temporary disconnect.
      if (!stale() && !published) await update(null);
    } finally {
      fetching = false;
      if (pending && !signal.aborted) { pending = false; void refresh(); }
    }
  };
  const invalidate = () => {
    revision++;
    contextDirty = true;
    prDirty = true;
    void refresh();
  };
  const stopThread = sdk.subscribe({
    event:"thread:changed", threadId,
    callback:event => {
      if (event.id && event.id !== threadId) return;
      if (event.changes.includes("environment-changed")) invalidate();
    },
  });
  const stopEnvironment = sdk.subscribe({
    event:"environment:changed",
    callback:event => {
      if (environmentId && event.id && event.id !== environmentId) return;
      invalidate();
    },
  });
  void refresh();
  return { refresh, stop:() => { controller.abort(); stopThread(); stopEnvironment(); } };
}
