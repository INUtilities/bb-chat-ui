import type { useSdk } from "@get-bb/plugin-sdk/app";
import { z } from "zod";

// Consumed fields from bb--git's discoverable workspaceStatus and files contracts.
const fileStats = z.object({path:z.string(),status:z.string(),insertions:z.number().nullable(),deletions:z.number().nullable()});
const stats = z.object({insertions:z.number(),deletions:z.number(),files:z.array(fileStats)});
const unavailable = [
  z.object({outcome:z.literal("not_applicable"),reason:z.literal("non_git_environment")}),
  z.object({outcome:z.literal("unavailable"),failure:z.object({code:z.string()})}),
] as const;
const workspaceStatus = z.discriminatedUnion("outcome",[
  z.object({outcome:z.literal("available"),workspace:z.object({
    branch:z.object({currentBranch:z.string().nullable(),defaultBranch:z.string()}),
    checkout:z.object({kind:z.string().optional(),headSha:z.string().nullable().optional()}).optional(),
    workingTree:stats.extend({hasUncommittedChanges:z.boolean().optional()}),
    mergeBase:stats.extend({
      baseRef:z.string().nullable(),mergeBaseBranch:z.string(),aheadCount:z.number(),
      commits:z.array(z.object({sha:z.string(),shortSha:z.string(),subject:z.string(),authoredAt:z.number().optional()})),
    }).nullable().optional(),
  })}),
  ...unavailable,
]);
const files = z.discriminatedUnion("outcome",[
  z.object({outcome:z.literal("available"),files:z.array(z.object({path:z.string(),additions:z.number(),deletions:z.number()})),truncated:z.boolean()}),
  ...unavailable,
]);
type Sdk = Pick<ReturnType<typeof useSdk>,"plugins">;

export function readGitWorkspaceStatus(sdk:Sdk,{signal,...input}:{environmentId:string;mergeBaseBranch?:string;signal:AbortSignal}) {
  // Unlike keyed status, workspaceStatus accepts a comparison without mutating the saved merge base.
  return sdk.plugins.callRpc({pluginId:"bb--git",method:"workspaceStatus",input,outputSchema:workspaceStatus,signal});
}

export function readGitFiles(sdk:Sdk,{environmentId,target,signal}:{environmentId:string;target:"uncommitted";signal:AbortSignal}) {
  return sdk.plugins.callRpc({
    pluginId:"bb--git",method:"files",input:{environmentId,target:{type:target},ignoreWhitespace:false},outputSchema:files,signal,
  });
}
