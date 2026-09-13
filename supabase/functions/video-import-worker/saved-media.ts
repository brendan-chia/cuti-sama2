import { BatchSchema, analyzeBatch } from './batch.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { json } from '../_shared/invites.ts';
import { InspirationAnalysisSchema } from '../../../packages/contracts/src/inspiration.ts';
import { combineEvidence, inspectMedia, mergeObservations, transcribeAudio, ObservationSchema } from './ai.ts';
import { MediaManifestSchema } from './media.ts';

type Input = { batch?:z.infer<typeof BatchSchema>; action:string; importId?:string; lease?:string; post?:{caption:string}; hash?:string; totalFrames?:number; manifest?:z.infer<typeof MediaManifestSchema>; index?:number; image?:string; itemIndex?:number; audio?:string; noAudio?:boolean };
const StateSchema=z.object({queued:z.boolean().optional(),hash:z.string().optional(),manifest:MediaManifestSchema.optional(),caption:z.string().default(''),processedFrames:z.number().int().default(0),audioItemsDone:z.array(z.number().int()).default([]),transcripts:z.array(z.object({itemIndex:z.number().int(),segments:z.array(z.object({start:z.number(),end:z.number(),text:z.string()}))})).default([]),observations:z.array(ObservationSchema).default([])});
export async function handleSavedMedia(db:SupabaseClient,input:Input) {
 if(input.action==='claim') {
  const result=await db.rpc('claim_inspiration_media');
  if(result.error)throw result.error;
  return json(result.data);
 }
 if(!input.importId||!input.lease)return json({error:'Missing saved media lease.'},400);
 const {data:idea,error}=await db.from('saved_inspiration').select('*').eq('id',input.importId).eq('lease',input.lease).eq('status','analyzing').maybeSingle();
 if(error||!idea)return json({error:'Saved post was edited, deleted or reclaimed.'},409);
 const state=StateSchema.parse(idea.media_state);
 const update=async(values:Record<string,unknown>)=>{
  const result=await db.from('saved_inspiration').update({...values,updated_at:new Date().toISOString()}).eq('id',input.importId!).eq('lease',input.lease!).eq('status','analyzing').select('id');
  if(result.error)throw result.error;
  return Boolean(result.data?.length);
 };
 if(input.action==='heartbeat')return await update({})?json({ok:true}):json({error:'Saved media lease expired.'},409);
 if(input.action==='fail') {
  await update({status:'failed',lease:null,media_state:null,message:'Could not read the post media. Check that the post is public and retry while the media worker is running.'});
  return json({ok:true});
 }
 if(input.action==='ingest') {
  if(!input.post)return json({error:'Missing post metadata.'},400);
  state.caption=input.post.caption;
 } else if(input.action==='start') {
  if(!input.hash||!input.manifest||input.manifest.frames.length!==input.totalFrames)return json({error:'Missing media manifest.'},400);
  if(state.hash && (state.hash!==input.hash || JSON.stringify(state.manifest)!==JSON.stringify(input.manifest)))return json({error:'Post media changed. Retry analysis.'},409);
  state.hash=input.hash;state.manifest=input.manifest;
 } else {
  if(!state.manifest)return json({error:'Start media processing first.'},409);
  if(input.action==='batch') {
   if(!input.batch)return json({error:'Missing media batch.'},400);
   const next=await analyzeBatch(input.batch,state.manifest,state);
   const {failed,...checkpoint}=next;
   const saved=await update({media_state:{...state,...checkpoint},message:`Analyzing media with OpenAI: ${next.processedFrames} images / scenes complete.`});
   if(!saved)return json({error:'Saved post changed during analysis.'},409);
   return failed?json({error:'AI batch partially completed. Retrying remaining work.'},503):json({ok:true});
  } else if(input.action==='audio') {
   const index=input.itemIndex;
   if(index===undefined||!state.manifest.items[index])return json({error:'Missing media item.'},400);
   if(!state.audioItemsDone.includes(index)) {
    const item=state.manifest.items[index];
    if(item.hasAudio?(!input.audio||input.noAudio):(!input.noAudio||Boolean(input.audio)))return json({error:'Audio does not match media.'},400);
    const transcript=item.hasAudio?await transcribeAudio(input.audio!):{segments:[]};
    state.transcripts.push({itemIndex:index,segments:transcript.segments});state.audioItemsDone.push(index);
   }
  } else if(input.action==='frame') {
   if(input.index===undefined||!input.image)return json({error:'Missing image.'},400);
   if(input.index>state.processedFrames||!state.manifest.frames[input.index])return json({error:'Frames must be processed in sequence.'},409);
   if(input.index===state.processedFrames) {
    state.observations=mergeObservations(state.observations,await inspectMedia(input.image,state.manifest.frames[input.index]));state.processedFrames++;
   }
  } else if(input.action==='finish') {
   if(state.processedFrames!==state.manifest.frames.length||state.audioItemsDone.length!==state.manifest.items.length)return json({error:'Finish every frame and audio item first.'},409);
   const caption=[idea.caption,state.caption].filter(Boolean).join('\n').slice(0,12000);
   const places=await combineEvidence(caption,state.transcripts,state.observations);
   const analysis=InspirationAnalysisSchema.parse({title:places.length?places[0].name.slice(0,120):'Travel post',summary:places.length?'Places suggested from the post caption, sampled images and available audio. Confirm their locations before adding them to your itinerary.':'No supported travel places were identified in the sampled media.',places:places.map(place=>({name:place.name,location:'',evidence:place.evidence.slice(0,400)})),tags:[],planningNotes:['Visual matches are suggestions. Check each location on the map.']});
   const saved=await update({analysis,status:'ready',provider:'openai',model:Deno.env.get('OPENAI_INSPIRATION_MODEL')||'gpt-4.1-mini',source_text:caption,lease:null,media_state:null,message:`Analyzed ${state.processedFrames} images / video scenes and available audio with OpenAI.`});
   return saved?json({ok:true}):json({error:'Saved post changed during analysis.'},409);
  } else return json({error:'Unknown media action.'},400);
 }
 const saved=await update({media_state:state,message:`Analyzing media with OpenAI: ${state.processedFrames} images / scenes complete.`});
 return saved?json({ok:true,processedFrames:state.processedFrames,audioItemsDone:state.audioItemsDone}):json({error:'Saved post changed during analysis.'},409);
}
