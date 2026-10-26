import test, { beforeEach, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { startComposerInfoRefresh } from "./composer-info-refresh.ts";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
beforeEach(t => t.mock.timers.enable({ apis:["setTimeout"] }));
async function flush(t:TestContext) { t.mock.timers.tick(250); await tick(); }
function deferred<T>() {
  let resolve!:(value:T)=>void;
  let reject!:(reason:Error)=>void;
  const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no; });
  return { promise, resolve, reject };
}
function fixture(reads:Record<string,boolean> = {}, host:{pullRequest?:boolean} = {}) {
  const calls:string[]=[];
  const executionCalls:string[]=[];
  let loadExecution=async()=>({model:"gpt-6.1-sol",reasoningLevel:"high"});
  const handlers=new Map<string,(event:any)=>void>();
  const snapshots:any[]=[];
  const errors:boolean[]=[];
  let parentId:string|null='parent';
  let archived=false;
  let childRows=[child('child')];
  let title='부모';
  let timeline={ goal:{ objective:'목표' } };
  let loadTimeline=async()=>timeline;
  let loadPr:()=>Promise<any>=async()=>({outcome:'absent'});
  let loadParent=async(id:string)=>({id,title,titleFallback:null,providerId:'codex'});
  let loadChildren=async(args:{offset?:number})=>childRows.slice(args.offset??0,(args.offset??0)+100);
  let loadThread=async()=>({ id:'thread', parentThreadId:parentId, environmentId:'env', archivedAt:archived?1:null,
    environment:{hostLifecycle:'ready',status:'ready'}, canRestoreEnvironment:true });
  const sdk={
    threads:{
      defaultExecutionOptions:async(args:{threadId:string})=>{executionCalls.push(args.threadId);return loadExecution();},
      timeline:async()=>{calls.push('timeline');return loadTimeline();},
      get:async(args:{threadId:string})=>{calls.push(`get:${args.threadId}`);return args.threadId==='thread'?loadThread():loadParent(args.threadId);},
      list:async(args:{offset?:number;archived?:boolean})=>{calls.push(`children:${args.offset}`);assert.equal(args.archived,false);return loadChildren(args);},
      queuedMessages:{list:async()=>{calls.push('queue');return [{id:'queued'}];}},
    },
    plugins:host.pullRequest===false ? {} : {callRpc:async(args:any)=>{calls.push('pr');assert.equal(args.pluginId,'bb--github-pr-status');assert.equal(args.method,'pullRequests');assert.deepEqual(args.input,{keys:['env']});return args.outputSchema.parse({env:await loadPr()});}},
    subscribe:(args:{event:string;callback:(event:any)=>void})=>{handlers.set(args.event,args.callback);return()=>{handlers.delete(args.event);};},
  };
  const controller=startComposerInfoRefresh(sdk,'thread',snapshot=>snapshots.push(snapshot),error=>errors.push(error),reads);
  return {...controller,calls,executionCalls,snapshots,errors,handlers,
    setPr:(read:typeof loadPr)=>{loadPr=read;},
    setExecutionRead:(read:typeof loadExecution)=>{loadExecution=read;},
    emit:(id:string|undefined,changes:string[],eventTypes?:string[])=>handlers.get('thread:changed')?.({id,changes,...(eventTypes?{metadata:{eventTypes}}:{})}),
    reconnect:()=>handlers.get('realtime:connection')?.({state:'connected',reconnected:true}),
    setParent:(id:string|null)=>{parentId=id;}, setTitle:(next:string)=>{title=next;},
    setArchived:(next:boolean)=>{archived=next;}, setChildren:(rows:typeof childRows)=>{childRows=rows;},
    setTimeline:(read:typeof loadTimeline)=>{loadTimeline=read;}, setChildRead:(read:typeof loadChildren)=>{loadChildren=read;},
    setThreadRead:(read:typeof loadThread)=>{loadThread=read;}, setParentRead:(read:typeof loadParent)=>{loadParent=read;},
  };
}
function child(id:string, archivedAt:number|null=null) {
  return {id,title:id,providerId:'codex',archivedAt,updatedAt:0,runtime:{displayStatus:'idle'},hasPendingInteraction:false};
}
async function ready() { const f=fixture(); await tick(); f.calls.length=0; return f; }

