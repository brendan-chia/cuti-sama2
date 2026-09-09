import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import { UseInspiration } from '@/features/inspiration/use-inspiration';
import { inspirationSource } from '@/features/inspiration/planning';
import { Screen } from '@/components/screen';
import { FormField } from '@/components/form-field';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { analyzeInspiration, loadInspiration, removeInspiration, saveInspiration } from '@/features/inspiration/service';
import type { Inspiration } from '../../packages/contracts/src/inspiration';

export default function InspirationFolder() {
  const [items,setItems]=useState<Inspiration[]>([]);const [url,setUrl]=useState('');const [folder,setFolder]=useState('Travel ideas');const [caption,setCaption]=useState('');
  const [filter,setFilter]=useState('');const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [loaded,setLoaded]=useState(false);
  const [removeId,setRemoveId]=useState<string|null>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const next=await loadInspiration();if(active){setItems(next);setLoaded(true);}}catch(e){if(active)setMessage(e instanceof Error?e.message:'Could not load your folder.');}finally{if(active)timer=setTimeout(()=>void poll(),5000);}}
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[]));
  async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  async function save(){const id=await saveInspiration({sourceUrl:url,folder,caption});setItems(await loadInspiration());setUrl('');setCaption('');await analyzeInspiration(id);setMessage('Link saved. Analysis will appear here automatically.');setItems(await loadInspiration());}
  const visible=items.filter(item=>(!filter||item.folder===filter)&&`${item.source_url} ${item.analysis?.title??''} ${item.analysis?.summary??''} ${item.analysis?.tags.join(' ')??''} ${item.analysis?.places.map(p=>`${p.name} ${p.location}`).join(' ')??''}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen><View style={s.stack}>
    <Text style={s.title}>Saved inspiration</Text><Text style={s.body}>Saved it. Forgot it. Travel it. Paste a reel or travel link and turn it into a place you can actually plan around.</Text>
    <View style={s.panel}>
      <FormField label="Reel or travel link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2000} placeholder="https://www.instagram.com/p/…" />
      <FormField label="Folder" value={folder} onChangeText={setFolder} maxLength={60} placeholder="e.g. Japan food trip" />
      <FormField label="Caption or transcript (optional)" value={caption} onChangeText={setCaption} multiline maxLength={6000} placeholder="Useful when a post needs login or its places are only mentioned in the video." />
      <Text style={s.small}>Public text and the caption you provide are sent to our AI reader. Your saved posts stay private. Linked videos are not automatically transcribed.</Text>
      <AppButton label="Save & analyze" loading={busy} disabled={!url.trim()||!folder.trim()} onPress={()=>void run(save)} />
    </View>
    {message?<Text accessibilityRole="alert" style={s.body}>{message}</Text>:null}
    <FormField label="Search saved ideas" value={search} onChangeText={setSearch} placeholder="Search a place, country or tag" />
    <View style={s.row}><AppButton label={filter?'All folders':'✓ All folders'} variant="secondary" onPress={()=>setFilter('')} />{[...new Set(items.map(i=>i.folder))].map(name=><AppButton key={name} label={filter===name?`✓ ${name}`:name} variant="secondary" onPress={()=>setFilter(name)} />)}</View>
    {!loaded?<Text style={s.body}>Loading your saved ideas…</Text>:!visible.length?<Text style={s.body}>{items.length?'No ideas match this search.':'Your first saved link will appear here.'}</Text>:null}
    {visible.map(item=><View key={item.id} style={s.panel}>
      <Text style={s.kicker}>{item.folder}</Text><Text style={s.heading}>{item.analysis?.title??item.source_url}</Text>
      <Text style={s.small}>{item.status==='analyzing'?'Analyzing…':item.status==='ready'?'Analysis saved':item.status==='needs_input'?'Caption needed':item.status==='failed'?'Analysis needs a retry':'Saved'}</Text>
      <Text selectable style={s.small}>{item.source_url}</Text><Text style={s.body}>{item.message}</Text>
      {item.analysis?<><Text style={s.body}>{item.analysis.summary}</Text>{item.analysis.places.map((place,index)=><View key={index}><Text style={s.strong}>{place.name}{place.location?` · ${place.location}`:''}</Text><Text style={s.small}>Source: {inspirationSource(item.source_url)}</Text><Text style={s.small}>{place.evidence}</Text></View>)}{item.analysis.planningNotes.map((note,index)=><Text key={index} style={s.small}>{note}</Text>)}<Text style={s.small}>{item.analysis.tags.join(' · ')}</Text>{item.analysis.places.length ? <UseInspiration inspirationId={item.id} /> : null}</>:null}
      <AppButton label="Open original post" variant="secondary" disabled={busy} onPress={()=>void run(async()=>{await Linking.openURL(item.source_url);})} />
      {item.status!=='ready'?<AppButton label="Retry analysis" variant="secondary" disabled={busy} onPress={()=>void run(async()=>{await analyzeInspiration(item.id);setItems(await loadInspiration());})} />:null}
      <AppButton label="Edit folder or caption" variant="secondary" disabled={busy} onPress={()=>{setUrl(item.source_url);setFolder(item.folder);setCaption(item.caption);setMessage('Edit the form above, then choose Save & analyze.');}} />
      {removeId===item.id?<><Text style={s.small}>Remove this saved link and its analysis?</Text><AppButton label="Confirm removal" disabled={busy} onPress={()=>void run(async()=>{await removeInspiration(item.id);setItems(await loadInspiration());setRemoveId(null);})} /><AppButton label="Keep it" variant="secondary" onPress={()=>setRemoveId(null)} /></>:<AppButton label="Remove saved link" variant="secondary" disabled={busy} onPress={()=>setRemoveId(item.id)} />}
    </View>)}
  </View></Screen>;
}
