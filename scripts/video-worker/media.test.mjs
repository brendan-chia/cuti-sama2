import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { command, prepareVideo, validateVideoProbe, removeJobDirectory } from './media.mjs';
import { selectSceneFrames } from './scenes.mjs';
import { normalizeVideoUrl } from '../../packages/contracts/src/social-video.ts';
import { resolveVideoUrl } from './ingestion.mjs';
test('selects at most twenty scenes across a long video, including real cuts',()=>{
 const times=Array.from({length:3600},(_,i)=>i/30);
 const frames=selectSceneFrames(times,[{seconds:15,score:0.8},{seconds:67,score:0.9}],120);
 assert.equal(frames.length,20);assert.equal(new Set(frames.map(f=>f.index)).size,20);
 assert.ok(frames.some(f=>f.reason==='scene-change'&&Math.abs(f.seconds-15.2)<0.04));
 assert.equal(frames[0].seconds,0);assert.equal(frames.at(-1).index,3599);
});
test('normalizes both providers and blocks external short-link redirects',async()=>{
 assert.equal(normalizeVideoUrl('https://instagram.com/reels/abc/?tracking=1').url,'https://www.instagram.com/reel/abc/');
 assert.equal(normalizeVideoUrl('https://m.tiktok.com/@test/video/123').platform,'tiktok');
 assert.throws(()=>normalizeVideoUrl('https://www.tiktok.com.evil.com/@test/video/123'));
 assert.throws(()=>normalizeVideoUrl('https://www.instagram.com/explore/'));
 await assert.rejects(resolveVideoUrl('https://vm.tiktok.com/abc/',async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})));
 const resolved=await resolveVideoUrl('https://vm.tiktok.com/abc/',async()=>new Response(null,{status:302,headers:{location:'https://www.tiktok.com/@test/video/123'}}));
 assert.equal(resolved.url,'https://www.tiktok.com/@test/video/123');
});
test('detects real scene cuts and extracts only selected frames from a silent video',async()=>{
 const root=path.resolve('.tmp/video-worker-tests');const dir=path.join(root,'33333333-3333-4333-8333-333333333333');await mkdir(dir,{recursive:true});
 try{
  const file=path.join(dir,'fixture.mp4');
  await command('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','color=black:s=320x240:r=10:d=3','-f','lavfi','-i','color=white:s=320x240:r=10:d=4','-f','lavfi','-i','color=blue:s=320x240:r=10:d=5','-filter_complex','[0:v][1:v][2:v]concat=n=3:v=1:a=0','-c:v','libx264',file]);
  const result=await prepareVideo(file,dir);
  assert.equal(result.frames.length,8);assert.equal(result.sourceFrames,120);assert.equal(result.audio,null);
  assert.ok(result.frames.some(f=>f.reason==='scene-change'));
 }finally{await removeJobDirectory(root,dir);}
});
test('unknown Instagram duration passes while known over-limit duration is rejected',async()=>{
 const python=path.resolve('.tmp/video-worker-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 await command(python,['-c',"from yt_dlp.utils import match_filter_func; f=match_filter_func('duration <=? 120'); assert f({'duration': None}) is None; assert f({'duration': 112}) is None; assert f({'duration': 121}) is not None"]);
});
test('rejects long or non-video files without silently sampling',()=>{
 assert.throws(()=>validateVideoProbe({streams:[],format:{duration:30}}));
 assert.throws(()=>validateVideoProbe({streams:[{codec_type:'video',width:640,height:480}],format:{duration:121}}));
 assert.equal(validateVideoProbe({streams:[{codec_type:'video',width:640,height:480}],format:{duration:30}}).hasAudio,false);
});
test('extracts every frame and full audio from a real short video',async()=>{
 const root=path.resolve('.tmp/video-worker-tests');await mkdir(root,{recursive:true});
 const dir=path.join(root,'11111111-1111-4111-8111-111111111111');await mkdir(dir,{recursive:true});
 try{
  const video=path.join(dir,'fixture.mp4');
  await command('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','testsrc=size=320x240:rate=4:duration=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',video]);
  const result=await prepareVideo(video,dir);
  assert.equal(result.frames.length,8);assert.ok(result.audio);assert.equal(result.frames[7].seconds,1.75);
  assert.match(result.hash,/^[a-f0-9]{64}$/);
 }finally{await removeJobDirectory(root,dir);}
});
test('cleanup refuses a path outside its exact job directory',async()=>{
 await assert.rejects(removeJobDirectory('.tmp/video-worker-tests','.tmp'));
});