test('active thread reads PR metadata for the popover title without loading the queue',async()=>{
  const f=fixture();await tick();
  assert.equal(f.calls.includes('pr'),true);
  assert.equal(f.calls.includes('queue'),false);
  assert.equal(f.snapshots.at(-1).pullRequest?.outcome,'absent');
  f.stop();
});

test('a host SDK without the PR read still publishes every other source',async()=>{
  const f=fixture({},{pullRequest:false});await tick();
  assert.deepEqual(f.errors,[false]);
  const snapshot=f.snapshots.at(-1);
  assert.equal(snapshot.pullRequest,null);
  assert.equal(snapshot.timeline.goal.objective,'목표');
  assert.deepEqual(snapshot.children.map((row:{id:string})=>row.id),['child']);
  assert.equal(snapshot.parent?.id,'parent');
  f.stop();
});

test('initial entry, focus refresh and reconnect synchronize all sources',async t=>{
  const f=fixture(); await tick();
  assert.deepEqual(f.calls.sort(),['children:0','get:parent','get:thread','pr','timeline']);
  assert.equal(f.snapshots.length,1);
  f.calls.length=0; f.refresh(); await flush(t);
  assert.deepEqual(f.calls.sort(),['children:0','get:parent','get:thread','pr','timeline']);
  f.calls.length=0; f.reconnect(); await flush(t);
  assert.deepEqual(f.calls.sort(),['children:0','get:parent','get:thread','pr','timeline']);
  f.stop();assert.equal(f.handlers.size,0);
});

test('Goal, Plan and todo events read only the current timeline; token streaming reads nothing',async t=>{
  const f=await ready();
  for(const type of ['thread/goal/updated','thread/goal/cleared','turn/plan/updated','thread/extensionState/updated','turn/completed','item/backgroundTask/progress','item/backgroundTask/completed','item/delegation/progress','item/delegation/completed']){
    f.emit('thread',['events-appended'],[type]); await flush(t);
    assert.deepEqual(f.calls,['timeline'],type); f.calls.length=0;
  }
  f.emit('thread',['events-appended'],['item/agentMessage/delta']);
  f.emit('thread',['read-state-changed','tabs-changed']);
  f.emit('other',['title-changed']); await flush(t);
  assert.deepEqual(f.calls,[]);f.stop();
});

test('child changes query only paginated children, including unknown children being created or unarchived',async t=>{
  const f=await ready();
  for(const [id,change] of [['child','status-changed'],['child','title-changed'],['new','thread-created'],['unknown','archived-changed'],['unknown','parent-changed'],['child','thread-deleted']]){
    f.emit(id,[change]);await flush(t);assert.deepEqual(f.calls,['children:0'],change);f.calls.length=0;
  }
  f.setChildren([...Array.from({length:101},(_,i)=>child(String(i))),child('archived',10)]);
  f.emit('new',['thread-created']);await flush(t);
  assert.deepEqual(f.calls,['children:0','children:100']);
  assert.equal(f.snapshots.at(-1).children.length,101);
  f.emit('100',['status-changed']);f.calls.length=0;await flush(t);
  assert.deepEqual(f.calls,['children:0','children:100']);f.stop();
});

