import { MediaManifestSchema, mediaEvidenceLabel } from './media.ts';
import { mergeObservations, normalizeTranscript, normalizeElevenLabsTranscript, transcribeAudio } from './ai.ts';
import { llmConfig, llmFetch, GROQ_ENDPOINT } from '../_shared/llm.ts';

function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
const speech={text:'Tokyo Tower. Kyoto',words:[
 {type:'word',text:'Tokyo',start:1.2,end:1.8},
 {type:'spacing',text:' '},
 {type:'word',text:'Tower.',start:1.9,end:3.4},
 {type:'audio_event',text:'(music)',start:4,end:5},
 {type:'word',text:'Kyoto',start:7,end:8},
]};
Deno.test('ElevenLabs phrases retain timestamps and omit audio events',()=>{
 const result=normalizeElevenLabsTranscript(speech);
 assert(JSON.stringify(result)===JSON.stringify({text:'Tokyo Tower. Kyoto',segments:[{start:1.2,end:3.4,text:'Tokyo Tower.'},{start:7,end:8,text:'Kyoto'}]}),'Unexpected compact transcript');
 assert(normalizeElevenLabsTranscript({text:'',words:[]}).segments.length===0,'Silence should be empty');
 for(const word of [{type:'word',text:'Tokyo'},{type:'word',text:'Tokyo',start:5,end:4}]){
  let rejected=false;try{normalizeElevenLabsTranscript({text:'Tokyo',words:[word]});}catch{rejected=true;}
  assert(rejected,'Missing or reversed timestamps must be rejected');
 }
});
Deno.test('audio uses ElevenLabs multipart authentication and handles failures',async()=>{
 const previous=Deno.env.get('ELEVENLABS_API_KEY');
 const previousModel=Deno.env.get('ELEVENLABS_TRANSCRIPTION_MODEL');
 try{
  Deno.env.set('ELEVENLABS_API_KEY','test-eleven');Deno.env.delete('ELEVENLABS_TRANSCRIPTION_MODEL');
  const result=await transcribeAudio(btoa('mp3 fixture'),(async(url,init)=>{
   assert(String(url)==='https://api.elevenlabs.io/v1/speech-to-text','Wrong audio endpoint');
   const headers=new Headers(init?.headers);
   assert(headers.get('xi-api-key')==='test-eleven'&&!headers.has('authorization')&&!headers.has('content-type'),'Use ElevenLabs key and automatic multipart boundary');
   const form=init?.body;assert(form instanceof FormData,'Must upload multipart audio');
   assert(form.get('model_id')==='scribe_v2'&&form.get('timestamps_granularity')==='word','Request timed Scribe transcription');
   assert(form.get('tag_audio_events')==='false'&&form.get('diarize')==='false','Disable unused annotations');
   const file=form.get('file');assert(file instanceof File&&await file.text()==='mp3 fixture'&&file.type==='audio/mpeg','MP3 bytes must survive decoding');
   return Response.json(speech);
  }) as typeof fetch);
  assert(result.segments.length===2,'Expected phrases');
  for(const [status,expected] of [[401,'authentication'],[403,'authentication'],[429,'rate limit'],[500,'temporarily unavailable']] as const){
   let message='';try{await transcribeAudio(btoa('test'),(()=>Promise.resolve(new Response('',{status}))) as typeof fetch);}catch(error){message=(error as Error).message;}
   assert(message.includes(expected),`Missing error for ${status}`);
  }
  Deno.env.delete('ELEVENLABS_API_KEY');
  let message='';try{await transcribeAudio('',(()=>{throw new Error('Should not fetch');}) as typeof fetch);}catch(error){message=(error as Error).message;}
  assert(message.includes('ELEVENLABS_API_KEY'),'Missing key must fail before fetching');
 }finally{
  if(previous===undefined)Deno.env.delete('ELEVENLABS_API_KEY');else Deno.env.set('ELEVENLABS_API_KEY',previous);
  if(previousModel===undefined)Deno.env.delete('ELEVENLABS_TRANSCRIPTION_MODEL');else Deno.env.set('ELEVENLABS_TRANSCRIPTION_MODEL',previousModel);
 }
});
Deno.test('all LLM purposes use Groq and preserve native request fields',async()=>{
 for(const purpose of ['structured','itinerary','vision'] as const){
  const config=llmConfig(purpose);assert(config.provider==='groq'&&config.endpoint===GROQ_ENDPOINT,'All non-audio AI uses Groq');
 }
 const body=JSON.stringify({max_completion_tokens:1800,response_format:{type:'json_schema',json_schema:{name:'test',strict:true,schema:{type:'object'}}}});
 await llmFetch(((_url,init)=>{assert(init?.body===body,'Do not rewrite Groq schema or token limits');return Promise.resolve(Response.json({}));}) as typeof fetch)(GROQ_ENDPOINT,{method:'POST',body});
});
Deno.test('keeps real speech timestamps and removes no-speech hallucinations',()=>{
 const result=normalizeTranscript({text:'Tokyo Tower fake',segments:[{start:1.2,end:3.4,text:' Tokyo Tower ',no_speech_prob:0.01},{start:4,end:5,text:'fake',no_speech_prob:0.99}]});
 if(JSON.stringify(result)!==JSON.stringify({text:'Tokyo Tower',segments:[{start:1.2,end:3.4,text:'Tokyo Tower'}]}))throw new Error('Timestamped transcript mismatch');
});
Deno.test('deduplicates place evidence without skipping video frames',()=>{
 const result=mergeObservations([{name:'Tokyo Tower',evidence:'Frame at 1s: sign'}],[{name:'tokyo tower',evidence:'Frame at 2s: sign'},{name:'Meiji Jingu',evidence:'Frame at 3s: sign'}]);
 if(result.length!==2||result[0].evidence!=='Frame at 1s: sign')throw new Error('Evidence merge failed');
});

Deno.test('photo and mixed carousel manifests preserve item identity and reject incomplete coverage',()=>{
 const manifest={items:[{kind:'image',hasAudio:false},{kind:'video',hasAudio:true}],frames:[{itemIndex:0,kind:'image',seconds:0},{itemIndex:1,kind:'video',seconds:1.25}]};
 const parsed=MediaManifestSchema.parse(manifest);
 assert(mediaEvidenceLabel(parsed.frames[0])==='Photo 1','Photos must not have fake video timestamps');
 assert(mediaEvidenceLabel(parsed.frames[1])==='Video 2 at 1.250s','Video evidence must identify its carousel item');
 assert(!MediaManifestSchema.safeParse({...manifest,frames:manifest.frames.slice(0,1)}).success,'Every carousel item needs coverage');
 assert(!MediaManifestSchema.safeParse({...manifest,items:[{kind:'image',hasAudio:true},manifest.items[1]]}).success,'Photos cannot have audio');
});
