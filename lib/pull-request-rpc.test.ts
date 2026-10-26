import test from "node:test";
import assert from "node:assert/strict";
import { readPullRequest } from "./pull-request-rpc.ts";

const pullRequest = { number:42, title:"PR 복구", state:"open", url:"https://github.com/example/repo/pull/42", baseRefName:"develop", headRefName:"feature/chat" };
function fixture(response:unknown) {
  const signal = new AbortController().signal;
  const calls:any[] = [];
  const sdk = { plugins:{ callRpc:async(args:any) => {
    calls.push(args);
    return args.outputSchema.parse(response);
  } } };
  return { signal, calls, read:() => readPullRequest(sdk,{environmentId:"env",signal}) };
}

test("PR RPC reads one environment and validates the consumed fields",async()=>{
  const f=fixture({env:{outcome:"available",pullRequest:{...pullRequest,attention:"ready_to_merge"}},other:{outcome:"absent"}});
  assert.deepEqual(await f.read(),{outcome:"available",pullRequest});
  const [args]=f.calls;
  assert.equal(args.pluginId,"bb--github-pr-status");
  assert.equal(args.method,"pullRequests");
  assert.deepEqual(args.input,{keys:["env"]});
  assert.equal(args.signal,f.signal);
});

test("absent, unavailable and missing RPC keys never fabricate a PR",async()=>{
  assert.deepEqual(await fixture({env:{outcome:"absent"}}).read(),{outcome:"absent"});
  assert.deepEqual(await fixture({env:{outcome:"unavailable",message:"offline"}}).read(),{outcome:"unavailable",message:"offline"});
  assert.equal((await fixture({}).read()).outcome,"unavailable");
});

test("invalid PR fields fail at the RPC boundary",async()=>{
  for (const invalid of [{...pullRequest,number:0},{...pullRequest,state:"unknown"},{...pullRequest,url:"invalid"},{...pullRequest,baseRefName:undefined}]) {
    await assert.rejects(fixture({env:{outcome:"available",pullRequest:invalid}}).read());
  }
});
