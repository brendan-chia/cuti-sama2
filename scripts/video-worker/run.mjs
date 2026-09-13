import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadVideo, removeJobDirectory } from './media.mjs';
import { ingestPost, downloadPost } from './ingestion.mjs';
import { mediaBatches } from './batches.mjs';
import { preparePost } from './post-media.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.loadEnvFile(path.join(root,'.env.video-worker.local'));
const projectUrl=process.env.VIDEO_WORKER_SUPABASE_URL;const token=process.env.VIDEO_WORKER_TOKEN;
if(!projectUrl||!token)throw new Error('Run the video worker setup first.');
const python=process.env.VIDEO_WORKER_PYTHON||path.join(root,'.tmp/video-worker-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const workRoot=path.join(root,'.tmp/video-worker-jobs');await mkdir(workRoot,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let scope;
async function api(body,retry=true){
 body={...body,...(scope?{scope}:{})};
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
console.log('Local post worker running. Keep this process on while posts and Reels are analysed.');
try{while(!stopping){
 let job;
 try{scope='inspiration';job=await api({action:'claim'});if(!job){scope=undefined;job=await api({action:'claim'});}}catch(error){console.error(error.message);await sleep(15000);continue;}
 if(!job){if(process.argv.includes('--once'))break;await sleep(5000);continue;}
 const directory=path.join(workRoot,job.import_id);let leaseLost=false;
 const base={importId:job.import_id,lease:job.lease};
 const heartbeat=setInterval(()=>void api({...base,action:'heartbeat'},false).catch(e=>{if(e.permanent)leaseLost=true;}),30000);
 try{
  console.log(`Processing import ${job.import_id}`);
  let assets;
  if(job.downloadUrl){assets=[{kind:'video',file:await downloadVideo(job,directory,python,projectUrl)}];}
  else{
   const post=await ingestPost(job.sourceUrl,directory,python);
   await api({...base,action:'ingest',post});
   assets=await downloadPost(post,directory,python);
  }
  const media=await preparePost(assets,directory);
  const checkpoint=await api({...base,action:'start',hash:media.hash,totalFrames:media.frames.length,pipelineVersion:3,manifest:media.manifest});
  const analysisStarted=Date.now();
  for await(const batch of mediaBatches(media,checkpoint)){
   if(stopping||leaseLost)throw new Error('Worker stopped. Retry the import to resume.');
   await api({...base,action:'batch',batch});
   console.log(`Analysis batch complete: ${batch.frames.length} frames${batch.audio?', audio':''}.`);
  }
  console.log(`Media AI stage: ${Math.round((Date.now()-analysisStarted)/1000)}s`);
  await api({...base,action:'finish'});console.log('Post image, caption and available audio analysis complete.');
 }catch(error){console.error(error.message);try{await api({...base,action:'fail',message:String(error.message).slice(0,500)},false);}catch{}}
 finally{clearInterval(heartbeat);await removeJobDirectory(workRoot,directory);}
 if(process.argv.includes('--once'))break;
}}finally{await rm(path.join(root,'.tmp/video-worker.pid'),{force:true});}