test('parent titles read only that parent and parent relation changes read the current context first',async t=>{
  const f=await ready();f.setTitle('새 제목');
  f.emit('parent',['title-changed']);await flush(t);
  assert.deepEqual(f.calls,['get:parent']);assert.equal(f.snapshots.at(-1).parent.title,'새 제목');
  f.calls.length=0;f.setParent('next');f.emit('thread',['parent-changed']);await flush(t);
  assert.deepEqual(f.calls,['get:thread','pr','get:next']);assert.equal(f.snapshots.at(-1).parent.id,'next');
  f.calls.length=0;f.setParent(null);f.emit('thread',['parent-changed']);await flush(t);
  assert.deepEqual(f.calls,['get:thread','pr']);assert.equal(f.snapshots.at(-1).parent,null);
  f.calls.length=0;f.emit('parent',['title-changed']);await flush(t);assert.deepEqual(f.calls,[]);f.stop();
});

test('archive and environment changes update context; readonly queues and PR remain available',async t=>{
  const f=await ready();f.setArchived(true);f.emit('thread',['archived-changed']);await flush(t);
  assert.deepEqual(f.calls.sort(),['get:thread','pr','queue']);
  assert.equal(f.snapshots.at(-1).readOnly.label,'Archived thread');
  f.calls.length=0;f.setArchived(false);f.emit('thread',['environment-changed']);await flush(t);
  assert.deepEqual(f.calls,['get:thread','pr']);assert.equal(f.snapshots.at(-1).queue.length,0);
  assert.equal(f.snapshots.at(-1).readOnly.label,null);f.stop();
});

test('missing event metadata stays conservative while bursts merge only their required reads',async t=>{
  const f=await ready();f.emit('thread',['events-appended']);f.emit('child',['title-changed']);
  f.emit('parent',['title-changed']);await flush(t);
  assert.deepEqual(f.calls.sort(),['children:0','get:parent','get:thread','pr','timeline']);
  f.calls.length=0;f.emit(undefined,['archived-changed']);await flush(t);
  assert.deepEqual(f.calls.sort(),['children:0','get:parent','get:thread','pr','timeline']);f.stop();
});

test('an invalidated in-flight batch is retried with the union and never publishes stale state',async t=>{
  const f=await ready();const gate=deferred<{goal:{objective:string}}>();
  f.setTimeline(()=>gate.promise);f.emit('thread',['events-appended'],['thread/goal/updated']);await flush(t);
  const before=f.snapshots.length;
  f.setParent('next');f.emit('thread',['parent-changed']);await flush(t);
  f.setTimeline(async()=>({goal:{objective:'최신'}}));gate.resolve({goal:{objective:'이전'}});await tick();
  assert.equal(f.snapshots.length,before,'in-flight result invalidated by context change');
  await flush(t);
  assert.deepEqual(f.calls.sort(),['get:next','get:thread','pr','timeline','timeline']);
  assert.equal(f.snapshots.at(-1).timeline.goal.objective,'최신');
  assert.equal(f.snapshots.at(-1).parent.id,'next');f.stop();
});

test('failure preserves the previous snapshot and retries the failed sources on the next event',async t=>{
  const f=await ready();const before=f.snapshots.at(-1);
  f.setTimeline(async()=>{throw new Error('disconnect');});
  f.emit('thread',['events-appended'],['thread/goal/updated']);await flush(t);
  assert.equal(f.snapshots.at(-1),before);assert.equal(f.errors.at(-1),true);
  f.calls.length=0;f.setTimeline(async()=>({goal:{objective:'복구'}}));f.emit('child',['status-changed']);await flush(t);
  assert.deepEqual(f.calls.sort(),['children:0','timeline']);assert.equal(f.errors.at(-1),false);
  assert.equal(f.snapshots.at(-1).timeline.goal.objective,'복구');f.stop();
});

test('stop aborts pending reads and cancels debounced work without publishing',async t=>{
  const f=await ready();const gate=deferred<ReturnType<typeof child>[]>();
  f.setChildRead(()=>gate.promise);f.emit('child',['status-changed']);await flush(t);
  const before=f.snapshots.length;f.emit('thread',['events-appended']);f.stop();
  gate.resolve([child('stale')]);await tick();await flush(t);
  assert.equal(f.snapshots.length,before);assert.deepEqual(f.calls,['children:0']);
  assert.equal(f.handlers.size,0);
});


