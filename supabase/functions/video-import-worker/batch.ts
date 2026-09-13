import { z } from 'zod';
import { inspectMedia, transcribeAudio, mergeObservations, type ObservationSchema } from './ai.ts';
import { type MediaManifestSchema } from './media.ts';
export const BatchSchema=z.object({
 frames:z.array(z.object({index:z.number().int().min(0).max(19),image:z.string().max(3000000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)}).strict()).max(3),
 audio:z.object({itemIndex:z.number().int().min(0).max(19),audio:z.string().max(3500000).regex(/^[A-Za-z0-9+/=]+$/).optional(),noAudio:z.boolean().optional()}).strict().optional(),
}).strict();
type Observation=z.infer<typeof ObservationSchema>;
type Transcript={itemIndex:number;segments:{start:number;end:number;text:string}[]};
export async function analyzeBatch(batch:z.infer<typeof BatchSchema>,manifest:z.infer<typeof MediaManifestSchema>,checkpoint:{processedFrames:number;observations:Observation[];audioItemsDone:number[];transcripts:Transcript[]},inspect=inspectMedia,transcribe=transcribeAudio) {
 // Accept already committed prefixes on network retries, but never gaps or duplicates.
 const pending=batch.frames.filter(frame=>frame.index>=checkpoint.processedFrames);
 if(new Set(batch.frames.map(frame=>frame.index)).size!==batch.frames.length || pending.some((frame,i)=>frame.index!==checkpoint.processedFrames+i||!manifest.frames[frame.index]))throw new Error('AI batch frames must be contiguous.');
 const audio=batch.audio;
 if(audio){const item=manifest.items[audio.itemIndex];if(!item||(item.hasAudio?(!audio.audio||audio.noAudio):(!audio.noAudio||Boolean(audio.audio))))throw new Error('Audio does not match media.');}
 const audioPending=audio&&!checkpoint.audioItemsDone.includes(audio.itemIndex);
 const results=await Promise.allSettled([
  ...pending.map(frame=>inspect(frame.image,manifest.frames[frame.index])),
  ...(audioPending?[audio.audio?transcribe(audio.audio):Promise.resolve({segments:[]})]:[]),
 ]);
 const next={...checkpoint,observations:[...checkpoint.observations],audioItemsDone:[...checkpoint.audioItemsDone],transcripts:[...checkpoint.transcripts]};
 // Commit only the successful contiguous prefix. Later successes may be retried after a failure.
 for(let i=0;i<pending.length;i++){const result=results[i];if(result.status==='rejected')break;next.observations=mergeObservations(next.observations,result.value as Observation[]);next.processedFrames++;}
 if(audioPending){const result=results[pending.length];if(result.status==='fulfilled'){next.audioItemsDone.push(audio.itemIndex);next.transcripts.push({itemIndex:audio.itemIndex,segments:(result.value as {segments:Transcript['segments']}).segments});}}
 return {...next,failed:results.some(result=>result.status==='rejected')};
}
