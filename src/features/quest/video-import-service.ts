import { File } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';
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
export async function startVideoImport(tripId:string,sourceUrl:string,caption:string,asset?:ImagePickerAsset){
 if(asset&&((asset.fileSize??0)>157286400||(asset.duration??0)>120000))throw new Error('Choose a video under 150 MB and no longer than two minutes.');
 const data=await request({action:'create',tripId,requestId:createUuid(),sourceUrl,caption,upload:Boolean(asset)});
 if(!asset)return VideoImportStatusSchema.parse(data);
 try{
  const bytes=Platform.OS==='web'?await (asset.file??await (await fetch(asset.uri)).blob()).arrayBuffer():await new File(asset.uri).arrayBuffer();
  if(bytes.byteLength>157286400)throw new Error('Choose a video under 150 MB.');
  const contentType=asset.mimeType==='video/quicktime'?'video/quicktime':asset.mimeType==='video/webm'?'video/webm':'video/mp4';
  const upload=await requireSupabase().storage.from('trip-video-imports').uploadToSignedUrl(data.path,data.token,bytes,{contentType});
  if(upload.error)throw upload.error;
  return VideoImportStatusSchema.parse(await request({action:'uploaded',importId:data.importId}));
 }catch(error){await videoStatus(data.importId,'cancel').catch(()=>{});throw error;}
}
