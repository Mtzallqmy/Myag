import {AGENT_ROLES,ROLE_DEFS,pipelineFor} from "@/lib/agent/roles";
import Fastify, {type FastifyRequest} from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {Readable} from 'node:stream';
import {z} from 'zod';
import {createClient} from '@supabase/supabase-js';
import {getUserFromRequest} from '@/lib/server/auth.server';
import {handleChat} from '@/lib/server/chat.server';
import {handleMcpCallback} from '@/lib/server/mcp-oauth.server';
import type {OperationContext} from '@/lib/operations/operation';
import * as providers from '@/lib/operations/providers.server';
import * as projects from '@/lib/operations/projects.server';
import * as agent from '@/lib/operations/agent.server';
import * as github from '@/lib/operations/github.server';
import * as mcp from '@/lib/operations/mcp.server';
import * as staff from '@/lib/operations/stage3.server';
import {connectTelegram,testTelegram,enableTelegram,disableTelegram,disconnectTelegram,acceptTelegram} from './telegram';
import {prepareUpload,finalizeUpload,removeUpload} from './uploads';
import {importProjectZip} from './zip-import';

export const operations = {...providers,...projects,...agent,...github,...mcp,...staff,connectTelegram,testTelegram,enableTelegram,disableTelegram,disconnectTelegram,importProjectZip,prepareUpload,finalizeUpload,removeUpload};
export const reads: Record<string,{table:string;columns:string;order:string}> = {
  uploads:{table:'wakeel_uploads',columns:'id,name,mime,size_bytes,purpose,status,created_at',order:'created_at'},
  conversations:{table:'conversations',columns:'*',order:'updated_at'},
  messages:{table:'messages',columns:'*',order:'created_at'},
  providers:{table:'ai_providers',columns:'id,name,provider_type,base_url,status,token_hint,created_at',order:'created_at'},
  models:{table:'ai_models',columns:'*',order:'display_name'},
  projects:{table:'projects',columns:'*',order:'updated_at'},
  files:{table:'project_files',columns:'path,size_bytes,is_binary,line_count,project_id',order:'path'},
  jobs:{table:'agent_jobs',columns:'*',order:'created_at'},
  steps:{table:'agent_job_steps',columns:'*',order:'step_number'},
  telegram:{table:'telegram_bots',columns:'id,username,allowed_user_id,status,created_at',order:'created_at'},
  telegramEvents:{table:'telegram_inbox',columns:'id,bot_id,status,error_code,created_at',order:'created_at'},
  approvals:{table:'approvals',columns:'*',order:'created_at'},
  changes:{table:'change_sets',columns:'*',order:'created_at'},
  validations:{table:'validation_runs',columns:'*',order:'created_at'},
  github:{table:'github_connections',columns:'id,github_login:account_login,status,created_at',order:'created_at'},
  repositories:{table:'github_repositories',columns:'*',order:'pushed_at'},
  mcp:{table:'mcp_servers',columns:'id,name,url,status,auth_type,created_at',order:'created_at'},
  tools:{table:'mcp_tools',columns:'*',order:'name'},
  resources:{table:'mcp_resources',columns:'*',order:'name'},
  prompts:{table:'mcp_prompts',columns:'*',order:'name'},
  notifications:{table:'notifications',columns:'*',order:'created_at'},
  history:{table:'audit_logs',columns:'id,action,entity_type,entity_id,created_at,metadata_json',order:'created_at'},
  memory:{table:'user_preferences_memory',columns:'id,summary,source,confidence,created_at,expires_at',order:'created_at'},
};

