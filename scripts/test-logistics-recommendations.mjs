import assert from 'node:assert/strict';
let handler;
let cacheError = false;
let providerStatus = 200;
let providerCalls = 0;
const env = new Map([['SUPABASE_URL','https://fixture.supabase.co'],['SUPABASE_ANON_KEY','fixture-key'],['GROQ_API_KEY','test-key']]);
globalThis.Deno={env:{get:key=>env.get(key)},serve:fn=>{handler=fn;}};
const room={selectedCountryCode:'JP',period:{startsOn:'2027-03-10',endsOn:'2027-03-15'},members:[{}],budgetSummary:{comfortablePerPerson:10000},attractionIds:['jp-sensoji'],importedPlaces:[]};
const journey={label:'Flight estimate',reason:'Near your stops.',mode:'flight',departureLocation:'Kuala Lumpur',arrivalLocation:'Tokyo',departureAt:'2027-03-10T07:00:00+08:00',arrivalAt:'2027-03-10T15:00:00+09:00',cost:850};
const stays=['cheap','mid-range','expensive'].map((category,i)=>({category,name:'Stay '+i,area:'Tokyo',latitude:35,longitude:139,totalCost:500+i*500,reason:'Near your stops.'}));
globalThis.fetch=async(url,init)=>{
 const path=String(url);
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 if(path.includes('/auth/v1/user'))return json({id:'11111111-1111-4111-8111-111111111111'});
 if(path.includes('/rpc/get_trip_quest'))return json(room);
 if(path.includes('/trip_budget_basis'))return cacheError?json({message:'Cache unavailable',code:'XX000'},500):json(null);
 assert.equal(path,'https://api.groq.com/openai/v1/chat/completions');providerCalls++;
 if(providerStatus!==200)return json({error:{message:'private provider diagnostic'}},providerStatus);
 const input=JSON.parse(JSON.parse(init.body).messages[1].content);
 return json({choices:[{message:{content:JSON.stringify({transport:input.kind==='transport'?[journey]:[],stays:input.kind==='stays'?stays:[]})}}]});
};
await import('../supabase/functions/recommend-logistics/index.ts');
async function request(kind){const r=await handler(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify({tripId:'11111111-1111-4111-8111-111111111111',kind,direction:'arrival'})}));return {status:r.status,body:await r.json()};}
for(const count of [1,2])for(const kind of ['transport','stays']){
 room.members=Array.from({length:count},()=>({}));cacheError=true;
 const result=await request(kind);assert.equal(result.status,200);assert.ok(result.body[kind].length>0);console.log('PASS cache failure still recommends '+kind+' for '+count+' travellers');
}
cacheError=false;providerStatus=429;const limited=await request('transport');assert.equal(limited.status,429);assert.match(limited.body.error,/too many requests/);assert.ok(!limited.body.error.includes('private'));console.log('PASS actionable rate-limit response');
providerStatus=200;env.delete('GROQ_API_KEY');const unconfigured=await request('stays');assert.equal(unconfigured.status,503);assert.match(unconfigured.body.error,/not configured/);console.log('PASS configuration error reaches app safely');
const before=providerCalls;room.period.endsOn=room.period.startsOn;const oneDay=await request('stays');assert.equal(oneDay.status,200);assert.deepEqual(oneDay.body.stays,[]);assert.equal(providerCalls,before);console.log('PASS one-day trip skips accommodation AI');
