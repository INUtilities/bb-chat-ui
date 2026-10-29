import test, { beforeEach, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { startWorkspaceDiffRefresh } from "./workspace-diff-refresh.ts";
import type { readWorkspaceDiff } from "./workspace-diff-data.ts";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
beforeEach(t => t.mock.timers.enable({ apis:["Date", "setTimeout"], now:0 }));
async function initialResult(t:TestContext) {
  await tick(); t.mock.timers.tick(500); await tick();
}
function deferred<T>() {
  let resolve!:(value:T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
type DiffSnapshot = NonNullable<Awaited<ReturnType<typeof readWorkspaceDiff>>>;
type PrResponse = Awaited<ReturnType<Parameters<typeof readWorkspaceDiff>[0]['pullRequest']>>;
type StatusResponse = Awaited<ReturnType<Parameters<typeof readWorkspaceDiff>[0]["status"]>>;
function fixture(initialStatus?:() => Promise<StatusResponse>, initialEnvironmentId='env_main') {
  let environmentId:string | null = initialEnvironmentId;
  let count = 3;
  let reads = 0;
  let prReads = 0;
  let statusReads = 0;
  let fileReads = 0;
  let fileLines = 0;
  let loadPr:()=>Promise<PrResponse> = async()=>({outcome:"absent"});
  const handlers = new Map<string,(event:{ id:string; changes:string[] }) => void>();
  const output:(DiffSnapshot | null)[] = [];
  let loadThread = async () => { reads++; return { environmentId }; };
  let loadStatus:(args:{ environmentId:string; mergeBaseBranch?:string }) => Promise<StatusResponse> = initialStatus ?? (async (args:{ environmentId:string; mergeBaseBranch?:string }) => ({ outcome:'available', workspace:{
    branch:{ currentBranch:args.environmentId === 'env_main' ? 'main' : 'feature/chat', defaultBranch:'main' },
    checkout:{ headSha:'head' }, workingTree:{ insertions:0, deletions:0, files:[] },
    mergeBase:{ insertions:0, deletions:0, files:[], commits:[], baseRef:'base', aheadCount:count, mergeBaseBranch:args.mergeBaseBranch ?? 'main' },
  } }));
  const sdk = {
    threads:{ get:() => loadThread() },
    environments:{ get:async () => ({ mergeBaseBranch:'main' }) },
    plugins:{callRpc:async(args:any)=>{
      if(args.pluginId==='bb--git'){
        if(args.method==='workspaceStatus'){
          statusReads++;return args.outputSchema.parse(await loadStatus(args.input));
        }
        assert.equal(args.method,'files');
        assert.deepEqual(args.input,{environmentId,target:{type:'uncommitted'},ignoreWhitespace:false});
        fileReads++;return args.outputSchema.parse({outcome:'available',files:fileLines?[{path:'draft.ts',additions:fileLines,deletions:0}]:[],truncated:false});
      }
      prReads++;assert.equal(args.pluginId,'bb--github-pr-status');assert.equal(args.method,'pullRequests');return {[args.input.keys[0]]:await loadPr()};
    }},
    subscribe:(args:{ event:string; callback:(event:{ id:string; changes:string[] }) => void }) => { handlers.set(args.event,args.callback); return () => { handlers.delete(args.event); }; },
  };
  const running = startWorkspaceDiffRefresh(sdk, 'thread', summary => output.push(summary));
  return { ...running, output, get reads() { return reads; }, get prReads(){return prReads;}, get gitReads(){return statusReads+fileReads;}, sdk,
    setPr:(read:typeof loadPr)=>{loadPr=read;}, setFileLines:(next:number)=>{fileLines=next;},
    emit:(event:string,id:string,changes:string[]) => handlers.get(event)?.({ id, changes }),
    setEnvironment:(id:string | null) => { environmentId = id; }, setCount:(next:number) => { count = next; },
    setStatus:(read:typeof loadStatus) => { loadStatus = read; }, setThread:(read:typeof loadThread) => { loadThread = read; },
    labels:() => output.map(s => s ? s.presentation.label : '<empty>'),
  };
}

test('Git RPC-only hosts publish a stable main Diff without refetching on message streaming', async t => {
  const f = fixture(); await initialResult(t);
  assert.deepEqual(f.labels(), ['↑3']);
  assert.equal(typeof f.output[0], 'object', 'the renderer receives an SDK snapshot, not a JSON string');
  for (let i=0;i<5;i++) f.emit('thread:changed','thread',['events-appended']);
  await tick();
  assert.deepEqual(f.labels(), ['↑3']);
  assert.equal(f.reads,1);
  f.stop();
});

test('environment refresh retains the previous display until a complete result arrives', async t => {
  const f = fixture(); await initialResult(t);
  const gate = deferred<StatusResponse>();
  f.setStatus(() => gate.promise);
  f.emit('environment:changed','env_main',['workspace-changed']); await tick();
  assert.deepEqual(f.labels(), ['↑3']);
  const reads = f.reads;
  f.emit('environment:changed','env_unrelated',['workspace-changed']);
  const response = { outcome:'available', workspace:{ branch:{ currentBranch:'main', defaultBranch:'main' }, checkout:{ headSha:'head' }, workingTree:{ insertions:0,deletions:0,files:[] }, mergeBase:{ insertions:0,deletions:0,files:[],commits:[],baseRef:'base',aheadCount:4,mergeBaseBranch:'refs/remotes/origin/main' } } };
  f.setStatus(async () => response); gate.resolve(response);
  await tick();
  assert.deepEqual(f.labels(), ['↑3','↑4']);
  assert.equal(f.reads,reads,'unrelated environments do not invalidate an in-flight refresh');
  f.stop();
});

test('temporary status failure retains the last good display and detachment clears it only after confirmation', async t => {
  const f = fixture(); await initialResult(t);
  f.setStatus(async () => { throw new Error('temporarily disconnected'); });
  await f.refresh();
  assert.deepEqual(f.labels(), ['↑3']);
  const gate = deferred<{ environmentId:string | null }>();
  f.setThread(() => gate.promise);
  f.emit('thread:changed','thread',['environment-changed']); await tick();
  assert.deepEqual(f.labels(), ['↑3']);
  gate.resolve({ environmentId:null }); await tick();
  assert.deepEqual(f.labels(), ['↑3','<empty>']);
  f.stop();
});

test('in-flight results are discarded when the thread changes environments', async t => {
  const f = fixture(); await initialResult(t);
  const gate = deferred<StatusResponse>();
  let first = true;
  const workspace = (id:string) => ({ outcome:'available',workspace:{ branch:{ currentBranch:id === 'env_main' ? 'main' : 'feature/chat',defaultBranch:'main' }, checkout:{ headSha:'head' },workingTree:{ insertions:0,deletions:0,files:[] },mergeBase:{ insertions:0,deletions:0,files:[],commits:[],baseRef:'base',aheadCount:8,mergeBaseBranch:'refs/remotes/origin/main' } } });
  f.setStatus(async args => { if (first) { first=false; return gate.promise; } const w=workspace(args.environmentId); w.workspace.mergeBase.mergeBaseBranch=args.mergeBaseBranch ?? 'main'; return w; });
  const refresh = f.refresh(); await tick();
  f.setEnvironment('env_feature'); f.emit('thread:changed','thread',['environment-changed']);
  gate.resolve(workspace('env_main')); await refresh; await tick();
  assert.deepEqual(f.labels(), ['↑3','feature/c… · 8 commits']);
  f.stop();
  const before=f.output.length; f.emit('environment:changed','env_feature',['workspace-changed']); await f.refresh();
  assert.equal(f.output.length,before,'disposed controllers cannot publish');
});

test('confirmed non-Git environments finish initial loading and clear a previous Git snapshot', async t => {
  for (const response of [
    { outcome:'not_applicable', reason:'non_git_environment' },
    { outcome:'unavailable', failure:{ code:'not_git_repo' } },
  ] satisfies StatusResponse[]) {
    const f = fixture(async () => response); await initialResult(t);
    assert.deepEqual(f.labels(), ['<empty>']);
    f.stop();
    const previous = fixture(); await initialResult(t);
    previous.setStatus(async () => response);
    await previous.refresh();
    assert.deepEqual(previous.labels(), ['↑3','<empty>']);
    previous.stop();
  }
});

test('an initial status error ends loading and the next refresh can recover', async t => {
  const f = fixture(async () => { throw new Error('disconnected'); }); await initialResult(t);
  assert.deepEqual(f.labels(), ['<empty>']);
  f.setStatus(async args => ({ outcome:'available', workspace:{
    branch:{ currentBranch:'main', defaultBranch:'main' }, checkout:{ headSha:'head' },
    workingTree:{ insertions:0,deletions:0,files:[] },
    mergeBase:{ insertions:0,deletions:0,files:[],commits:[],baseRef:'base',aheadCount:2,mergeBaseBranch:args.mergeBaseBranch ?? 'main' },
  } }));
  await f.refresh();
  assert.deepEqual(f.labels(), ['<empty>','↑2']);
  f.stop();
});

test('an unavailable initial workspace also finishes loading without fabricating Git information', async t => {
  const f = fixture(async () => ({ outcome:'unavailable', failure:{ code:'permission_denied' } }));
  await initialResult(t);
  assert.deepEqual(f.labels(), ['<empty>']);
  f.stop();
});

test('first fast results remain loading for 500ms, including empty outcomes, without delaying later refreshes', async t => {
  for (const empty of [true,false]) {
    const f = empty ? fixture(async () => ({ outcome:'not_applicable',reason:'non_git_environment' })) : fixture();
    await tick(); assert.deepEqual(f.output,[]);
    t.mock.timers.tick(499); await tick(); assert.deepEqual(f.output,[]);
    t.mock.timers.tick(1); await tick(); assert.deepEqual(f.labels(),[empty ? '<empty>' : '↑3']);
    await f.refresh(); assert.equal(f.output.length,2,'only the initial result waits'); f.stop();
  }
});

test('stopping or switching environments during the first loading hold cannot publish a stale result', async t => {
  const stopped=fixture(); await tick(); stopped.stop();
  t.mock.timers.tick(500); await tick(); assert.deepEqual(stopped.output,[]);
  const switched=fixture(); await tick(); switched.setEnvironment(null);
  switched.emit('thread:changed','thread',['environment-changed']);
  t.mock.timers.tick(500); await tick(); assert.deepEqual(switched.labels(),['<empty>']); switched.stop();
});

test('a first result taking longer than 500ms does not get an extra loading hold', async t => {
  const gate=deferred<StatusResponse>(); const f=fixture(()=>gate.promise); await tick();
  t.mock.timers.tick(700); gate.resolve({ outcome:'not_applicable',reason:'non_git_environment' });
  await tick(); assert.deepEqual(f.labels(),['<empty>']); f.stop();
});


test('PR data is read every 30 seconds while all HEAD and remote-commit data stays on each 5-second tick',async t=>{
  const f=fixture();await initialResult(t);assert.equal(f.prReads,1);
  const initialGit=f.gitReads;
  for(let i=1;i<=12;i++){
    f.setCount(i+3);f.setFileLines(i);
    t.mock.timers.tick(i===1?4500:5000);await f.refresh();
    assert.equal(f.output.at(-1)?.detail.commitCount,i+3);assert.equal(f.output.at(-1)?.insertions,i);
    assert.equal(f.prReads,1+Math.floor(i/6),`PR lookup at second ${i*5}`);
    assert.equal(f.gitReads-initialGit,i*3,'main still reads status, files and remote ahead count');
  }
  assert.equal(f.gitReads-initialGit+f.prReads-1,38,'60 seconds of steady polling excludes the initial read');f.stop();
});

test('forced focus refresh and environment changes bypass a fresh PR cache',async t=>{
  const f=fixture();await initialResult(t);await f.refresh();assert.equal(f.prReads,1);
  await f.refresh(true);assert.equal(f.prReads,2);
  f.emit('environment:changed','env_main',['workspace-changed']);await tick();assert.equal(f.prReads,3);
  f.setEnvironment('env_feature');f.emit('thread:changed','thread',['environment-changed']);await tick();assert.equal(f.prReads,4);
  assert.equal(f.output.at(-1)?.detail.branch,'feature/chat');f.stop();
});

test('expired PR errors preserve the last known PR base and retry on the next tick',async t=>{
  const f=fixture();await initialResult(t);
  f.setEnvironment('env_feature');
  f.setPr(async()=>({outcome:'available',pullRequest:{state:'open',baseRefName:'develop',headRefName:'feature/chat'}}));
  f.emit('thread:changed','thread',['environment-changed']);await tick();
  assert.equal(f.output.at(-1)?.detail.baseRef,'origin/develop');
  const before=f.prReads;
  t.mock.timers.tick(30000);f.setPr(async()=>{throw new Error('PR disconnected');});await f.refresh();
  assert.equal(f.prReads,before+1);assert.equal(f.output.at(-1)?.detail.baseRef,'origin/develop');
  f.setPr(async()=>({outcome:'unavailable'}));await f.refresh();
  assert.equal(f.prReads,before+2);assert.equal(f.output.at(-1)?.detail.baseRef,'origin/develop');
  f.setPr(async()=>({outcome:'absent'}));await f.refresh();
  assert.equal(f.prReads,before+3);assert.equal(f.output.at(-1)?.detail.baseRef,'origin/main');
  await f.refresh();assert.equal(f.prReads,before+3,'a confirmed absence is cached');f.stop();
});

test('a late PR result from an old environment cannot populate the new environment cache',async t=>{
  const f=fixture();await initialResult(t);const gate=deferred<PrResponse>();
  f.setPr(()=>gate.promise);const pending=f.refresh(true);await tick();
  f.setEnvironment('env_feature');f.emit('thread:changed','thread',['environment-changed']);
  f.setPr(async()=>({outcome:'available',pullRequest:{state:'open',baseRefName:'release',headRefName:'feature/chat'}}));
  gate.resolve({outcome:'available',pullRequest:{state:'open',baseRefName:'wrong',headRefName:'feature/chat'}});
  await pending;await tick();assert.equal(f.output.at(-1)?.detail.baseRef,'origin/release');
  const count=f.prReads;await f.refresh();assert.equal(f.prReads,count);assert.equal(f.output.at(-1)?.detail.baseRef,'origin/release');f.stop();
});

test('focus during an in-flight PR read requires a fresh result before publishing',async t=>{
  const f=fixture();await initialResult(t);const gate=deferred<PrResponse>();
  t.mock.timers.tick(30000);f.setPr(()=>gate.promise);const pending=f.refresh();await tick();
  const before=f.output.length;void f.refresh(true);
  f.setPr(async()=>({outcome:'absent'}));gate.resolve({outcome:'absent'});await pending;await tick();
  assert.equal(f.output.length,before+1,'the old generation never publishes');
  assert.equal(f.prReads,3,'initial, expired and forced PR reads');f.stop();
});


test('a changed PR target is used after expiry without slowing feature-branch commit comparisons',async t=>{
  const f=fixture();await initialResult(t);f.setEnvironment('env_feature');
  f.setPr(async()=>({outcome:'available',pullRequest:{state:'open',baseRefName:'develop',headRefName:'feature/chat'}}));
  f.emit('thread:changed','thread',['environment-changed']);await tick();
  const before=f.prReads;const git=f.gitReads;
  f.setPr(async()=>({outcome:'available',pullRequest:{state:'open',baseRefName:'release',headRefName:'feature/chat'}}));
  t.mock.timers.tick(29999-Date.now());await f.refresh();assert.equal(f.prReads,before);
  assert.equal(f.output.at(-1)?.detail.baseRef,'origin/develop');
  t.mock.timers.tick(1);await f.refresh();assert.equal(f.prReads,before+1);
  assert.equal(f.output.at(-1)?.detail.baseRef,'origin/release');
  assert.equal(f.gitReads-git,8,'both remote comparisons, HEAD and files are read in each feature refresh');f.stop();
});

test('a forced same-environment PR failure retains its base; a different environment never inherits it',async t=>{
  const f=fixture();await initialResult(t);f.setEnvironment('env_feature');
  f.setPr(async()=>({outcome:'available',pullRequest:{state:'open',baseRefName:'develop',headRefName:'feature/chat'}}));
  f.emit('thread:changed','thread',['environment-changed']);await tick();
  f.setPr(async()=>({outcome:'unavailable'}));
  f.emit('environment:changed','env_feature',['workspace-changed']);await tick();
  assert.equal(f.output.at(-1)?.detail.baseRef,'origin/develop','same environment retains its last confirmed PR during failure');
  f.setEnvironment('env_other');f.emit('thread:changed','thread',['environment-changed']);await tick();
  assert.equal(f.output.at(-1)?.detail.baseRef,'origin/main','another environment cannot reuse the old base');f.stop();
});

test('initial metadata latency does not push the 30-second PR refresh into the next poll',async t=>{
  const f=fixture();f.sdk.environments.get=async()=>{t.mock.timers.tick(20);return {mergeBaseBranch:'main'};};
  await initialResult(t);assert.equal(f.prReads,1);
  t.mock.timers.tick(30000-Date.now());await f.refresh();
  assert.equal(f.prReads,2,'the 30-second deadline starts with the refresh, before context lookup latency');f.stop();
});

test('a forced focus refresh between polls does not postpone the next 30-second PR boundary',async t=>{
  const f=fixture();await initialResult(t);t.mock.timers.tick(500);await f.refresh(true);assert.equal(f.prReads,2);
  t.mock.timers.tick(30000-Date.now());await f.refresh();
  assert.equal(f.prReads,3,'focus must not postpone the boundary to the 35-second worktree tick');f.stop();
});


test('an initially disabled or failed PR RPC still publishes the workspace with its default base',async t=>{
  for(const read of [async()=>{throw new Error('plugin_disabled');},async()=>({outcome:'unavailable',message:'offline'})]){
    const f=fixture(undefined,'env_feature');f.setPr(read);
    await initialResult(t);
    assert.equal(f.prReads,1);
    assert.equal(f.output.at(-1)?.detail.baseRef,'origin/main');
    assert.equal(f.output.at(-1)?.detail.branch,'feature/chat');f.stop();
  }
});
