import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../dist/app.js';
const context={userId:'11111111-1111-4111-8111-111111111111',supabase:{from(){throw Error('Unexpected database access');}}};
async function app(t, options={}) { const a=await buildApp(options);t.after(()=>a.close());return a; }
test('liveness works without secrets and readiness fails closed',async t=>{
 const a=await app(t,{ready:async()=>false});
 assert.equal((await a.inject('/health/live')).statusCode,200);
 assert.equal((await a.inject('/health/ready')).statusCode,503);
});
test('protected routes reject missing and invalid authentication before DB access',async t=>{
 const a=await app(t,{authenticate:async()=>null});
 for(const url of ['/v1/data/providers','/v1/agent/profiles','/v1/operations/adminOverview','/v1/chat']) {
  const r=await a.inject({url,method:url.endsWith('chat')?'POST':'GET',payload:url.endsWith('chat')?{}:undefined});
  assert.equal(r.statusCode,401);assert.equal(r.json().error,'UNAUTHORIZED');
 }
});
test('unknown tables and unsafe filters are rejected',async t=>{
 const a=await app(t,{authenticate:async()=>context});
 for(const url of ['/v1/data/provider_secrets','/v1/data/providers?select=*','/v1/data/projects?projectId=bad','/v1/data/models?limit=5000'])assert.equal((await a.inject(url)).statusCode,400);
});
test('operation validators preserved across transport',async t=>{
 const a=await app(t,{authenticate:async()=>context});
 for(const name of ['createProvider','createProject','searchProject','connectGithub','addMcpServer','decideApproval','connectTelegram','enableTelegram','importProjectZip','prepareUpload','finalizeUpload','removeUpload','testModel']) {
  const r=await a.inject({url:`/v1/operations/${name}`,method:'POST',payload:{}});
  assert.equal(r.statusCode,400,name);assert.equal(r.json().error,'BAD_REQUEST');
 }
});
test('internal error hides credentials and stack trace',async t=>{
 const a=await app(t,{authenticate:async()=>{throw Error('secret-token-sensitive');}});
 const r=await a.inject('/v1/data/projects');assert.equal(r.statusCode,500);assert.equal(r.body.includes('secret-token'),false);
});
test('SSE response headers and deltas survive HTTP bridge',async t=>{
 const a=await app(t,{authenticate:async()=>context,chat:async()=>new Response('event: delta\ndata: {"text":"hello"}\n\nevent: done\ndata: {}\n\n',{headers:{'content-type':'text/event-stream','x-accel-buffering':'no'}})});
 const r=await a.inject({url:'/v1/chat',method:'POST',payload:{}});
 assert.equal(r.statusCode,200);assert.match(r.headers['content-type'],/text\/event-stream/);assert.match(r.body,/event: delta/);
});
test('data reads always use caller scoped client and bounded pagination',async t=>{
 const calls=[];const q={select(x){calls.push(['select',x]);return this;},order(){return this;},range(a,b){calls.push(['range',a,b]);return this;},then(resolve){resolve({data:[{id:'owned'}],error:null});}};
 const a=await app(t,{authenticate:async()=>({...context,supabase:{from(table){calls.push(['table',table]);return q;}}})});
 const r=await a.inject('/v1/data/projects?offset=20&limit=5');assert.equal(r.statusCode,200);assert.deepEqual(calls,[['table','projects'],['select','*'],['range',20,24]]);
});
test('rate limiting returns 429',async t=>{
 const a=await app(t);let r;for(let i=0;i<61;i++)r=await a.inject('/health/live');assert.equal(r.statusCode,429);
});
test('actual HTTP sends the first SSE event before generation ends and disconnect aborts it',async t=>{
 let completed=false;let cancelled=false;
 const a=await app(t,{authenticate:async()=>context,chat:async request=>{
  const encoder=new TextEncoder();let timer;
  const stream=new ReadableStream({start(controller){
   controller.enqueue(encoder.encode('event: delta\ndata: {"text":"first"}\n\n'));
   timer=setTimeout(()=>{completed=true;controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));controller.close();},1000);
   request.signal.addEventListener('abort',()=>{cancelled=true;clearTimeout(timer);controller.close();},{once:true});
  },cancel(){cancelled=true;clearTimeout(timer);}});
  return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 }});
 await a.listen({host:'127.0.0.1',port:0});
 const response=await fetch(a.listeningOrigin+'/v1/chat',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 const reader=response.body.getReader();const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/first/);assert.equal(completed,false);
 await reader.cancel();
 await new Promise(resolve=>setTimeout(resolve,50));assert.equal(cancelled,true);assert.equal(completed,false);
});

test('agent profiles expose the canonical bounded pipelines and current worker state',async t=>{
 const a=await app(t,{authenticate:async()=>context});
 const r=await a.inject('/v1/agent/profiles');assert.equal(r.statusCode,200);
 const data=r.json().data;assert.equal(data.execution,'SERVER_QUEUE');assert.equal(data.worker_enabled,process.env.WAKEEL_WORKER_ENABLED==='true');
 assert.ok(data.roles.length>1);const ids=new Set(data.roles.map(r=>r.id));
 for(const pipeline of Object.values(data.pipelines)){assert.ok(pipeline.length<=10);assert.ok(pipeline.every(id=>ids.has(id)));}
});

test('integration operations stop at caller-scoped ownership before accessing server credentials',async t=>{
 const calls=[];const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})};
 const a=await app(t,{authenticate:async()=>({...context,supabase:{from(table){calls.push(table);return q;}}})});
 for(const [operation,payload] of [['disconnectGithub',{connectionId:context.userId}],['refreshMcpServer',{serverId:context.userId}],['callMcpTool',{toolId:context.userId,args:{},confirmed:true}]]){
  const r=await a.inject({method:'POST',url:`/v1/operations/${operation}`,payload});assert.equal(r.statusCode,404);assert.equal(r.json().error,'NOT_FOUND');
 }
 assert.deepEqual(calls,['github_connections','mcp_servers','mcp_tools']);
});
