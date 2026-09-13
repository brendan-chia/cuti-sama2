import assert from 'node:assert/strict';
import { handleSavedMedia } from '../supabase/functions/video-import-worker/saved-media.ts';
globalThis.Deno={env:{get:key=>key==='OPENAI_API_KEY'?'test':undefined}};
let idea={caption:'Visit Tokyo Tower',media_state:{queued:false}};
let changed=false;
const updates=[];
const db={from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:idea,error:null})}),update:values=>({eq(){return this;},select:async()=>{updates.push(values);if(!changed)idea={...idea,...values};return {data:changed?[]:[{id:'id'}],error:null};}})})};
const base={importId:'id',lease:'lease'};
assert.equal((await handleSavedMedia(db,{...base,action:'finish'})).status,409);
const manifest={items:[{kind:'image',hasAudio:false}],frames:[{itemIndex:0,kind:'image',seconds:0}]};
assert.equal((await handleSavedMedia(db,{...base,action:'start',hash:'hash',totalFrames:1,manifest})).status,200);
assert.equal((await handleSavedMedia(db,{...base,action:'finish'})).status,409);
assert.equal((await handleSavedMedia(db,{...base,action:'audio',itemIndex:0,audio:'AAAA'})).status,400);
await handleSavedMedia(db,{...base,action:'audio',itemIndex:0,noAudio:true});
assert.equal((await handleSavedMedia(db,{...base,action:'frame',index:1,image:'data:image/jpeg;base64,AAAA'})).status,409);
const original=globalThis.fetch;
globalThis.fetch=async(url)=>{assert.equal(url,'https://api.openai.com/v1/chat/completions');return Response.json({choices:[{message:{content:JSON.stringify({places:[{name:'Tokyo Tower',evidence:'Photo 1: visible sign'}]})}}]});};
try {
 await handleSavedMedia(db,{...base,action:'frame',index:0,image:'data:image/jpeg;base64,AAAA'});
 changed=true;assert.equal((await handleSavedMedia(db,{...base,action:'finish'})).status,409);
 changed=false;assert.equal((await handleSavedMedia(db,{...base,action:'finish'})).status,200);
 assert.equal(idea.status,'ready');assert.equal(idea.provider,'openai');assert.equal(idea.analysis.places[0].name,'Tokyo Tower');assert.equal(idea.media_state,null);
 idea=null;assert.equal((await handleSavedMedia(db,{...base,action:'heartbeat'})).status,409);
} finally {globalThis.fetch=original;}
console.log('PASS saved-media completion, missing audio, frame order, stale updates, cleanup and deleted posts');