test('a failed in-flight source is not forgotten when another source is already queued',async t=>{
  const f=await ready();const gate=deferred<{goal:{objective:string}}>();
  f.setTimeline(()=>gate.promise);f.emit('thread',['events-appended'],['thread/goal/updated']);await flush(t);
  f.emit('child',['status-changed']);await flush(t);
  f.setTimeline(async()=>({goal:{objective:'실패 후 복구'}}));gate.reject(new Error('disconnect'));await tick();
  await flush(t);
  assert.equal(f.snapshots.at(-1).timeline.goal.objective,'실패 후 복구');
  assert.deepEqual(f.calls.sort(),['children:0','timeline','timeline']);f.stop();
});

test('parent changes during the first parent read invalidate it before the initial publication',async t=>{
  const f=fixture();const gate=deferred<{id:string;title:string;titleFallback:null;providerId:string}>();
  f.setParentRead(()=>gate.promise);await tick();
  f.emit('parent',['title-changed']);await flush(t);
  f.setParentRead(async id=>({id,title:'새 부모 제목',titleFallback:null,providerId:'codex'}));
  gate.resolve({id:'parent',title:'과거',titleFallback:null,providerId:'codex'});await tick();
  assert.equal(f.snapshots.length,0,'initial in-flight parent title is already stale');
  await flush(t);assert.equal(f.snapshots.at(-1).parent.title,'새 부모 제목');f.stop();
});

test('a timeline-only refresh retains all unrelated source objects',async t=>{
  const f=await ready();const before=f.snapshots.at(-1);
  f.setTimeline(async()=>({goal:{objective:'갱신'}}));
  f.emit('thread',['events-appended'],['thread/goal/updated']);await flush(t);
  const after=f.snapshots.at(-1);
  assert.equal(after.children,before.children);assert.equal(after.parent,before.parent);
  assert.equal(after.readOnly,before.readOnly);assert.equal(after.queue,before.queue);
  assert.notEqual(after.timeline,before.timeline);f.stop();
});


test('disabled information skips its dedicated sources at entry, on events, focus and reconnect',async t=>{
  const f=fixture({timeline:false,children:false,parent:false,queue:false,pullRequest:false});await tick();
  assert.deepEqual(f.calls,['get:thread'],'read-only restoration status remains mandatory');
  assert.equal(f.snapshots.at(-1).timeline,null);assert.deepEqual(f.snapshots.at(-1).children,[]);
  assert.equal(f.snapshots.at(-1).parent,null);
  f.calls.length=0;
  f.emit('thread',['events-appended'],['thread/goal/updated']);f.emit('new',['thread-created']);
  f.emit('parent',['title-changed']);await flush(t);assert.deepEqual(f.calls,[]);
  f.refresh();await flush(t);assert.deepEqual(f.calls,['get:thread']);
  f.calls.length=0;f.reconnect();await flush(t);assert.deepEqual(f.calls,['get:thread']);
  f.calls.length=0;f.setArchived(true);f.emit('thread',['archived-changed']);await flush(t);
  assert.deepEqual(f.calls,['get:thread']);assert.equal(f.snapshots.at(-1).readOnly.label,'Archived thread');
  assert.deepEqual(f.snapshots.at(-1).queue,[]);assert.equal(f.snapshots.at(-1).pullRequest,null);f.stop();
});

test('switching off children or parent leaves other sources active; readonly queue and PR are separate',async t=>{
  for(const disabled of ['children','parent']){
    const f=fixture({[disabled]:false});await tick();
    assert.equal(f.calls.includes(disabled==='children'?'children:0':'get:parent'),false);
    assert.equal(f.calls.includes('timeline'),true);f.stop();
  }
  for(const disabled of ['queue','pullRequest']){
    const f=fixture({[disabled]:false});await tick();f.calls.length=0;
    f.setArchived(true);f.emit('thread',['archived-changed']);await flush(t);
    assert.equal(f.calls.includes('queue'),disabled!=='queue');
    assert.equal(f.calls.includes('pr'),disabled!=='pullRequest');f.stop();
  }
});

