import assert from 'node:assert/strict';
const env=new Map([['OPENAI_API_KEY','test']]);
const tests=[];
globalThis.Deno={env:{get:key=>env.get(key),set:(key,value)=>env.set(key,value),delete:key=>env.delete(key)},test:(name,fn)=>tests.push({name,fn})};
await import('../supabase/functions/video-import-worker/ai_test.ts');
const {analyzeContent}=await import('../supabase/functions/analyze-inspiration/analysis.ts');
const analysis={title:'Kyoto',summary:'Visit Nishiki Market',places:[{name:'Nishiki Market',location:'Kyoto',evidence:'Nishiki Market'},{name:'Fake',location:'',evidence:'unsupported'}],tags:[],planningNotes:[]};
const result=await analyzeContent('Visit Nishiki Market',async(url,init)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');
 const body=JSON.parse(init.body);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(analysis)}]}]});
});
assert.equal(result.provider,'openai');assert.equal(result.analysis.places.length,1);
await assert.rejects(analyzeContent('text',async()=>Response.json({status:'incomplete'})));
await assert.rejects(analyzeContent('text',async()=>Response.json({}, {status:503})));
env.delete('OPENAI_API_KEY');await assert.rejects(analyzeContent('text',async()=>{throw Error('Should not fetch');}));
for(const test of tests){await test.fn();console.log('PASS',test.name);}
console.log('PASS default OpenAI analysis, evidence filtering, incomplete responses and missing key');
