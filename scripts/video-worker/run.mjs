import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadVideo, prepareVideo, removeJobDirectory } from './media.mjs';
import { ingestPost, downloadPost } from './ingestion.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.loadEnvFile(path.join(root,'.env.video-worker.local'));
const projectUrl=process.env.VIDEO_WORKER_SUPABASE_URL;const token=process.env.VIDEO_WORKER_TOKEN;
if(!projectUrl||!token)throw new Error('Run the video worker setup first.');
const python=process.env.VIDEO_WORKER_PYTHON||path.join(root,'.tmp/video-worker-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const workRoot=path.join(root,'.tmp/video-worker-jobs');await mkdir(workRoot,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(body,retry=true){
 for(let attempt=0;;attempt++){
  try{
   const response=await fetch(`${projectUrl}/functions/v1/video-import-worker`,{method:'POST',headers:{'Content-Type':'application/json','x-video-worker-token':token},body:JSON.stringify(body),signal:AbortSignal.timeout(145000)});
   const data=await response.json();
   if(response.ok)return data;
   if(response.status<500){const e=new Error(data.error??'Worker request rejected.');e.permanent=true;throw e;}
   throw new Error(data.error??'Worker request failed.');
  }catch(error){if(error.permanent||!retry||attempt>=6)throw error;console.log(`Waiting before retry ${attempt+1}…`);await sleep(Math.min(60000,2000*2**attempt));}
 }
}
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
await writeFile(path.join(root,'.tmp/video-worker.pid'),String(process.pid));
console.log('Local video worker running. Keep this process on while videos are analysed.');
try{while(!stopping){
 let job;
 try{job=await api({action:'claim'});}catch(error){console.error(error.message);await sleep(15000);continue;}
 if(!job){if(process.argv.includes('--once'))break;await sleep(5000);continue;}
 const directory=path.join(workRoot,job.import_id);let leaseLost=false;
 const base={importId:job.import_id,lease:job.lease};
 const heartbeat=setInterval(()=>void api({...base,action:'heartbeat'},false).catch(e=>{if(e.permanent)leaseLost=true;}),30000);
 try{
  console.log(`Processing import ${job.import_id}`);
  let file;
  if(job.downloadUrl){file=await downloadVideo(job,directory,python,projectUrl);}
  else{
   const post=await ingestPost(job.sourceUrl,directory,python);
   await api({...base,action:'ingest',post});
   file=await downloadPost(post,directory,python);
  }
  const media=await prepareVideo(file,directory);
  const checkpoint=await api({...base,action:'start',hash:media.hash,totalFrames:media.frames.length,pipelineVersion:2});
  if(!checkpoint.audioDone){await api({...base,action:'audio',...(media.audio?{audio:(await readFile(media.audio)).toString('base64')}:{noAudio:true})});}
  for(let index=checkpoint.processedFrames;index<media.frames.length;index++){
   if(stopping||leaseLost)throw new Error('Worker stopped. Retry the import to resume.');
   const frame=media.frames[index];await api({...base,action:'frame',index,seconds:frame.seconds,image:`data:image/jpeg;base64,${(await readFile(frame.file)).toString('base64')}`});
   console.log(`Selected scenes: ${index+1}/${media.frames.length}`);
  }
  await api({...base,action:'finish'});console.log('Caption, audio and key-scene analysis complete.');
 }catch(error){console.error(error.message);try{await api({...base,action:'fail',message:String(error.message).slice(0,500)},false);}catch{}}
 finally{clearInterval(heartbeat);await removeJobDirectory(workRoot,directory);}
 if(process.argv.includes('--once'))break;
}}finally{await rm(path.join(root,'.tmp/video-worker.pid'),{force:true});}
