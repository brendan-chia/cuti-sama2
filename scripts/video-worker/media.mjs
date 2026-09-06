import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseScenes, selectSceneFrames } from './scenes.mjs';
export async function command(executable,args,timeoutMs=180000){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';let errors='';
  const timeout=setTimeout(()=>{child.kill();reject(new Error('Video preparation timed out.'));},timeoutMs);
  child.stdout.on('data',b=>{if(output.length<20000000)output+=b;});child.stderr.on('data',b=>{errors=(errors+b).slice(-2000);});
  child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);code===0?resolve(output):reject(new Error(`Video tool failed (${code}). ${errors.replace(/https?:\/\/\S+/g,'[URL]')}`));});
 });
}
export function validateVideoProbe(probe){
 const video=probe.streams.find(s=>s.codec_type==='video');
 const duration=Number(video?.duration??probe.format?.duration);
 if(!video||!Number.isFinite(duration)||duration<=0||duration>120.1)throw new Error('Choose a video lasting no more than two minutes.');
 if(Number(video.width)*Number(video.height)>3840*2160)throw new Error('Choose a video at 4K resolution or below.');
 return {duration,hasAudio:probe.streams.some(s=>s.codec_type==='audio')};
}
export async function prepareVideo(file,directory){
 const probe=JSON.parse(await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file]));
 const info=validateVideoProbe(probe);
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
 const frameDir=path.join(directory,'frames');await mkdir(frameDir,{recursive:true});
 // Read timestamps locally; only selected scenes are sent to vision.
 const manifest=JSON.parse(await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',file]));
 if(!manifest.frames.length)throw new Error('No video frames were found.');
 const times=manifest.frames.map(f=>Number(f.best_effort_timestamp_time));const origin=times[0];
 if(times.some(t=>!Number.isFinite(t)))throw new Error('Could not read every frame timestamp.');
 const sceneOutput=await command('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','file,pipe','-i',file,'-map','0:v:0','-vf',"scale=160:-2,select='gt(scene,0.25)',metadata=mode=print:file=-",'-an','-f','null','-']);
 const selected=selectSceneFrames(times.map(t=>t-origin),parseScenes(sceneOutput).map(s=>({...s,seconds:s.seconds-origin})),info.duration);
 const expression=selected.map(frame=>`eq(n,${frame.index})`).join('+');
 await command('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-i',file,'-map','0:v:0','-vf',`select='${expression}',scale=720:720:force_original_aspect_ratio=decrease`,'-fps_mode','passthrough','-q:v','3','-start_number','0',path.join(frameDir,'%06d.jpg')]);
 const frames=(await readdir(frameDir)).filter(f=>/^\d{6}\.jpg$/.test(f)).sort();
 if(frames.length!==selected.length)throw new Error('Selected scene extraction was incomplete. Retry the import.');
 const audio=path.join(directory,'audio.mp3');
 if(info.hasAudio)await command('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-i',file,'-map','0:a:0','-vn','-ac','1','-ar','16000','-b:a','64k',audio]);
 hash.update(JSON.stringify({version:2,selected}));
 return {hash:hash.digest('hex'),duration:info.duration,sourceFrames:times.length,frames:frames.map((name,index)=>({file:path.join(frameDir,name),...selected[index]})),audio:info.hasAudio?audio:null};
}
export async function removeJobDirectory(root,directory){
 const absoluteRoot=path.resolve(root);const absolute=path.resolve(directory);
 if(path.dirname(absolute)!==absoluteRoot||!/^[-a-f0-9]{36}$/.test(path.basename(absolute)))throw new Error('Refusing to remove an unexpected directory.');
 await rm(absolute,{recursive:true,force:true});
}
export async function downloadVideo(job,directory,python,projectUrl){
 await mkdir(directory,{recursive:true});const file=path.join(directory,'video.mp4');
 try{if((await stat(file)).size>0)return file;}catch{}
 if(job.downloadUrl){
  const url=new URL(job.downloadUrl);
  if(url.origin!==new URL(projectUrl).origin||!url.pathname.startsWith('/storage/v1/object/sign/trip-video-imports/'))throw new Error('Unexpected video storage URL.');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Video upload is unavailable. Start a new import.');
  const temporary=path.join(directory,'download.part');const {open}=await import('node:fs/promises');const handle=await open(temporary,'w');let size=0;
  try{for await(const bytes of response.body){size+=bytes.length;if(size>157286400)throw new Error('Video exceeds 150 MB.');await handle.write(bytes);}}finally{await handle.close();}
  const {rename}=await import('node:fs/promises');await rename(temporary,file);
 }else{
  const url=new URL(job.sourceUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.instagram.com'||!/^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/$/.test(url.pathname))throw new Error('Unsupported video link.');
  try{await command(python,['-m','yt_dlp','--ignore-config','--no-playlist','--use-extractors','Instagram','--socket-timeout','15','--retries','1','--max-filesize','150M','--match-filters','duration <=? 120','-f','best[ext=mp4]/best','-o',file,'--',url.toString()]);}
  catch{throw new Error('Instagram did not expose a downloadable public video for this link. Please try again later.');}
 }
 let size;try{size=(await stat(file)).size;}catch{throw new Error('The video was not downloaded. It may exceed the 2-minute or 150 MB limit, or Instagram may not expose the video.');}
 if(!size)throw new Error('Instagram returned an empty video. Please try again later.');
 if(size>157286400)throw new Error('Video exceeds 150 MB.');return file;
}
