import test from "node:test";
import assert from "node:assert/strict";
import { readGitWorkspaceStatus, readGitFiles } from "./git-rpc.ts";

const workspace = {
  branch:{currentBranch:"feature/chat",defaultBranch:"main"},
  checkout:{kind:"branch",headSha:"head"},
  workingTree:{insertions:7,deletions:2,hasUncommittedChanges:true,files:[{path:"image.png",status:"M",insertions:null,deletions:null}]},
  mergeBase:{insertions:0,deletions:0,files:[],baseRef:"base",mergeBaseBranch:"refs/remotes/origin/develop",aheadCount:8,commits:[{sha:"abc1234",shortSha:"abc1234",subject:"Saved work",authoredAt:123}]},
};
function fixture(response:unknown) {
  const signal=new AbortController().signal;
  const calls:any[]=[];
  const sdk={plugins:{callRpc:async(args:any)=>{calls.push(args);return args.outputSchema.parse(response);}}};
  return {sdk,signal,calls};
}

test("Git workspace RPC preserves explicit remote comparisons and HEAD identity without changing the environment base",async()=>{
  const f=fixture({outcome:"available",workspace});
  assert.deepEqual(await readGitWorkspaceStatus(f.sdk,{environmentId:"env",mergeBaseBranch:"refs/remotes/origin/develop",signal:f.signal}),{outcome:"available",workspace});
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].pluginId,"bb--git");assert.equal(f.calls[0].method,"workspaceStatus");
  assert.deepEqual(f.calls[0].input,{environmentId:"env",mergeBaseBranch:"refs/remotes/origin/develop"});
  assert.equal(f.calls[0].signal,f.signal);
});

test("Git files RPC reads uncommitted line counts with whitespace included and preserves truncation",async()=>{
  const response={outcome:"available",files:[{path:"draft.ts",additions:7,deletions:2},{path:"image.png",additions:0,deletions:0}],truncated:true};
  const f=fixture({...response,initialPatches:[],mergeBaseRef:null});
  assert.deepEqual(await readGitFiles(f.sdk,{environmentId:"env",target:"uncommitted",signal:f.signal}),response);
  assert.equal(f.calls[0].pluginId,"bb--git");assert.equal(f.calls[0].method,"files");
  assert.deepEqual(f.calls[0].input,{environmentId:"env",target:{type:"uncommitted"},ignoreWhitespace:false});
  assert.equal(f.calls[0].signal,f.signal);
});

test("Git RPC keeps non-Git and unavailable results distinct from an empty clean workspace",async()=>{
  for(const response of [{outcome:"not_applicable",reason:"non_git_environment"},{outcome:"unavailable",failure:{code:"not_git_repo"}},{outcome:"unavailable",failure:{code:"permission_denied"}}]){
    const f=fixture(response);
    assert.deepEqual(await readGitWorkspaceStatus(f.sdk,{environmentId:"env",signal:f.signal}),response);
    assert.deepEqual(await readGitFiles(f.sdk,{environmentId:"env",target:"uncommitted",signal:f.signal}),response);
  }
});

test("malformed Git data and disabled plugins reject instead of fabricating zero counts",async()=>{
  for(const invalid of [{...workspace,branch:{currentBranch:12,defaultBranch:"main"}},{...workspace,workingTree:{...workspace.workingTree,insertions:"7"}}]){
    const f=fixture({outcome:"available",workspace:invalid});
    await assert.rejects(readGitWorkspaceStatus(f.sdk,{environmentId:"env",signal:f.signal}));
  }
  const f=fixture({outcome:"available",files:[{path:"draft.ts",additions:"7",deletions:0}],truncated:false});
  await assert.rejects(readGitFiles(f.sdk,{environmentId:"env",target:"uncommitted",signal:f.signal}));
  const sdk={plugins:{callRpc:async()=>{throw new Error("plugin_disabled");}}};
  await assert.rejects(readGitWorkspaceStatus(sdk,{environmentId:"env",signal:f.signal}),/plugin_disabled/);
});
