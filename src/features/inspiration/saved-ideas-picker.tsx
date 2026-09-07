import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { loadInspiration } from './service';
import type { Inspiration } from '../../../packages/contracts/src/inspiration';
import { questStyles as s } from '@/features/quest/quest-styles';
export function SavedIdeasPicker({onChoose,disabled}:{onChoose:(text:string)=>void;disabled?:boolean}) {
  const [items,setItems]=useState<Inspiration[]|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function load(){setBusy(true);setError('');try{setItems((await loadInspiration()).filter(i=>i.status==='ready'&&i.analysis?.places.length));}catch(e){setError(e instanceof Error?e.message:'Could not load saved ideas.');}finally{setBusy(false);}}
  return <View style={s.stack}><AppButton label="Choose from my saved inspiration" variant="secondary" disabled={disabled} loading={busy} onPress={()=>void load()} />
    {error?<Text style={s.error}>{error}</Text>:null}
    {items?.length===0?<Text style={s.small}>No analyzed places yet. Save a social post from My profile → Saved inspiration.</Text>:null}
    {items?.map(item=><View key={item.id}><Text style={s.small}>{item.folder}</Text><AppButton label={item.analysis!.title} variant="secondary" disabled={disabled} onPress={()=>{onChoose(item.analysis!.places.map(p=>`${p.name}${p.location?`, ${p.location}`:''}`).join('\n'));setItems(null);}} /></View>)}
  </View>;
}
