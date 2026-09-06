import { mergeObservations, normalizeTranscript } from './ai.ts';
Deno.test('keeps real speech timestamps and removes no-speech hallucinations',()=>{
 const result=normalizeTranscript({text:'Tokyo Tower fake',segments:[{start:1.2,end:3.4,text:' Tokyo Tower ',no_speech_prob:0.01},{start:4,end:5,text:'fake',no_speech_prob:0.99}]});
 if(JSON.stringify(result)!==JSON.stringify({text:'Tokyo Tower',segments:[{start:1.2,end:3.4,text:'Tokyo Tower'}]}))throw new Error('Timestamped transcript mismatch');
});
Deno.test('deduplicates place evidence without skipping video frames',()=>{
 const result=mergeObservations([{name:'Tokyo Tower',evidence:'Frame at 1s: sign'}],[{name:'tokyo tower',evidence:'Frame at 2s: sign'},{name:'Meiji Jingu',evidence:'Frame at 3s: sign'}]);
 if(result.length!==2||result[0].evidence!=='Frame at 1s: sign')throw new Error('Evidence merge failed');
});
