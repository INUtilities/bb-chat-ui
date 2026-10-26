import type { useSdk } from "@get-bb/plugin-sdk/app";
import { z } from "zod";

// Consumed fields from `bb plugin rpc inspect bb--github-pr-status pullRequests`.
// callRpc takes an outputSchema; the keyed-query hook's contract is not needed.
const pullRequestResult = z.discriminatedUnion("outcome", [
  z.object({ outcome:z.literal("available"), pullRequest:z.object({
    number:z.number().int().positive(), title:z.string(),
    state:z.enum(["draft","open","merged","closed"]), url:z.url(),
    baseRefName:z.string(), headRefName:z.string(),
  }) }),
  z.object({ outcome:z.literal("absent") }),
  z.object({ outcome:z.literal("unavailable"), message:z.string().min(1) }),
]);
const outputSchema = z.record(z.string(),pullRequestResult);
export type PullRequestResult = z.infer<typeof pullRequestResult>;

export async function readPullRequest(
  sdk:Pick<ReturnType<typeof useSdk>,"plugins">,
  {environmentId,signal}:{environmentId:string;signal:AbortSignal},
):Promise<PullRequestResult> {
  const results = await sdk.plugins.callRpc({
    pluginId:"bb--github-pr-status", method:"pullRequests",
    input:{keys:[environmentId]}, outputSchema, signal,
  });
  return results[environmentId] ?? {outcome:"unavailable",message:"PR RPC omitted the environment"};
}
