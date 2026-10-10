import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {hashSecret,validWebhookSecret,permittedMessage,telegramCall} from '../dist/telegram.js';
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',bot='33333333-3333-4333-8333-333333333333';
test('webhook rejects forged tokens and unapproved/group senders',()=>{
 const secret='test-webhook-secret';assert.equal(validWebhookSecret(secret,hashSecret(secret)),true);
 for(const value of [undefined,'wrong','x'.repeat(300)])assert.equal(validWebhookSecret(value,hashSecret(secret)),false);
 const update={update_id:1,message:{text:'Explain this code',from:{id:99,is_bot:false},chat:{id:99,type:'private'}}};
 assert.ok(permittedMessage(update,99));assert.equal(permittedMessage(update,100),null);
 assert.equal(permittedMessage({...update,message:{...update.message,chat:{id:-99,type:'group'}}},99),null);
 assert.equal(permittedMessage({...update,message:{...update.message,from:{id:99,is_bot:true}}},99),null);
});
test('fixed-origin Telegram adapter hides upstream errors and token values',async()=>{
 const token='123456:'+ 'x'.repeat(35);let url;
 assert.deepEqual(await telegramCall(token,'getMe',{},async value=>{url=value;return Response.json({ok:true,result:{id:1,is_bot:true}});}),{id:1,is_bot:true});
 assert.equal(new URL(url).origin,'https://api.telegram.org');
 await assert.rejects(telegramCall(token,'getMe',{},async()=>Response.json({ok:false,description:token},{status:401})),e=>e.message==='TELEGRAM_TOKEN_INVALID'&&!e.message.includes(token));
 await assert.rejects(telegramCall(token,'arbitraryMethod',{},async()=>{throw Error('must not call');}),/METHOD_DENIED/);
});
async function dbFor(t){const db=new PGlite();t.after(()=>db.close());await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE conversations(id uuid PRIMARY KEY);
 CREATE TABLE messages(id uuid PRIMARY KEY,conversation_id uuid,user_id uuid,role text,content text,model_id uuid,provider_id uuid,metadata_json jsonb);
 INSERT INTO auth.users VALUES('${user}'),('${other}');
 `);await db.exec(await readFile(new URL('../../../supabase/migrations/20261010015526_wakeel_telegram_bridge.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO telegram_bots(id,user_id,bot_id,username,allowed_user_id,status) VALUES('${bot}','${user}',123456,'testbot',99,'ENABLED');`);return db;}
test('durable inbox deduplicates updates, leases one claimant, never resends uncertain delivery',async t=>{
 const db=await dbFor(t);
 await db.query("INSERT INTO telegram_inbox(bot_id,user_id,update_id,chat_id,text) VALUES($1,$2,7,99,'question')",[bot,user]);
 await assert.rejects(db.query("INSERT INTO telegram_inbox(bot_id,user_id,update_id,chat_id,text) VALUES($1,$2,7,99,'duplicate')",[bot,user]));
 const claimed=(await db.query('SELECT * FROM wakeel_claim_telegram()')).rows[0];
 assert.equal((await db.query('SELECT * FROM wakeel_claim_telegram()')).rows.length,0);
 assert.equal((await db.query('SELECT wakeel_ready_telegram($1,$2,$3) AS ok',[claimed.id,other,'answer'])).rows[0].ok,false);
 assert.equal((await db.query('SELECT wakeel_ready_telegram($1,$2,$3) AS ok',[claimed.id,claimed.lease_token,'answer'])).rows[0].ok,true);
 assert.equal((await db.query('SELECT wakeel_begin_telegram_send($1,$2) AS ok',[claimed.id,claimed.lease_token])).rows[0].ok,true);
 assert.equal((await db.query('SELECT wakeel_begin_telegram_send($1,$2) AS ok',[claimed.id,claimed.lease_token])).rows[0].ok,false);
 await db.exec("UPDATE telegram_inbox SET lease_until=now()-interval '1 second'");
 assert.equal((await db.query('SELECT * FROM wakeel_claim_telegram()')).rows.length,0);
 assert.equal((await db.query('SELECT status FROM telegram_inbox')).rows[0].status,'SEND_UNCERTAIN');
});
test('bot/inbox owner RLS and credential/RPC access fail closed',async t=>{
 const db=await dbFor(t);await db.exec('SET ROLE authenticated');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal((await db.query('SELECT * FROM telegram_bots')).rows.length,0);
 await assert.rejects(db.query('SELECT * FROM telegram_bot_secrets'));
 await assert.rejects(db.query('SELECT * FROM wakeel_claim_telegram()'));
 await assert.rejects(db.query("UPDATE telegram_bots SET status='ENABLED'"));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);
 assert.equal((await db.query('SELECT * FROM telegram_bots')).rows.length,1);
});