function origin() {
  const value=process.env['PUBLIC_API_ORIGIN'] ?? 'http://localhost:3000';
  return new URL(value).origin;
}
export function webRequest(req:FastifyRequest, signal?:AbortSignal):Request {
  const headers=new Headers();
  for(const [key,value] of Object.entries(req.headers)) if(value) headers.set(key,Array.isArray(value)?value.join(','):value);
  return new Request(new URL(req.url,origin()), {method:req.method,headers,signal,...(!['GET','HEAD'].includes(req.method)?{body:JSON.stringify(req.body)}:{})});
}
const errorStatus=(code:string)=> code==='FORBIDDEN'?403:code==='NOT_FOUND'||code.endsWith('_NOT_FOUND')?404:code==='ALREADY_STARTED'||code==='ALREADY_DECIDED'?409:code.includes('UNAVAILABLE')?503:code.includes('QUOTA')?429:400;
export interface AppDependencies {
  authenticate?:(request:Request)=>Promise<OperationContext|null>;
  chat?:(request:Request)=>Promise<Response>;
  ready?:()=>Promise<boolean>;
}
export async function buildApp(deps:AppDependencies={}) {
  const app=Fastify({bodyLimit:5*1024*1024,disableRequestLogging:true,logger:{level:'info',redact:['req.headers.authorization','req.headers.cookie','body','response.headers.set-cookie']}});
  await app.register(cors,{origin:process.env['CORS_ORIGINS']?.split(',').filter(Boolean) ?? false});
  await app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  const authenticate=deps.authenticate ?? getUserFromRequest;
  app.decorateRequest('wakeelContext',null);
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('cache-control','no-store').header('x-content-type-options','nosniff');
    if(!req.url.startsWith('/v1/') || req.url.startsWith('/v1/auth/')) return;
    const context=await authenticate(webRequest(req));
    if(!context) return reply.code(401).send({ok:false,error:'UNAUTHORIZED'});
    (req as any).wakeelContext={...context,request:webRequest(req)};
  });
  app.setErrorHandler((err,req,reply)=>{
    const code=err instanceof z.ZodError?'BAD_REQUEST':(err as any).statusCode===429?'RATE_LIMITED':(err as any).statusCode===413?'PAYLOAD_TOO_LARGE':'INTERNAL_ERROR';
    req.log.warn({event:'request_failed',code,requestId:req.id});
    reply.code(code==='BAD_REQUEST'?400:code==='RATE_LIMITED'?429:code==='PAYLOAD_TOO_LARGE'?413:500).send({ok:false,error:code});
  });
  app.get('/health/live',async()=>({status:'ok'}));
  app.get('/v1/capabilities',async()=>({ok:true,data:{version:'0.6.0',telegram:true,zip_import:true,media_upload:true,vision_chat:true,agent_worker:process.env['WAKEEL_WORKER_ENABLED']==='true',runtime:Boolean(process.env['AGENT_RUNTIME_BASE_URL']&&process.env['AGENT_RUNTIME_SHARED_SECRET'])}}));
  app.get('/v1/agent/profiles',async()=>({ok:true,data:{roles:AGENT_ROLES.map(id=>({id,...ROLE_DEFS[id]})),pipelines:Object.fromEntries((['FAST','BALANCED','DEEP','MULTI'] as const).map(depth=>[depth,pipelineFor(depth)])),execution:'SERVER_QUEUE',worker_enabled:process.env['WAKEEL_WORKER_ENABLED']==='true'}}));
  app.post('/api/public/telegram/:id',{bodyLimit:32768,config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{
    const id=(req.params as {id:string}).id;
    const secret=req.headers['x-telegram-bot-api-secret-token'];
    const result=await acceptTelegram(id,typeof secret==='string'?secret:undefined,req.body);
    return reply.code(result.status).send({ok:result.status===200});
  });
  app.get('/health/ready',async(_,reply)=>{
    const ok=await (deps.ready ?? (async()=>{
      if(!process.env['SUPABASE_URL']||!process.env['SUPABASE_SERVICE_ROLE_KEY']||!process.env['SUPABASE_PUBLISHABLE_KEY']||!process.env['PROVIDER_ENCRYPTION_KEY_V1'])return false;
      const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
      const r=await supabaseAdmin.from('profiles').select('id').limit(1);return !r.error;
    }))().catch(()=>false);
    return reply.code(ok?200:503).send({status:ok?'ready':'unavailable'});
  });
  for(const [name,operation] of Object.entries(operations)) {
    if(typeof operation!=='object'||!('execute' in operation))continue;
    app.route({method:operation.method,url:`/v1/operations/${name}`,handler:async(req,reply)=>{
      // runAgentJob remains a compatibility endpoint until the durable queue migration is deployed.
      const context=(req as any).wakeelContext as OperationContext;
      const result=await (operation.execute as any)({data:operation.validate(req.body),context});
      if(result?.ok===false)reply.code(errorStatus(result.error));
      return result;
    }});
  }
  app.get('/v1/data/:collection',async(req,reply)=>{
    const {collection}=z.object({collection:z.enum(Object.keys(reads) as [string,...string[]])}).parse(req.params);
    const query=z.object({id:z.string().uuid().optional(),jobId:z.string().uuid().optional(),projectId:z.string().uuid().optional(),conversationId:z.string().uuid().optional(),serverId:z.string().uuid().optional(),offset:z.coerce.number().int().min(0).max(100000).default(0),limit:z.coerce.number().int().min(1).max(500).default(100)}).strict().parse(req.query);
    const r=reads[collection]!;
    let q=(req as any).wakeelContext.supabase.from(r.table).select(r.columns).order(r.order,{ascending:['files','models','steps'].includes(collection)}).range(query.offset,query.offset+query.limit-1);
    if(query.id)q=q.eq('id',query.id);
    if(query.jobId)q=q.eq('job_id',query.jobId);
    if(query.projectId)q=q.eq('project_id',query.projectId);
    if(query.conversationId)q=q.eq('conversation_id',query.conversationId);
    if(query.serverId)q=q.eq('server_id',query.serverId);
    const result=await q;
    if(result.error)return reply.code(503).send({ok:false,error:'DATABASE_UNAVAILABLE'});
    return {ok:true,data:result.data};
  });
  app.post('/v1/conversations',async(req,reply)=>{
    const data=z.object({title:z.string().max(120).optional(),routingMode:z.enum(['AUTO','PREFER_FREE','PREFER_CHEAP','PREFER_FAST','PREFER_STRONGEST','PREFER_CODING','PREFER_LONG_CONTEXT','MANUAL']).default('AUTO'),modelId:z.string().uuid().nullable().optional()}).parse(req.body);
    const ctx=(req as any).wakeelContext as OperationContext;
    if(data.modelId){const r=await ctx.supabase.from('ai_models').select('id').eq('id',data.modelId).maybeSingle();if(!r.data)return reply.code(404).send({ok:false,error:'MODEL_NOT_FOUND'});}
    const r=await ctx.supabase.from('conversations').insert({user_id:ctx.userId,title:data.title??undefined,routing_mode:data.routingMode,active_model_id:data.modelId??null}).select('*').single();
    return r.error?reply.code(503).send({ok:false,error:'PERSIST_FAILED'}):{ok:true,data:r.data};
  });
  app.post('/v1/chat',async(req,reply)=>{
    const abort=new AbortController();
    const close=()=>{if(!reply.raw.writableFinished)abort.abort();};
    reply.raw.on('close',close);
    const response=await (deps.chat??handleChat)(webRequest(req,abort.signal));
    reply.code(response.status);
    response.headers.forEach((v,k)=>reply.header(k,v));
    if(response.body){const stream=Readable.fromWeb(response.body as any);abort.signal.addEventListener('abort',()=>stream.destroy(),{once:true});return reply.send(stream);}
    return reply.send();
  });
  app.get('/api/public/mcp-oauth/callback',async(req,reply)=>{
    const response=await handleMcpCallback(webRequest(req));
    reply.code(response.status);response.headers.forEach((v,k)=>reply.header(k,v));return reply.send(await response.text());
  });
  app.get('/integrations',async()=>({status:'Return to Wakeel and refresh the integration list.'}));
  const authClient=()=>createClient(process.env['SUPABASE_URL']!,process.env['SUPABASE_PUBLISHABLE_KEY']!,{auth:{persistSession:false,autoRefreshToken:false}});
  app.post('/v1/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
    const input=z.object({email:z.string().email().max(254),password:z.string().min(1).max(1024)}).parse(req.body);
    const r=await authClient().auth.signInWithPassword(input);
    return r.error?reply.code(401).send({ok:false,error:'LOGIN_FAILED'}):{ok:true,data:r.data.session};
  });
  app.post('/v1/auth/refresh',async(req,reply)=>{
    const input=z.object({refreshToken:z.string().min(1).max(8192)}).parse(req.body);
    const r=await authClient().auth.refreshSession({refresh_token:input.refreshToken});
    return r.error?reply.code(401).send({ok:false,error:'SESSION_EXPIRED'}):{ok:true,data:r.data.session};
  });
  app.post('/v1/auth/logout',async(req,reply)=>{
    const context=await authenticate(webRequest(req));
    if(!context)return reply.code(401).send({ok:false,error:'UNAUTHORIZED'});
    const token=req.headers.authorization!.slice(7);
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const r=await supabaseAdmin.auth.admin.signOut(token,'local');
    return r.error?reply.code(503).send({ok:false,error:'LOGOUT_FAILED'}):{ok:true,data:null};
  });
  return app;
}
