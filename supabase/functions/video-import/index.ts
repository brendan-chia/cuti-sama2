import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authenticatedClient, corsHeaders, json, requestJson } from '../_shared/invites.ts';
import { instagramPostUrl } from '../import-trip-places/instagram.ts';
const RequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),tripId:z.uuid(),requestId:z.uuid(),sourceUrl:z.string().max(2000).default(''),caption:z.string().max(6000).default(''),upload:z.boolean().default(false)}).strict(),
 z.object({action:z.enum(['status','uploaded','cancel','retry']),importId:z.uuid()}).strict(),
 z.object({action:z.literal('latest'),tripId:z.uuid()}).strict(),
]);
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
  const client=await authenticatedClient(request); if(!client)return json({error:'Reopen the trip to restore your session.'},401);
  const input=RequestSchema.parse(await requestJson(request));
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let importId:string;
  if(input.action==='create'){
   const sourceUrl=input.sourceUrl?instagramPostUrl(input.sourceUrl):null;
   if(!input.upload&&!sourceUrl)return json({error:'Use an Instagram post or Reel URL, or upload the video.'},400);
   const reserved=await client.rpc('begin_place_import',{p_trip_id:input.tripId,p_request_id:input.requestId,p_source_url:sourceUrl});
   if(reserved.error)return json({error:reserved.error.message},400);
   importId=reserved.data.id;
   const path=input.upload?`${importId}/video`:null;
   const inserted=await admin.from('trip_video_jobs').upsert({import_id:importId,caption:input.caption,storage_path:path,state:input.upload?'uploading':'queued'},{onConflict:'import_id',ignoreDuplicates:true});
   if(inserted.error)throw inserted.error;
   if(input.upload){
    const signed=await admin.storage.from('trip-video-imports').createSignedUploadUrl(path!);
    if(signed.error)throw signed.error;
    return json({importId,path,token:signed.data.token});
   }
  }else if(input.action==='latest'){
   const rows=await client.from('trip_place_imports').select('id').eq('trip_id',input.tripId).order('created_at',{ascending:false}).limit(10);
   if(rows.error)throw rows.error;
   const jobs=await admin.from('trip_video_jobs').select('import_id').in('import_id',(rows.data??[]).map(r=>r.id)).order('created_at',{ascending:false}).limit(1);
   if(jobs.error)throw jobs.error;
   if(!jobs.data?.length)return json(null);
   importId=jobs.data[0].import_id;
  }else importId=input.importId;
  const owned=await client.from('trip_place_imports').select('*').eq('id',importId).single();
  if(owned.error||!owned.data)return json({error:'This import is unavailable.'},403);
  const jobResult=await admin.from('trip_video_jobs').select('*').eq('import_id',importId).single(); if(jobResult.error)throw jobResult.error;
  let job=jobResult.data;
  if(input.action==='cancel'){
   const r=await admin.from('trip_video_jobs').update({state:'cancelled',lease:null,message:'Video analysis cancelled.'}).eq('import_id',importId).in('state',['uploading','queued','running','failed']).select().single();
   if(r.data){job=r.data;if(job.storage_path)await admin.storage.from('trip-video-imports').remove([job.storage_path]);}
  }
  if(input.action==='uploaded'||input.action==='retry'){
   const quest=await client.rpc('get_trip_quest',{p_trip_id:owned.data.trip_id});
   if(quest.error||quest.data.stage!=='explore')return json({error:'Video imports are available during Explore.'},409);
   if(input.action==='uploaded'){
    const objects=await admin.storage.from('trip-video-imports').list(importId);
    if(objects.error||!objects.data?.some(o=>o.name==='video'))return json({error:'The video upload has not finished.'},409);
   }
   const r=await admin.from('trip_video_jobs').update({state:'queued',lease:null,message:'Waiting for the local video worker.'}).eq('import_id',importId).eq('state',input.action==='uploaded'?'uploading':'failed').select().single();
   if(r.error)return json({error:'This import cannot be restarted in its current state.'},409);job=r.data;
  }
  const presence=await admin.from('video_worker_presence').select('seen_at').eq('id',1).maybeSingle();
  return json({importId,state:job.state,processedFrames:job.processed_frames,totalFrames:job.total_frames,audioDone:job.audio_done,message:job.message,workerOnline:Boolean(presence.data&&Date.now()-Date.parse(presence.data.seen_at)<180000),candidates:job.state==='done'?owned.data.candidates:[]});
 }catch{return json({error:'Could not update the video import. Please try again.'},400);}
});
