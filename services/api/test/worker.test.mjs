import test from 'node:test';
import assert from 'node:assert/strict';
import {workerUserClient} from '../dist/worker.js';
test('worker admin reads are restricted to job owner and allowlisted tables',()=>{
 const calls=[];
 const builder={select(columns){calls.push(['select',columns]);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},insert(row){calls.push(['insert',row]);return this;}};
 const db={from(table){calls.push(['table',table]);return builder;}};
 const client=workerUserClient('owner',db);
 client.from('ai_models').select('id');
 assert.deepEqual(calls,[['table','ai_models'],['select','id'],['eq','user_id','owner']]);
 assert.throws(()=>client.from('provider_secrets'),/WORKER_TABLE_DENIED/);
 assert.throws(()=>client.from('ai_models').delete(),/WORKER_ACCESS_DENIED/);
 calls.length=0;client.from('usage_events').insert({user_id:'attacker',event_type:'agent'});
 assert.equal(calls[1][1].user_id,'owner');
});
