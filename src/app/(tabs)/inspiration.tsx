import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, ScrollView, Text, View } from 'react-native';
import { UseInspiration } from '@/features/inspiration/use-inspiration';
import { inspirationSource } from '@/features/inspiration/planning';
import { Screen } from '@/components/screen';
import { FormField } from '@/components/form-field';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { analyzeInspiration, loadInspiration, removeInspiration, saveInspiration } from '@/features/inspiration/service';
import type { Inspiration } from '../../../packages/contracts/src/inspiration';

export default function InspirationFolder() {
  const [items,setItems]=useState<Inspiration[]>([]);const [url,setUrl]=useState('');const [folder,setFolder]=useState('Travel ideas');const [caption,setCaption]=useState('');
  const [filter,setFilter]=useState('');const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [loaded,setLoaded]=useState(false);
  const [editor, setEditor] = useState(false); const [details, setDetails] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removeId,setRemoveId]=useState<string|null>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const next=await loadInspiration();if(active){setItems(next);setLoaded(true);}}catch(e){if(active)setMessage(e instanceof Error?e.message:'Could not load your folder.');}finally{if(active)timer=setTimeout(()=>void poll(),5000);}}
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[]));
  async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  async function save(){
    const id = await saveInspiration({sourceUrl:url,folder,caption});
    setUrl(''); setCaption(''); setEditor(false);
    setMessage('Link saved. Finding places in your link…');
    setItems(await loadInspiration()); setLoaded(true);
    try { await analyzeInspiration(id); setItems(await loadInspiration()); }
    catch { setMessage('Your link is saved. Analysis could not finish. Open its details to retry.'); }
  }
  const visible=items.filter(item=>(!filter||item.folder===filter)&&`${item.source_url} ${item.analysis?.title??''} ${item.analysis?.summary??''} ${item.analysis?.tags.join(' ')??''} ${item.analysis?.places.map(p=>`${p.name} ${p.location}`).join(' ')??''}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen><View style={s.stack}>
    <Text accessibilityRole="header" style={s.title}>{editor ? 'Save a travel link' : 'Saved ideas'}</Text><Text style={s.body}>{editor ? 'Keep the original link and find places to add to a trip.' : 'Places and possibilities, ready when you are.'}</Text>
    {!editor ? <AppButton label="Add link" onPress={() => setEditor(true)} /> : null}
    {editor ? <View style={s.panel}>
      <FormField label="Reel or travel link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2000} placeholder="https://www.instagram.com/p/…" />
      <AppButton label={details ? "Hide optional details" : "Add folder or caption (optional)"} variant="secondary" onPress={() => setDetails(!details)} />
      {details ? <><FormField label="Folder" value={folder} onChangeText={setFolder} maxLength={60} placeholder="e.g. Japan food trip" />
      <FormField label="Caption or transcript (optional)" value={caption} onChangeText={setCaption} multiline maxLength={6000} placeholder="Useful when a post needs login or its places are only mentioned in the video." />
      </> : null}
      <Text style={s.small}>Public text and the caption you provide are sent to our AI reader. Your saved posts stay private. Linked videos are not automatically transcribed.</Text>
      <AppButton label="Save link" loading={busy} disabled={!url.trim()||!folder.trim()} onPress={()=>void run(save)} />
      <AppButton label="Back to saved ideas" variant="secondary" disabled={busy} onPress={() => setEditor(false)} />
    </View> : null}
    {message?<Text accessibilityRole="alert" style={s.body}>{message}</Text>:null}
    {!editor ? <>
    <FormField label="Search saved ideas" value={search} onChangeText={setSearch} placeholder="Search a place, country or tag" />
    <ScrollView horizontal contentContainerStyle={s.row}><AppButton label={filter?'All folders':'✓ All folders'} variant="secondary" onPress={()=>setFilter('')} />{[...new Set(items.map(i=>i.folder))].map(name=><AppButton key={name} label={filter===name?`✓ ${name}`:name} variant="secondary" onPress={()=>setFilter(name)} />)}</ScrollView>
    {!loaded?<Text style={s.body}>{message ? 'Could not load saved ideas. Retrying automatically…' : 'Loading your saved ideas…'}</Text>:!visible.length?<Text style={s.body}>{items.length?'No ideas match this search.':'Your first saved link will appear here.'}</Text>:null}
    {visible.map(item=><View key={item.id} style={s.panel}>
      <Text style={s.kicker}>{item.folder}</Text><Text style={s.heading}>{item.analysis?.title??item.source_url}</Text>
      <Text style={s.small}>{item.status==='analyzing'?'Analyzing…':item.status==='ready'?'Analysis saved':item.status==='needs_input'?'Caption needed':item.status==='failed'?'Analysis needs a retry':'Saved'}</Text>
      <Text selectable style={s.small}>{item.source_url}</Text><Text style={s.body}>{item.message}</Text>
      <AppButton label={expanded === item.id ? "Hide details" : "View places and details"} variant="secondary" onPress={() => setExpanded(expanded === item.id ? null : item.id)} />
      {expanded === item.id ? <>
      {item.analysis?<><Text style={s.body}>{item.analysis.summary}</Text>{item.analysis.places.map((place,index)=><View key={index}><Text style={s.strong}>{place.name}{place.location?` · ${place.location}`:''}</Text><Text style={s.small}>Source: {inspirationSource(item.source_url)}</Text><Text style={s.small}>{place.evidence}</Text></View>)}{item.analysis.planningNotes.map((note,index)=><Text key={index} style={s.small}>{note}</Text>)}<Text style={s.small}>{item.analysis.tags.join(' · ')}</Text>{item.analysis.places.length ? <UseInspiration inspirationId={item.id} /> : null}</>:null}
      <AppButton label="Open original post" variant="secondary" disabled={busy} onPress={()=>void run(async()=>{await Linking.openURL(item.source_url);})} />
      {item.status!=='ready' && item.status!=='analyzing'?<AppButton label="Retry analysis" variant="secondary" disabled={busy} onPress={()=>void run(async()=>{await analyzeInspiration(item.id);setItems(await loadInspiration());})} />:null}
      <AppButton label="Edit folder or caption" variant="secondary" disabled={busy} onPress={()=>{setUrl(item.source_url);setFolder(item.folder);setCaption(item.caption);setEditor(true);setDetails(true);setMessage('');}} />
      {removeId===item.id?<><Text style={s.small}>Remove this saved link and its analysis?</Text><AppButton label="Confirm removal" disabled={busy} onPress={()=>void run(async()=>{await removeInspiration(item.id);setItems(await loadInspiration());setRemoveId(null);})} /><AppButton label="Keep it" variant="secondary" onPress={()=>setRemoveId(null)} /></>:<AppButton label="Remove saved link" variant="secondary" disabled={busy} onPress={()=>setRemoveId(item.id)} />}
      </> : null}
    </View>)}
    </> : null}
  </View></Screen>;
}
