import test, {beforeEach, type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {watchWorkspaceDiff} from './workspace-diff-watch.ts';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
beforeEach(t=>t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0}));
async function settle(t:TestContext){await tick();t.mock.timers.tick(500);await tick();}
function fixture(){
  const calls:string[]=[];const output:unknown[]=[];
  const handlers=new Map<string,Function>();const events=new Map<string,Function>();const timers=new Set<ReturnType<typeof setInterval>>();
  const signals:AbortSignal[]=[];
  const sdk={
    threads:{get:async({signal}:{signal:AbortSignal})=>{calls.push('thread');signals.push(signal);return {environmentId:'env'};}},
    environments:{
      get:async()=>{calls.push('environment');return {mergeBaseBranch:'main'};},
    },
    plugins:{callRpc:async(args:any)=>{
      if(args.pluginId==='bb--git'){
        calls.push(args.method==='workspaceStatus'?'status':'files');
        return args.outputSchema.parse({outcome:'not_applicable',reason:'non_git_environment'});
      }
      calls.push('pr');return {env:{outcome:'absent'}};
    }},
    subscribe:({event,callback}:{event:string;callback:Function})=>{handlers.set(event,callback);return()=>{handlers.delete(event);};},
  };
  const view={document:{visibilityState:'visible'},
    addEventListener:(name:string,listener:Function)=>events.set(name,listener),
    removeEventListener:(name:string)=>events.delete(name),
    setInterval:(handler:()=>void,ms:number)=>{const timer=setInterval(handler,ms);timers.add(timer);return timer;},
    clearInterval:(timer:ReturnType<typeof setInterval>)=>{clearInterval(timer);timers.delete(timer);},
  };
  return {calls,output,handlers,events,timers,signals,view,
    start:(enabled:boolean)=>watchWorkspaceDiff(sdk,'thread',summary=>output.push(summary),view,enabled),
  };
}

test('off creates no Diff reads, subscriptions, timer or focus handler',async t=>{
  const f=fixture();const stop=f.start(false);await settle(t);
  t.mock.timers.tick(20000);f.events.get('focus')?.();await tick();
  assert.deepEqual(f.calls,[]);assert.equal(f.handlers.size,0);assert.equal(f.events.size,0);assert.equal(f.timers.size,0);
  assert.deepEqual(f.output,[null],'disabled clears loading without a fabricated Git result');stop();
});

test('enabled Diff keeps visible 5-second refresh and focus refresh; dispose removes everything',async t=>{
  const f=fixture();const stop=f.start(true);await settle(t);
  assert.equal(f.calls.filter(call=>call==='status').length,1);assert.equal(f.timers.size,1);assert.equal(f.events.size,1);
  f.view.document.visibilityState='hidden';t.mock.timers.tick(4500);await tick();
  assert.equal(f.calls.filter(call=>call==='status').length,1);
  f.view.document.visibilityState='visible';t.mock.timers.tick(5000);await tick();
  assert.equal(f.calls.filter(call=>call==='status').length,2);
  f.events.get('focus')?.();await tick();assert.equal(f.calls.filter(call=>call==='status').length,3);
  assert.equal(f.calls.filter(call=>call==='pr').length,2,'focus bypasses the PR cache while polling reuses it');
  stop();assert.equal(f.handlers.size,0);assert.equal(f.events.size,0);assert.equal(f.timers.size,0);
  assert.equal(f.signals[0].aborted,true);const count=f.calls.length;
  t.mock.timers.tick(10000);await tick();assert.equal(f.calls.length,count);
});

test('switching off during the initial hold suppresses stale data; enabling starts a fresh read',async t=>{
  const f=fixture();const stop=f.start(true);await tick();stop();
  const off=f.start(false);await settle(t);assert.deepEqual(f.output,[null]);
  off();const count=f.calls.length;const again=f.start(true);await settle(t);
  assert.ok(f.calls.length>count);assert.equal(f.calls.filter(call=>call==='thread').length,2);
  assert.deepEqual(f.output,[null,null]);again();
});
