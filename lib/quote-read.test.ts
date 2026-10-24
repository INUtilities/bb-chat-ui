import test from 'node:test';import assert from 'node:assert/strict';import plugin from '../server.ts';import{quoteRpcContract}from'./quote-contract.ts';

test('read quote validates an opaque id and preserves the entire stored source without writes',async()=>{
 const method=(quoteRpcContract as unknown as Record<string,{input:{'~standard':{validate(v:unknown):unknown}}}>).readQuote;assert.ok(method,'readQuote RPC must exist');
 const invalid=await method.input['~standard'].validate({id:'../one'})as {issues?:unknown};assert.ok(invalid.issues);
 let handlers:Record<string,(input:{id:string})=>Promise<unknown>>={},writes=0;const source='\nfull text\n```ts\n  code\n```\n';
 plugin({settings:{define(){}},rpc:{register(_contract:unknown,value:typeof handlers){handlers=value;}},storage:{kv:{get:async(id:string)=>id==='quote:one'?source:null,set:async()=>{writes++;}}},ui:{registerMentionProvider(){}}}as unknown as Parameters<typeof plugin>[0]);
 assert.deepEqual(await handlers.readQuote({id:'one'}),{text:source});assert.deepEqual(await handlers.readQuote({id:'missing'}),{text:null});assert.equal(writes,0);
});
