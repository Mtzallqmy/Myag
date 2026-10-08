// Run locally with temporary access token in environment. Never logs token or content.
const origin=process.env.WAKEEL_API_ORIGIN;
const token=process.env.WAKEEL_ACCESS_TOKEN;
const conversationId=process.env.WAKEEL_CONVERSATION_ID;
if(!origin?.startsWith('https://')||!token||!conversationId)throw Error('Set HTTPS origin, access token and a test conversation ID');
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),60000);
const started=Date.now();let first=null;let events=0;let deltas=0;let finished=false;let error=false;let buffer='';
try{
 const r=await fetch(`${origin}/v1/chat`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({conversationId,content:'اكتب شرحًا طويلًا من عدة فقرات عن هندسة البرمجيات.'}),signal:controller.signal});
 if(!r.ok||!r.headers.get('content-type')?.includes('text/event-stream'))throw Error(`HTTP_${r.status}`);
 const decoder=new TextDecoder();
 for await (const chunk of r.body){
  buffer+=decoder.decode(chunk,{stream:true});
  let i;while((i=buffer.indexOf('\n\n'))>=0){
   const frame=buffer.slice(0,i);buffer=buffer.slice(i+2);events++;
   if(frame.includes('event: delta')){deltas++;first??=Date.now()-started;}
   if(frame.includes('event: done'))finished=true;
   if(frame.includes('event: error'))error=true;
  }
 }
 const total=Date.now()-started;
 const verdict=!error&&finished&&deltas>1&&first!==null&&total-first>100?'INCREMENTAL_OBSERVED':'INCONCLUSIVE_OR_BUFFERED';
 console.log(JSON.stringify({verdict,events,deltas,firstDeltaMs:first,totalMs:total}));
 if(verdict!=='INCREMENTAL_OBSERVED')process.exitCode=1;
}finally{clearTimeout(timeout);}
