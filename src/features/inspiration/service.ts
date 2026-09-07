import { z } from 'zod';
import { InspirationInputSchema, InspirationSchema } from '../../../packages/contracts/src/inspiration';
import { ensureAnonymousSession } from '@/lib/auth';
import { requireSupabase } from '@/lib/supabase';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
export async function loadInspiration() {
  await ensureAnonymousSession();
  const {data,error}=await requireSupabase().from('saved_inspiration').select('*').order('created_at',{ascending:false});
  if(error)throw new Error(error.message);
  return z.array(InspirationSchema).parse(data);
}
export async function saveInspiration(input:{sourceUrl:string;folder:string;caption:string}) {
  const value=InspirationInputSchema.parse(input);await ensureAnonymousSession();
  const {data,error}=await requireSupabase().rpc('save_inspiration',{p_url:value.sourceUrl,p_folder:value.folder,p_caption:value.caption});
  if(error)throw new Error(error.message);return z.uuid().parse(data);
}
export async function analyzeInspiration(id:string) {
  await ensureAnonymousSession();
  const {error}=await requireSupabase().functions.invoke('analyze-inspiration',{body:{id}});
  if(error)throw new Error(await edgeFunctionErrorMessage(error,'Link saved, but analysis could not start. Use Retry analysis.'));
}
export async function removeInspiration(id:string) {
  await ensureAnonymousSession();const {error}=await requireSupabase().from('saved_inspiration').delete().eq('id',id);
  if(error)throw new Error(error.message);
}
