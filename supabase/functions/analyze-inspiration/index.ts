import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authenticatedClient,corsHeaders,json } from '../_shared/invites.ts';
import { readInspiration } from './reader.ts';
import { analyzeContent } from './analysis.ts';
declare const EdgeRuntime:{waitUntil(promise:Promise<unknown>):void};

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 try {
  const client=await authenticatedClient(request);if(!client)return json({error:'Sign in to your travel folder.'},401);
  const {id}=z.object({id:z.uuid()}).strict().parse(await request.json());
  const owned=await client.from('saved_inspiration').select('*').eq('id',id).maybeSingle();
  if(owned.error||!owned.data)return json({error:'Saved link unavailable.'},404);
  if(owned.data.status==='ready')return json({status:'ready'});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const lease=crypto.randomUUID(); const stale=new Date(Date.now()-120000).toISOString();
  if(owned.data.status==='analyzing' && owned.data.updated_at>stale)return json({status:'analyzing'});
  if(['failed','needs_input'].includes(owned.data.status) && Date.now()-Date.parse(owned.data.updated_at)<15000)return json({error:'Wait a few seconds before retrying.'},429);
  const claimed=await admin.from('saved_inspiration').update({status:'analyzing',lease,updated_at:new Date().toISOString(),message:'Reading public post content…'}).eq('id',id).eq('user_id',owned.data.user_id).eq('updated_at',owned.data.updated_at).select().maybeSingle();
  if(claimed.error)throw claimed.error;if(!claimed.data)return json({status:'analyzing'});
  const job=(async()=>{
    let source='';
    try {
      try{source=await readInspiration(owned.data.source_url);}catch{/* Preserve link and use supplied caption. */}
      const text=[owned.data.caption,source].filter(Boolean).join('\n').slice(0,18000);
      if(!text.trim()) {
        await admin.from('saved_inspiration').update({status:'needs_input',message:'Link saved. This post did not expose readable public text. Add its caption or transcript and retry.',lease:null,updated_at:new Date().toISOString()}).eq('id',id).eq('lease',lease);return;
      }
      const result=await analyzeContent(text);
      const saved=await admin.from('saved_inspiration').update({...result,status:'ready',source_text:text,message:source?'Analyzed from public text and any caption you supplied.':'Analyzed from your supplied caption; the linked media was not read.',lease:null,updated_at:new Date().toISOString()}).eq('id',id).eq('lease',lease);
      if(saved.error)throw saved.error;
    }catch{
      await admin.from('saved_inspiration').update({status:'failed',source_text:[owned.data.caption,source].filter(Boolean).join('\n').slice(0,18000),message:'Analysis could not finish. Your link is saved. Please retry later.',lease:null,updated_at:new Date().toISOString()}).eq('id',id).eq('lease',lease);
    }
  })();
  EdgeRuntime.waitUntil(job);
  return json({status:'analyzing'},202);
 }catch{return json({error:'Could not start analysis. Your saved links are still in your folder.'},400);}
});
