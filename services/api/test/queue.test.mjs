import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const user='11111111-1111-4111-8111-111111111111';
const job='22222222-2222-4222-8222-222222222222';
async function database(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.agent_jobs(id uuid PRIMARY KEY,user_id uuid,status text,current_step int,error_code text,completed_at timestamptz);
 GRANT ALL ON public.agent_jobs TO service_role;
 INSERT INTO public.agent_jobs VALUES('${job}','${user}','PLANNING',0,NULL,NULL);`);
 const dir=new URL('../../../supabase/migrations/',import.meta.url);
 const file=(await readdir(dir)).find(x=>x.endsWith('_durable_agent_execution.sql'));
 await db.exec(await readFile(new URL(file,dir),'utf8'));return db;
}
test('enqueue is idempotent and requires matching owner',async t=>{
 const db=await database(t);
 for(let i=0;i<2;i++)await db.query('select wakeel_enqueue_job($1,$2)',[job,user]);
 assert.equal((await db.query('select * from wakeel_job_queue')).rows.length,1);
 await assert.rejects(db.query('select wakeel_enqueue_job($1,$2)',[job,'33333333-3333-4333-8333-333333333333']));
});
test('one worker claim, stale lease cannot renew or finish',async t=>{
 const db=await database(t);await db.query('select wakeel_enqueue_job($1,$2)',[job,user]);
 const row=(await db.query('select * from wakeel_claim_job()')).rows[0];
 assert.equal((await db.query('select * from wakeel_claim_job()')).rows.length,0);
 const wrong='33333333-3333-4333-8333-333333333333';
 assert.equal((await db.query('select wakeel_renew_job($1,$2) as ok',[job,wrong])).rows[0].ok,false);
 assert.equal((await db.query('select wakeel_finish_job($1,$2,true) as ok',[job,wrong])).rows[0].ok,false);
 assert.equal((await db.query('select wakeel_finish_job($1,$2,true) as ok',[job,row.lease_token])).rows[0].ok,true);
});
test('restart preserves queued work; interrupted work is not blindly replayed',async t=>{
 const db=await database(t);await db.query('select wakeel_enqueue_job($1,$2)',[job,user]);
 await db.query('select * from wakeel_claim_job()');
 await db.exec("UPDATE wakeel_job_queue SET lease_until=now()-interval '1 second'; UPDATE agent_jobs SET current_step=2,status='READING';");
 assert.equal((await db.query('select * from wakeel_claim_job()')).rows.length,0);
 assert.equal((await db.query('select status from agent_jobs')).rows[0].status,'INTERRUPTED');
 assert.equal((await db.query('select status from wakeel_job_queue')).rows[0].status,'INTERRUPTED');
});
test('queue table and worker RPCs are inaccessible to anon/authenticated',async t=>{
 const db=await database(t);
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  await assert.rejects(db.query('select * from wakeel_job_queue'));
  await assert.rejects(db.query('select * from wakeel_claim_job()'));
  await db.exec('RESET ROLE');
 }
});
