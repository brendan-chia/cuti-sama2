import { readFile } from 'node:fs/promises';
// One HTTP request owns each checkpoint write; concurrency happens inside the Edge Function.
export async function* mediaBatches(media, checkpoint, read=readFile) {
 let index=checkpoint.processedFrames;
 const audios=media.audios.filter(audio=>!checkpoint.audioItemsDone.includes(audio.itemIndex));
 let audioIndex=0;
 while(index<media.frames.length||audioIndex<audios.length){
  const batch={frames:[]};
  if(audioIndex<audios.length){const item=audios[audioIndex++];batch.audio={itemIndex:item.itemIndex,...(item.file?{audio:(await read(item.file)).toString('base64')}:{noAudio:true})};}
  while(index<media.frames.length&&batch.frames.length<3){
   const frame={index,image:`data:image/jpeg;base64,${(await read(media.frames[index].file)).toString('base64')}`};
   // Leave room for action, scope, ID and lease within the 4 MB endpoint limit.
   if(Buffer.byteLength(JSON.stringify({...batch,frames:[...batch.frames,frame]}))>3_900_000)break;
   batch.frames.push(frame);index++;
  }
  if(!batch.frames.length&&!batch.audio)throw new Error('Prepared image exceeds the media batch limit.');
  yield batch;
 }
}
