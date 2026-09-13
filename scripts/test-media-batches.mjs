import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBatch } from '../supabase/functions/video-import-worker/batch.ts';
import { mediaBatches } from './video-worker/batches.mjs';
const manifest={items:[{kind:'video',hasAudio:true}],frames:[0,1,2].map(seconds=>({kind:'video',itemIndex:0,seconds}))};
const checkpoint={processedFrames:0,observations:[],audioItemsDone:[],transcripts:[]};
const batch={frames:[0,1,2].map(index=>({index,image:'image'})),audio:{itemIndex:0,audio:'audio'}};
test('starts three frames and audio together, then merges frame results in order',async()=>{
 const releases=[];let active=0;let peak=0;
 const task=value=>{active++;peak=Math.max(peak,active);return new Promise(resolve=>releases.push(()=>{active--;resolve(value);}));};
 const pending=analyzeBatch(batch,manifest,checkpoint,(_image,frame)=>task([{name:`Place ${frame.seconds}`,evidence:'sign'}]),()=>task({segments:[]}));
 assert.equal(releases.length,4);assert.equal(peak,4);
 releases.reverse().forEach(release=>release());
 const result=await pending;assert.equal(result.processedFrames,3);assert.equal(result.failed,false);
 assert.deepEqual(result.observations.map(p=>p.name),['Place 0','Place 1','Place 2']);assert.deepEqual(result.audioItemsDone,[0]);
});
test('partial failure retains contiguous frames and audio, retry skips completed calls',async()=>{
 const first=await analyzeBatch(batch,manifest,checkpoint,async(_image,frame)=>{if(frame.seconds===1)throw Error('rate limit');return [{name:`Place ${frame.seconds}`,evidence:'sign'}];},async()=>({segments:[]}));
 assert.equal(first.failed,true);assert.equal(first.processedFrames,1);assert.deepEqual(first.audioItemsDone,[0]);
 const called=[];
 const second=await analyzeBatch(batch,manifest,first,async(_image,frame)=>{called.push(frame.seconds);return [];},async()=>{throw Error('Audio must not repeat');});
 assert.deepEqual(called,[1,2]);assert.equal(second.processedFrames,3);assert.equal(second.failed,false);
});
test('audio failure preserves all frame results for audio-only retry',async()=>{
 const first=await analyzeBatch(batch,manifest,checkpoint,async()=>[],async()=>{throw Error('audio rate limit');});
 assert.equal(first.processedFrames,3);assert.equal(first.failed,true);
 const next=await analyzeBatch(batch,manifest,first,async()=>{throw Error('Frames must not repeat');},async()=>({segments:[]}));
 assert.equal(next.failed,false);assert.deepEqual(next.audioItemsDone,[0]);
});
test('invalid frame gaps and audio manifests are rejected before AI calls',async()=>{
 await assert.rejects(analyzeBatch({...batch,frames:[batch.frames[1]]},manifest,checkpoint));
 await assert.rejects(analyzeBatch({...batch,audio:{itemIndex:9,noAudio:true}},manifest,checkpoint));
});
test('worker batches cover every remaining frame and audio within request size limits',async()=>{
 const media={frames:Array.from({length:8},(_,i)=>({file:String(i)})),audios:[{itemIndex:0,file:'audio'},{itemIndex:1,file:null}]};
 const batches=[];
 for await(const item of mediaBatches(media,{processedFrames:1,audioItemsDone:[]},async file=>Buffer.alloc(file==='audio'?1500000:700000)))batches.push(item);
 assert.deepEqual(batches.flatMap(item=>item.frames.map(f=>f.index)),[1,2,3,4,5,6,7]);
 assert.deepEqual(batches.filter(item=>item.audio).map(item=>item.audio.itemIndex),[0,1]);
 assert.ok(batches[0].audio&&batches[0].frames.length>0);
 for(const item of batches){assert.ok(item.frames.length<=3);assert.ok(Buffer.byteLength(JSON.stringify(item))<=3900000);}
});
