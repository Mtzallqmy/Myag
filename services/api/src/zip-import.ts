import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {defineOperation} from '@/lib/operations/operation';
import {listZipEntries,safeExtractZip,isProbablyBinary,mimeOf,ArchiveRejected} from '@/lib/projects/archive';
import {createProject,ingestProjectBatch,finalizeProjectIngest} from '@/lib/operations/projects.server';
import {findSecrets} from '@/lib/security/redact';

export function validateSmallZip(bytes:Uint8Array){
 if(bytes.length>3*1024*1024)throw new ArchiveRejected('ARCHIVE_TOO_LARGE');
 const entries=listZipEntries(bytes);
 if(entries.length>200)throw new ArchiveRejected('ARCHIVE_TOO_MANY_FILES');
 if(entries.reduce((sum,e)=>sum+e.size,0)>8*1024*1024)throw new ArchiveRejected('ARCHIVE_EXTRACTED_TOO_LARGE');
 return safeExtractZip(bytes);
}
export const importProjectZip=defineOperation({method:'POST'})
 .inputValidator(raw=>z.object({name:z.string().trim().min(1).max(120),archiveBase64:z.string().min(4).max(4*1024*1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),confirmUpload:z.literal(true)}).parse(raw))
 .handler(async({data,context})=>{
  try{
   const bytes=Buffer.from(data.archiveBase64,'base64');const extracted=validateSmallZip(bytes);
   const files=extracted.files.map(f=>{const binary=isProbablyBinary(f.bytes)||f.bytes.length>512*1024;return {path:f.path,text:binary?null:new TextDecoder().decode(f.bytes),size:f.bytes.length,mime:mimeOf(f.path),isBinary:binary};});
   if(!files.length)return {ok:false,error:'ARCHIVE_EMPTY'};
   if(files.some(f=>f.text!==null&&findSecrets(f.text).length>0))return {ok:false,error:'ARCHIVE_CONTAINS_SECRETS'};
   const archivePath=`${context.userId}/${randomUUID()}.zip`;
   const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
   // Create runs kill-switch/quota validation first; archive stays private.
   const created=await createProject.execute({context,data:{name:data.name,sourceType:'UPLOAD',archivePath}});
   if(!created.ok)return created;
   const projectId=created.data.id;
   const fail=async(error:string)=>{await finalizeProjectIngest.execute({context,data:{projectId,failed:error}});return {ok:false,error,projectId};};
   const stored=await supabaseAdmin.storage.from('project-archives').upload(archivePath,bytes,{contentType:'application/zip',upsert:false});if(stored.error)return fail('ARCHIVE_STORAGE_FAILED');
   // Existing ingestion validates quotas, ownership, paths, language/symbol/chunk indexing.
   const result=await ingestProjectBatch.execute({context,data:{projectId,files}});if(!result.ok)return fail(result.error);
   if(result.data.rejected>0)return fail('ARCHIVE_FILES_REJECTED');
   const final=await finalizeProjectIngest.execute({context,data:{projectId}});if(!final.ok)return fail(final.error);
   return {ok:true,data:{id:projectId,fileCount:final.data.fileCount,skipped:extracted.skipped}};
  }catch(e){return {ok:false,error:e instanceof ArchiveRejected?e.code:'ARCHIVE_IMPORT_FAILED'};}
 });
