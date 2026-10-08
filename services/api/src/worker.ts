import {executeAgentPipeline} from '@/lib/operations/agent.server';
import {supabaseAdmin} from '@/integrations/supabase/client.server';
import type {OperationContext} from '@/lib/operations/operation';

// Only selected user's tables needed by the pipeline. No auth token is persisted.
export function workerUserClient(userId:string, database = supabaseAdmin) {
  const allowed=new Set(['agent_jobs','project_files','project_chunks','project_symbols','routing_preferences','ai_providers','ai_models','usage_events']);
  return {
    from(table:string){
      if(!allowed.has(table))throw new Error('WORKER_TABLE_DENIED');
      const builder=(database as any).from(table);
      return new Proxy(builder,{get(target,key){
        if(key==='select')return (...args:unknown[])=>target.select(...args).eq('user_id',userId);
        if(key==='insert'&&table==='usage_events')return (row:any)=>target.insert({...row,user_id:userId});
        throw new Error('WORKER_ACCESS_DENIED');
      }});
    }
  } as unknown as OperationContext['supabase'];
}
export interface WorkerLog {info:(v:unknown)=>void;warn:(v:unknown)=>void}
export function startWorker(log:WorkerLog) {
  let stopped=false;
  let busy=false;
  let timer:ReturnType<typeof setTimeout>;
  let active:Promise<void>|undefined;
  const db=supabaseAdmin as any;
  async function tick(){
    if(stopped||busy)return;
    busy=true;
    try{
      const claimed=await db.rpc('wakeel_claim_job');
      if(claimed.error)throw new Error('QUEUE_UNAVAILABLE');
      const row=claimed.data?.[0];
      if(!row)return;
      let leaseLost=false;
      const heartbeat=setInterval(async()=>{
        try{const r=await db.rpc('wakeel_renew_job',{p_job_id:row.job_id,p_lease_token:row.lease_token});if(r.error||!r.data)leaseLost=true;}catch{leaseLost=true;}
      },20000);heartbeat.unref();
      try{
        const result=await executeAgentPipeline({jobId:row.job_id},{userId:row.user_id,supabase:workerUserClient(row.user_id)});
        if(leaseLost)throw new Error('LEASE_LOST');
        const finish=await db.rpc('wakeel_finish_job',{p_job_id:row.job_id,p_lease_token:row.lease_token,p_ok:result.ok,p_error:result.ok?null:result.error});
        if(finish.error||!finish.data)throw new Error('LEASE_LOST');
        log.info({event:'job_finished',jobId:row.job_id,ok:result.ok});
      }finally{clearInterval(heartbeat);}
    }catch{log.warn({event:'worker_failed',code:'QUEUE_OR_EXECUTION_FAILED'});}
    finally{busy=false;if(!stopped){timer=setTimeout(()=>{active=tick();},3000);timer.unref();}}
  }
  active=tick();
  return async()=>{stopped=true;clearTimeout(timer);await active;};
}
