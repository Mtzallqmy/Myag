import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Emulate only the Supabase system objects referenced by the application's SQL.
// This checks the complete migration chain, not a substitute for live acceptance.
test('fresh schema migrations bootstrap users and isolate their conversations',async t=>{
 const db=new PGlite(); t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid,name text,bucket_id text);
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 CREATE PUBLICATION supabase_realtime;`);
 for(const file of [
  '../../../drizzle/migrations/0000_migration.sql',
  '../../../drizzle/migrations/0001_stage2_projects_agents_github_mcp.sql',
  '../../../drizzle/migrations/0002_stage3_admin_memory_notifications.sql',
  '../../../drizzle/migrations/0003_drop_unused_has_role.sql',
  '../../../supabase/migrations/20261008032239_durable_agent_execution.sql',
  '../../../supabase/migrations/20261008223240_wakeel_private_archives_and_event_grants.sql',
 ]) await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
 const security=(await db.query(`SELECT count(*)::int AS tables,bool_and(relrowsecurity) AS all_rls
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r'`)).rows[0];
 assert.deepEqual(security,{tables:42,all_rls:true});
 assert.deepEqual((await db.query("SELECT public, file_size_limit::int AS limit_bytes FROM storage.buckets WHERE id='project-archives'")).rows[0],{public:false,limit_bytes:52428800});
 const owner='11111111-1111-4111-8111-111111111111';
 const other='22222222-2222-4222-8222-222222222222';
 await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'owner@example.invalid'),($2,'other@example.invalid')",[owner,other]);
 assert.equal((await db.query('SELECT * FROM profiles')).rows.length,2);
 assert.equal((await db.query('SELECT * FROM routing_preferences')).rows.length,2);
 await db.query("INSERT INTO conversations(user_id,title) VALUES($1,'private conversation')",[owner]);
 await db.exec('SET ROLE authenticated');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal((await db.query('SELECT * FROM conversations')).rows.length,0);
 await assert.rejects(db.query("INSERT INTO conversations(user_id,title) VALUES($1,'forged owner')",[owner]));
 for(const table of ['provider_secrets','github_credentials','mcp_credentials','mcp_oauth_states','app_events','wakeel_job_queue'])
  await assert.rejects(db.query(`SELECT * FROM ${table}`));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 assert.equal((await db.query('SELECT * FROM conversations')).rows.length,1);
 await db.exec('RESET ROLE');
});