test('stopping an in-flight readonly context prevents follow-up queue and PR queries',async t=>{
  const f=await ready();const gate=deferred<any>();f.setThreadRead(()=>gate.promise);
  f.setArchived(true);f.emit('thread',['archived-changed']);await flush(t);
  const before=f.snapshots.length;f.stop();
  gate.resolve({id:'thread',parentThreadId:'parent',environmentId:'env',archivedAt:1,environment:null,canRestoreEnvironment:false});
  await tick();assert.deepEqual(f.calls,['get:thread']);assert.equal(f.snapshots.length,before);
});


test('child execution metadata is cached until that child changes',async t=>{
  const f=await ready();
  assert.deepEqual(f.snapshots.at(-1).children[0].executionOptions,{model:'gpt-6.1-sol',reasoningLevel:'high'});
  assert.deepEqual(f.executionCalls,['child']);
  f.refresh();await flush(t);
  assert.deepEqual(f.executionCalls,['child']);
  f.setExecutionRead(async()=>({model:'gpt-6-astra',reasoningLevel:'medium'}));
  f.setChildren([{...child('child'),updatedAt:1},child('new'),child('archived',10)]);
  f.emit('new',['thread-created']);await flush(t);
  assert.deepEqual(f.executionCalls,['child','child','new']);
  assert.equal(f.snapshots.at(-1).children[0].executionOptions.model,'gpt-6-astra');
  f.stop();
});

test('child execution lookup failure keeps known metadata and retries on refresh',async t=>{
  const f=await ready();
  f.setChildren([{...child('child'),updatedAt:1}]);
  f.setExecutionRead(async()=>{throw new Error('offline');});
  f.emit('child',['status-changed']);await flush(t);
  assert.equal(f.snapshots.at(-1).children[0].executionOptions.model,'gpt-6.1-sol');
  f.setExecutionRead(async()=>({model:'gpt-6-astra',reasoningLevel:'medium'}));
  f.refresh();await flush(t);
  assert.equal(f.snapshots.at(-1).children[0].executionOptions.model,'gpt-6-astra');
  f.stop();
});

test('reading a known child refreshes its read state without loading the parent timeline',async t=>{
  const f=await ready();
  f.setChildren([{...child('child'),lastReadAt:100,latestAttentionAt:100}]);
  f.emit('child',['read-state-changed']);await flush(t);
  assert.deepEqual(f.calls,['children:0']);
  assert.equal(f.snapshots.at(-1).children[0].lastReadAt,100);
  f.stop();
});


test('available RPC metadata preserves the PR title, number, state and URL',async t=>{
  const f=await ready();
  const pullRequest={number:42,title:'PR 정보 복구',state:'draft',url:'https://github.com/example/repo/pull/42',baseRefName:'develop',headRefName:'feature/chat'};
  f.setPr(async()=>({outcome:'available',pullRequest}));
  f.refresh();await flush(t);
  assert.deepEqual(f.snapshots.at(-1).pullRequest,{outcome:'available',pullRequest});
  assert.equal(f.errors.at(-1),false);f.stop();
});

test('rejected, unavailable and malformed PR RPC reads leave all other composer data available',async t=>{
  const f=await ready();
  for(const read of [
    async()=>{throw new Error('plugin_disabled');},
    async()=>({outcome:'unavailable',message:'offline'}),
    async()=>({outcome:'available',pullRequest:{title:'invalid'}}),
  ]){
    f.setPr(read);f.refresh();await flush(t);
    const snapshot=f.snapshots.at(-1);
    assert.notEqual(snapshot.pullRequest?.outcome,'available');
    assert.equal(snapshot.children[0].id,'child');
    assert.equal(snapshot.timeline.goal.objective,'목표');
    assert.equal(snapshot.parent.id,'parent');assert.equal(f.errors.at(-1),false);
  }
  f.stop();
});
