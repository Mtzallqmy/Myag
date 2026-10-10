import type {ChatMessage} from './providers.server';
/** Only server-derived URLs for verified, privately owned vision previews. */
export async function resolveVisionPreviews(ids:string[],userId:string):Promise<ChatMessage['content']>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await (supabaseAdmin as any).from('wakeel_uploads').select('id,object_path,mime,size_bytes,purpose,status').eq('user_id',userId).in('id',ids);
 if(error||!data||data.length!==ids.length)throw Error('ATTACHMENT_NOT_FOUND');
 const parts:Exclude<ChatMessage['content'],string>=[];
 for(const id of ids){
  const row=data.find((r:any)=>r.id===id);
  if(row.status!=='READY'||row.purpose!=='VISION'||!['image/jpeg','image/png','image/webp'].includes(row.mime)||Number(row.size_bytes)>1024*1024||!row.object_path.startsWith(`${userId}/`))throw Error('INVALID_ATTACHMENT');
  const signed=await supabaseAdmin.storage.from('wakeel-uploads').createSignedUrl(row.object_path,600);
  if(signed.error)throw Error('ATTACHMENT_UNAVAILABLE');
  parts.push({type:'image_url',image_url:{url:signed.data.signedUrl,detail:'auto'}});
 }
 return parts;
}
