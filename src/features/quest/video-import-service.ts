import { VideoImportStatusSchema } from '../../../packages/contracts/src/video-import';
import { ensureAnonymousSession } from '@/lib/auth';
import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';
async function request(body: Record<string, unknown>) {
 await ensureAnonymousSession();
 const {data,error}=await requireSupabase().functions.invoke('video-import',{body});
 if(error)throw new Error(await edgeFunctionErrorMessage(error,'Could not update the video import.'));
 if(data?.error)throw new Error(data.error);
 return data;
}
export async function videoStatus(importId:string,action:'status'|'cancel'|'retry'='status'){return VideoImportStatusSchema.parse(await request({action,importId}));}
export async function latestVideoImport(tripId:string){const data=await request({action:'latest',tripId});return data?VideoImportStatusSchema.parse(data):null;}
export async function startVideoImport(tripId:string,sourceUrl:string,caption:string){
 return VideoImportStatusSchema.parse(await request({action:'create',tripId,requestId:createUuid(),sourceUrl,caption}));
}
