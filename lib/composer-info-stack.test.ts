import test from 'node:test';
import assert from 'node:assert/strict';
import { infoStack } from './composer-info-stack.ts';

test('inactive information becomes at most three icons and one exact overflow circle',()=>{
 const result=infoStack(['diff','children','plan','goal','todos'],new Set(),new Set(),true);
 assert.deepEqual(result.icons,['diff','children','plan']);assert.equal(result.more,2);assert.equal(result.moreActive,false);assert.equal(result.width,86);
});
test('folded active information precedes empty icons and lights the overflow dot only when necessary',()=>{
 const keys=['diff','children','plan','goal','todos','queue'];
 const active=new Set(['children','plan','goal','todos']);
 const result=infoStack(keys,active,new Set(),true);
 assert.deepEqual(result.icons,['children','plan','goal']);assert.equal(result.more,3);assert.equal(result.moreActive,true);
 const shown=infoStack(keys,active,new Set(['todos']),true);assert.equal(shown.moreActive,false);
 assert.deepEqual(shown.icons,['children','plan','goal']);assert.equal(shown.more,2);
});
test('visible pills and disabled families never duplicate into the icon stack',()=>{
 assert.deepEqual(infoStack(['goal','plan'],new Set(['goal']),new Set(['goal']),true),{icons:['plan'],more:0,moreActive:false,width:32});
 assert.deepEqual(infoStack(['goal'],new Set(['goal']),new Set(['goal']),true),{icons:[],more:0,moreActive:false,width:0});
});

test('default stack counts only folded active information, including its overflow dot',()=>{
 const keys=['diff','children','plan','goal','todos','queue'] as const;
 assert.deepEqual(infoStack(keys,new Set(),new Set()),{icons:[],more:0,moreActive:false,width:0});
 assert.deepEqual(infoStack(keys,new Set(['goal']),new Set(['goal'])),{icons:[],more:0,moreActive:false,width:0});
 assert.deepEqual(infoStack(keys,new Set(['children','plan','goal','todos']),new Set()),{icons:['children','plan','goal'],more:1,moreActive:true,width:86});
 assert.deepEqual(infoStack(keys,new Set(['children','plan','goal','todos']),new Set(['todos'])),{icons:['children','plan','goal'],more:0,moreActive:false,width:68});
});
