import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { command, removeJobDirectory } from './media.mjs';
import { preparePost, visionBudgets } from './post-media.mjs';

test('every carousel item gets vision coverage within twenty calls', () => {
  assert.deepEqual(visionBudgets([{kind:'image'},{kind:'video'},{kind:'video'}]),[1,10,9]);
  assert.deepEqual(visionBudgets(Array.from({length:20},()=>({kind:'image'}))),Array(20).fill(1));
  assert.throws(()=>visionBudgets(Array(21).fill({kind:'image'})));
});
test('prepares real photo and video assets with correct item labels and audio', async()=>{
  const root=path.resolve('.tmp/video-worker-tests');const dir=path.join(root,'44444444-4444-4444-8444-444444444444');await mkdir(dir,{recursive:true});
  try {
    const photo=path.join(dir,'photo.jpg');const video=path.join(dir,'video.mp4');
    await command('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','color=blue:s=640x480','-frames:v','1',photo]);
    await command('ffmpeg',['-nostdin','-v','error','-y','-f','lavfi','-i','testsrc=size=320x240:rate=4:duration=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',video]);
    const post=await preparePost([{kind:'image',file:photo},{kind:'video',file:video}],dir);
    assert.deepEqual(post.manifest.items,[{kind:'image',hasAudio:false},{kind:'video',hasAudio:true}]);
    assert.deepEqual(post.manifest.frames[0],{itemIndex:0,kind:'image',seconds:0});
    assert.ok(post.manifest.frames.slice(1).every(f=>f.itemIndex===1&&f.kind==='video'));
    assert.equal(post.audios[0].file,null);assert.ok(post.audios[1].file);assert.equal(post.frames.length,9);
    const retry=await preparePost([{kind:'image',file:photo},{kind:'video',file:video}],dir);
    assert.equal(retry.hash,post.hash);
  } finally {await removeJobDirectory(root,dir);}
});
