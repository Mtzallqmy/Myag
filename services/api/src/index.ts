import {buildApp} from './app';
import {startWorker} from './worker';
import {startTelegramWorker} from './telegram';
const app=await buildApp();
const port=Number(process.env['SERVER_PORT']??process.env['PORT']??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','PROVIDER_ENCRYPTION_KEY_V1']){
  if(!process.env[name])throw new Error(`MISSING_${name}`);
}
if(process.env['NODE_ENV']==='production'&&!process.env['PUBLIC_API_ORIGIN']?.startsWith('https://'))throw new Error('PUBLIC_API_ORIGIN_REQUIRED');
const stopWorker=process.env['WAKEEL_WORKER_ENABLED']==='true'?startWorker(app.log):async()=>{};
const stopTelegram=startTelegramWorker(app.log);
let shuttingDown=false;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{
  if(shuttingDown)return;shuttingDown=true;
  const timer=setTimeout(()=>process.exit(1),15000);timer.unref();
  await stopWorker();
  await stopTelegram();
  await app.close();clearTimeout(timer);
});
await app.listen({host:'0.0.0.0',port});
