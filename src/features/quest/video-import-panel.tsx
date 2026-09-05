import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { VideoImportStatus } from '../../../packages/contracts/src/video-import';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { confirmTripPlaces } from './place-import-service';
import { latestVideoImport, startVideoImport, videoStatus } from './video-import-service';
import { questStyles as s } from './quest-styles';
export function VideoImportPanel({tripId,sourceUrl,caption,disabled,onConfirmed}:{tripId:string;sourceUrl:string;caption:string;disabled?:boolean;onConfirmed:(room:QuestRoom)=>void}){
 const [job,setJob]=useState<VideoImportStatus|null>(null);const [asset,setAsset]=useState<ImagePicker.ImagePickerAsset>();const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [selected,setSelected]=useState<string[]>([]);
 useEffect(()=>{let alive=true;void latestVideoImport(tripId).then(data=>{if(alive)setJob(data);}).catch(()=>{});return()=>{alive=false;};},[tripId]);
 const jobId=job?.importId;
 const active=job&&['uploading','queued','running'].includes(job.state);
 useEffect(()=>{
  if(!active||!jobId)return;let alive=true;let polling=false;
  const timer=setInterval(()=>{if(polling)return;polling=true;void videoStatus(jobId).then(next=>{if(alive){setJob(next);setError(null);}}).catch(()=>{if(alive)setError('Progress could not refresh. Reconnecting…');}).finally(()=>{polling=false;});},4000);
  return()=>{alive=false;clearInterval(timer);};
 },[active,jobId]);
 async function pick(){try{const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['videos']});if(!picked.canceled){setAsset(picked.assets[0]);setError(null);}}catch{setError('Could not open your videos.');}}
 async function start(){if(busy)return;setBusy(true);setError(null);setSelected([]);try{setJob(await startVideoImport(tripId,sourceUrl.trim(),caption.trim(),asset));}catch(cause){setError(cause instanceof Error?cause.message:'Video import failed.');}finally{setBusy(false);}}
 async function change(action:'cancel'|'retry'){if(!job||busy)return;setBusy(true);try{setJob(await videoStatus(job.importId,action));setError(null);}catch(cause){setError(cause instanceof Error?cause.message:'Could not update the import.');}finally{setBusy(false);}}
 async function confirm(){if(!job||busy)return;setBusy(true);try{onConfirmed(await confirmTripPlaces(job.importId,selected));setJob(null);setSelected([]);setAsset(undefined);}catch(cause){setError(cause instanceof Error?cause.message:'Could not confirm places.');}finally{setBusy(false);}}
 return <View style={s.stack} testID="video-import-panel">
  <Text style={s.heading}>Read the whole video</Text>
  <Text style={s.small}>Transcribe the available audio and inspect every frame for text and landmarks. Up to 2 minutes, 150 MB and 7,200 frames. Your computer’s video worker must stay running.</Text>
  <Text style={s.small}>Audio and each frame are sent to the AI provider. This can take time and uses your AI API allowance. Only confirmed places are shared with your crew.</Text>
  {!active?<><AppButton label={asset?'Choose another video':'Upload a video'} variant="secondary" disabled={disabled||busy} onPress={()=>void pick()}/>{asset?<><Text style={s.small}>{asset.fileName??'Selected video'}</Text><AppButton label="Use the link instead" variant="secondary" onPress={()=>setAsset(undefined)}/></>:null}<AppButton label="Analyse audio & every frame" disabled={disabled||busy||(!sourceUrl.trim()&&!asset)} loading={busy} onPress={()=>void start()}/></>:null}
  {job?<View style={s.success}>
   <Text accessibilityLiveRegion="polite" style={s.body}>{job.message}</Text>
   {active&&!job.workerOnline?<Text style={s.small}>The local worker is offline. Start it on your computer; this job will wait in the queue.</Text>:null}
   {job.totalFrames>0?<Text style={s.strong}>{job.processedFrames} / {job.totalFrames} frames · Audio {job.audioDone?'complete':'pending'}</Text>:null}
   {active||job.state==='failed'?<AppButton label="Cancel video analysis" variant="secondary" disabled={busy} onPress={()=>void change('cancel')}/>:null}
   {job.state==='failed'?<AppButton label="Retry & resume" variant="secondary" disabled={busy||disabled} onPress={()=>void change('retry')}/>:null}
  </View>:null}
  {job?.state==='done'?<View style={s.stack}>{job.candidates.map(place=><View key={place.id}><Pressable accessibilityRole="checkbox" accessibilityLabel={`Confirm ${place.name}`} accessibilityState={{checked:selected.includes(place.id),disabled:busy||disabled}} disabled={busy||disabled} onPress={()=>setSelected(current=>current.includes(place.id)?current.filter(id=>id!==place.id):[...current,place.id])}><Text style={s.strong}>{selected.includes(place.id)?'☑':'□'} {place.name}</Text><Text style={s.small}>{place.address}</Text><Text style={s.small}>{place.evidence}</Text></Pressable><Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(place.sourceUrl)}><Text style={s.link}>Check on OpenStreetMap ↗</Text></Pressable></View>)}{job.candidates.length?<><Text style={s.small}>Possible matches, including tentative visual identifications. Check before confirming. Map data © OpenStreetMap contributors.</Text><AppButton label={`Confirm ${selected.length} places`} disabled={busy||disabled||!selected.length} onPress={()=>void confirm()}/></>:null}</View>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
 </View>;
}
