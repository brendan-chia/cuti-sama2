import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { command, prepareVideo, validateVideoProbe, removeJobDirectory } from './media.mjs';
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
