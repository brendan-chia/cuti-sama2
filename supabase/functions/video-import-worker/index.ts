import { BatchSchema, analyzeBatch } from './batch.ts';
import { handleSavedMedia } from './saved-media.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { PlaceCandidate } from '../../../packages/contracts/src/place-import.ts';
import { json } from '../_shared/invites.ts';
import { findPlaces, readPublicPost } from '../import-trip-places/providers.ts';
import { combineEvidence, inspectMedia, mergeObservations, transcribeAudio } from './ai.ts';
import { normalizeVideoUrl, type SocialVideo } from '../../../packages/contracts/src/social-video.ts';
import { MediaManifestSchema } from './media.ts';
const PostSchema=z.object({platform:z.enum(['instagram','tiktok']),sourceUrl:z.string().max(2000),postId:z.string().max(150),caption:z.string().max(6000),title:z.string().max(500),author:z.string().max(200),durationSeconds:z.number().positive().max(120.1).nullable()}).strict();
const RequestSchema=z.object({scope:z.literal('inspiration').optional(),action:z.enum(['claim','heartbeat','ingest','start','audio','frame','batch','finish','fail']),batch:BatchSchema.optional(),post:PostSchema.optional(),pipelineVersion:z.literal(3).optional(),manifest:MediaManifestSchema.optional(),itemIndex:z.number().int().min(0).max(19).optional(),importId:z.uuid().optional(),lease:z.uuid().optional(),hash:z.string().regex(/^[a-f0-9]{64}$/).optional(),totalFrames:z.number().int().min(1).max(20).optional(),index:z.number().int().min(0).max(19).optional(),seconds:z.number().min(0).max(121).optional(),image:z.string().max(3000000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).optional(),audio:z.string().max(3500000).regex(/^[A-Za-z0-9+/=]+$/).optional(),noAudio:z.boolean().optional(),message:z.string().max(500).optional()}).strict();
Deno.serve(async request=>{
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const secret=Deno.env.get('VIDEO_WORKER_TOKEN');
 if(!secret||request.headers.get('x-video-worker-token')!==secret)return json({error:'Worker authentication failed.'},401);
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing request.'},400);
  let text='';let size=0;const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4000000){await reader.cancel();return json({error:'Request too large.'},413);}text+=decoder.decode(part.value,{stream:true});}
  const input=RequestSchema.parse(JSON.parse(text+decoder.decode()));
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if(input.scope==='inspiration') return await handleSavedMedia(db,input);
  if(input.action==='claim'){
   const result=await db.rpc('claim_video_import');if(result.error)throw result.error;
   if(!result.data)return json(null);
   const job=result.data;const source=await db.from('trip_place_imports').select('source_url').eq('id',job.import_id).single();
   let downloadUrl=null;
   if(job.storage_path){const signed=await db.storage.from('trip-video-imports').createSignedUrl(job.storage_path,3600);if(signed.error)throw signed.error;downloadUrl=signed.data.signedUrl;}
   return json({...job,sourceUrl:source.data?.source_url,downloadUrl});
  }
  if(!input.importId||!input.lease)return json({error:'Missing job lease.'},400);
  const selected=await db.from('trip_video_jobs').select('*').eq('import_id',input.importId).eq('lease',input.lease).eq('state','running').single();
  if(selected.error)return json({error:'Job was cancelled or claimed by another worker.'},409);
  const job=selected.data;
  const source=await db.from('trip_place_imports').select('trip_id,member_id').eq('id',input.importId).single();if(source.error)throw source.error;
  const [member,quest]=await Promise.all([db.from('trip_members').select('active').eq('id',source.data.member_id).single(),db.from('trip_quests').select('stage,selected_country_code').eq('trip_id',source.data.trip_id).single()]);
  if(!member.data?.active||quest.data?.stage!=='explore')return json({error:'This trip no longer accepts video imports.'},409);
  const update=async(values:Record<string,unknown>)=>{
   const r=await db.from('trip_video_jobs').update({...values,heartbeat:new Date().toISOString()}).eq('import_id',input.importId!).eq('lease',input.lease!).eq('state','running').select('import_id');
   if(r.error||!r.data?.length)throw new Error('Job lease expired.');
  };
  await db.from('video_worker_presence').upsert({id:1,seen_at:new Date().toISOString()});
  if(input.action==='heartbeat'){await update({});return json({ok:true});}
  if(input.action==='fail'){await update({state:'failed',message:input.message??'Video analysis failed. Retry to resume.'});return json({ok:true});}
  if(input.action==='ingest'){
   if(!input.post)return json({error:'Missing post metadata.'},400);
   const post:SocialVideo=input.post;
   const normalized=normalizeVideoUrl(post.sourceUrl);
   if(normalized.platform!==post.platform)return json({error:'Post platform mismatch.'},400);
   if(!post.caption)try{post.caption=await readPublicPost(normalized.url);}catch{/* Video evidence can still be read. */}
   await update({post_metadata:post,caption:post.caption,message:'Reading post photos and videos.'});
   return json({ok:true});
  }
  if(input.action==='start'){
   if(!input.hash||!input.totalFrames||input.pipelineVersion!==3||!input.manifest||input.manifest.frames.length!==input.totalFrames)return json({error:'Restart the worker to load photo and video processing.'},409);
   const legacy=job.pipeline_version!==3;
   if(!legacy&&job.media_hash&&(job.media_hash!==input.hash||job.total_frames!==input.totalFrames))return json({error:'The post media changed. Start a new import.'},409);
   await update({pipeline_version:3,media_hash:input.hash,total_frames:input.totalFrames,media_manifest:input.manifest,...(legacy?{processed_frames:0,audio_done:false,audio_items_done:[],transcript:'',transcript_segments:[],observations:[]}:{}),message:'Analysing post images, captions and available audio.'});
   return json({processedFrames:legacy?0:job.processed_frames,audioItemsDone:legacy?[]:job.audio_items_done});
  }
  if(job.pipeline_version!==3||!job.media_hash)return json({error:'Start photo and video processing first.'},409);
  const manifest=MediaManifestSchema.parse(job.media_manifest);
  if(input.action==='batch'){
   if(!input.batch)return json({error:'Missing media batch.'},400);
   const next=await analyzeBatch(input.batch,manifest,{processedFrames:job.processed_frames,observations:job.observations,audioItemsDone:job.audio_items_done,transcripts:job.transcript_segments});
   await update({processed_frames:next.processedFrames,observations:next.observations,audio_items_done:next.audioItemsDone,transcript_segments:next.transcripts,audio_done:next.audioItemsDone.length===manifest.items.length,message:`Analysed ${next.processedFrames} of ${job.total_frames} images / video scenes.`});
   return next.failed?json({error:'AI batch partially completed. Retrying remaining work.'},503):json({ok:true});
  }
  if(input.action==='audio'){
   const itemIndex=input.itemIndex;
   if(itemIndex===undefined||!manifest.items[itemIndex])return json({error:'Missing media item.'},400);
   if(job.audio_items_done.includes(itemIndex))return json({ok:true});
   const item=manifest.items[itemIndex];
   if(item.hasAudio?(!input.audio||input.noAudio):(!input.noAudio||Boolean(input.audio)))return json({error:'Audio does not match the media item.'},400);
   const transcript=item.hasAudio?await transcribeAudio(input.audio!):{text:'',segments:[]};
   const completed=[...job.audio_items_done,itemIndex];
   const transcripts=[...job.transcript_segments,{itemIndex,segments:transcript.segments}];
   await update({transcript_segments:transcripts,audio_items_done:completed,audio_done:completed.length===manifest.items.length});return json({ok:true});
  }
  if(input.action==='frame'){
   if(input.index===undefined||!input.image)return json({error:'Missing image.'},400);
   if(input.index<job.processed_frames)return json({ok:true});
   if(input.index!==job.processed_frames||input.index>=job.total_frames)return json({error:'Images must be processed in sequence.'},409);
   const observations=mergeObservations(job.observations,await inspectMedia(input.image,manifest.frames[input.index]));
   await update({observations,processed_frames:input.index+1,message:`Analysed ${input.index+1} of ${job.total_frames} images / video scenes.`});return json({ok:true});
  }
  if(input.action!=='finish'||job.total_frames<1||job.processed_frames!==job.total_frames||!job.audio_done)return json({error:'All post images and available audio must finish first.'},409);
  await update({message:'Combining audio and visual evidence with map results.'});
  const names=await combineEvidence(job.caption,job.transcript_segments,job.observations);
  const candidates:PlaceCandidate[]=[];
  for(let offset=0;offset<names.length;offset+=3){
   const matches=await Promise.all(names.slice(offset,offset+3).map(name=>findPlaces(name.name,name.evidence,quest.data!.selected_country_code)));
   for(const group of matches)for(const match of group)if(!candidates.some(p=>p.id===match.id)&&candidates.length<12)candidates.push(match);
  }
  const translated=candidates;
  const message=`Analysed captions, available audio and ${job.total_frames} images / video scenes. ${translated.length?'Matched these locations against OpenStreetMap. Check the evidence and address before confirming.':'No matching places were found in your chosen country.'}`;
  const done=await db.rpc('finish_video_import',{p_import_id:input.importId,p_lease:input.lease,p_candidates:translated,p_message:message});
  if(done.error||!done.data)return json({error:'The import was cancelled or the trip changed.'},409);
  if(job.storage_path)await db.storage.from('trip-video-imports').remove([job.storage_path]);
  // Keep only evidence snippets with candidates, not the full transcript or frame observations.
  await db.from('trip_video_jobs').update({transcript:'',transcript_segments:[],post_metadata:{},observations:[],caption:''}).eq('import_id',input.importId).eq('state','done');
  return json({ok:true});
 }catch(error){const message=error instanceof Error&&/AI |Audio /.test(error.message)?error.message:'Post processing failed. Retry to resume.';return json({error:message},503);}
});
