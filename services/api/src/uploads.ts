import {z} from 'zod';
import {defineOperation,type OperationContext} from '@/lib/operations/operation';
const MIME=['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4','application/pdf','application/zip','text/plain','application/octet-stream'] as const;
export const uploadInput=z.object({name:z.string().trim().min(1).max(150).transform(v=>v.replace(/[\x00-\x1f\\/]/g,'_')),mime:z.enum(MIME),size:z.number().int().positive().max(50*1024*1024),purpose:z.enum(['FILE','VISION']).default('FILE'),confirmUpload:z.literal(true)}).strict().superRefine((v,c)=>{if(v.purpose==='VISION'&&(!['image/jpeg','image/png','image/webp'].includes(v.mime)||v.size>1024*1024))c.addIssue({code:'custom',message:'INVALID_VISION_PREVIEW'});});
export function imageSignature(bytes:Uint8Array,mime:string):boolean{
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(mime==='image/png')return Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/webp')return Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP';
 return false;
}
const idInput=(raw:unknown)=>z.object({id:z.string().uuid()}).strict().parse(raw);
async function clients(){const {supabaseAdmin}=await import('@/integrations/supabase/client.server');return {db:supabaseAdmin as any,storage:supabaseAdmin.storage.from('wakeel-uploads')};}
async function owned(id:string,context:OperationContext){const {db}=await clients();const {data,error}=await db.from('wakeel_uploads').select('*').eq('id',id).eq('user_id',context.userId).maybeSingle();return error?null:data;}
export const prepareUpload=defineOperation({method:'POST'}).inputValidator(raw=>uploadInput.parse(raw)).handler(async({data,context})=>{
 const {db,storage}=await clients();
 const reserved=await db.rpc('wakeel_reserve_upload',{p_owner:context.userId,p_name:data.name,p_mime:data.mime,p_size:data.size,p_purpose:data.purpose});
 if(reserved.error)return {ok:false,error:reserved.error.message?.includes('UPLOAD_QUOTA_EXCEEDED')?'UPLOAD_QUOTA_EXCEEDED':'UPLOAD_PREPARE_FAILED'};
 const id=reserved.data as string;const path=`${context.userId}/${id}`;
 const signed=await storage.createSignedUploadUrl(path,{upsert:false});
 if(signed.error){await db.from('wakeel_uploads').delete().eq('id',id).eq('user_id',context.userId);return {ok:false,error:'STORAGE_UNAVAILABLE'};}
 return {ok:true,data:{id,signedUrl:signed.data.signedUrl,mime:data.mime,size:data.size}};
});
export const finalizeUpload=defineOperation({method:'POST'}).inputValidator(idInput).handler(async({data,context})=>{
 const row=await owned(data.id,context);if(!row)return {ok:false,error:'NOT_FOUND'};
 const {db,storage}=await clients();const info=await storage.info(row.object_path);
 if(info.error||!info.data)return {ok:false,error:'UPLOAD_NOT_FOUND'};
 if(Number(info.data.size)!==Number(row.size_bytes)||info.data.contentType!==row.mime)return {ok:false,error:'UPLOAD_METADATA_MISMATCH'};
 if(row.purpose==='VISION'){const downloaded=await storage.download(row.object_path);if(downloaded.error||!downloaded.data||downloaded.data.size>1024*1024||!imageSignature(new Uint8Array(await downloaded.data.arrayBuffer()),row.mime))return {ok:false,error:'INVALID_IMAGE'};}
 const result=await db.from('wakeel_uploads').update({status:'READY'}).eq('id',row.id).eq('user_id',context.userId);
 return result.error?{ok:false,error:'UPLOAD_FINALIZE_FAILED'}:{ok:true,data:{id:row.id,name:row.name,mime:row.mime,status:'READY',purpose:row.purpose}};
});
export const removeUpload=defineOperation({method:'POST'}).inputValidator(idInput).handler(async({data,context})=>{
 const row=await owned(data.id,context);if(!row)return {ok:false,error:'NOT_FOUND'};
 // A signed URL remains valid for two hours. Retain its quota until it expires; deleting earlier would allow an untracked re-upload.
 if(Date.now()-Date.parse(row.created_at)<2*60*60*1000)return {ok:false,error:'UPLOAD_URL_STILL_ACTIVE'};
 const {db,storage}=await clients();const removed=await storage.remove([row.object_path]);if(removed.error)return {ok:false,error:'UPLOAD_DELETE_FAILED'};
 const result=await db.from('wakeel_uploads').delete().eq('id',row.id).eq('user_id',context.userId);
 return result.error?{ok:false,error:'UPLOAD_DELETE_FAILED'}:{ok:true,data:{id:row.id}};
});
