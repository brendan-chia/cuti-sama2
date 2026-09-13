import { placeLabel } from '@/lib/presentation';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { UseInspiration } from '@/features/inspiration/use-inspiration';
import { inspirationSource } from '@/features/inspiration/planning';
import { Screen } from '@/components/screen';
import { FormField } from '@/components/form-field';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { analyzeInspiration, loadInspiration, removeInspiration, saveInspiration } from '@/features/inspiration/service';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Inspiration } from '../../packages/contracts/src/inspiration';

export default function InspirationFolder() {
  const [items,setItems]=useState<Inspiration[]>([]);const [url,setUrl]=useState('');const [folder,setFolder]=useState('Travel ideas');const [caption,setCaption]=useState('');
  const [filter,setFilter]=useState('');const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [loaded,setLoaded]=useState(false);
  const scroll = useRef<ScrollView>(null);
  const [composer, setComposer] = useState(false);
  const [details, setDetails] = useState<string[]>([]);
  const [removeId,setRemoveId]=useState<string|null>(null);
  useFocusEffect(useCallback(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const next=await loadInspiration();if(active){setItems(next);setLoaded(true);}}catch(e){if(active)setMessage(e instanceof Error?e.message:'Could not load your folder.');}finally{if(active)timer=setTimeout(()=>void poll(),5000);}}
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[]));
  async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  async function save(){const id=await saveInspiration({sourceUrl:url,folder,caption});setItems(await loadInspiration());setUrl('');setCaption('');await analyzeInspiration(id);setMessage('Link saved. Analysis will appear here automatically.');setItems(await loadInspiration());setComposer(false);}
  const visible=items.filter(item=>(!filter||item.folder===filter)&&`${item.source_url} ${item.analysis?.title??''} ${item.analysis?.summary??''} ${item.analysis?.tags.join(' ')??''} ${item.analysis?.places.map(p=>`${p.name} ${p.location}`).join(' ')??''}`.toLowerCase().includes(search.toLowerCase()));
  const folders = [...new Set(items.map(item => item.folder))];
  function edit(item: Inspiration) {
    setUrl(item.source_url); setFolder(item.folder); setCaption(item.caption); setComposer(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  return <Screen scrollRef={scroll}><View style={styles.page}>
    <View style={styles.intro}>
      <Text style={s.kicker}>YOUR PERSONAL TRAVEL COLLECTION</Text>
      <Text accessibilityRole="header" style={s.title}>Little finds.
Future adventures.</Text>
      <Text style={s.body}>Keep the places that caught your eye. Turn them into your next trip.</Text>
      <View style={styles.summary}><Text style={styles.count}>{items.length} saved {items.length === 1 ? 'idea' : 'ideas'}</Text><Text style={s.small}>Only you can see this collection</Text></View>
    </View>
    <AppButton label={composer ? 'Close new idea' : '＋ Save a travel link'} variant={composer ? 'secondary' : 'primary'} disabled={busy} onPress={() => setComposer(value => !value)} />
    {composer ? <View style={styles.composer}>
      <Text accessibilityRole="header" style={s.heading}>Found somewhere good?</Text>
      <FormField label="Reel or travel link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2000} placeholder="Paste your Instagram, TikTok or travel link" editable={!busy} />
      <FormField label="Folder" value={folder} onChangeText={setFolder} maxLength={60} placeholder="e.g. Japan food trip" editable={!busy} />
      <FormField label="Caption or transcript (optional)" value={caption} onChangeText={setCaption} multiline maxLength={6000} placeholder="Add context or place names to help identify the places." editable={!busy} />
      <Text style={s.small}>Supported posts are read using captions, sampled images and available audio. This content is sent to OpenAI for analysis.</Text>
      <AppButton label="Save & analyze" loading={busy} disabled={!url.trim() || !folder.trim()} onPress={() => void run(save)} />
    </View> : null}
    {message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null}
    <View style={styles.library}>
      <Text accessibilityRole="header" style={s.heading}>Your saved ideas</Text>
      <FormField label="Search saved ideas" value={search} onChangeText={setSearch} placeholder="Find a place, country or tag" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {['', ...folders].map(name => <Pressable key={name} accessibilityRole="button" accessibilityLabel={name || 'All folders'} aria-pressed={filter === name} accessibilityState={{ selected: filter === name }} onPress={() => setFilter(name)} style={[styles.filter, filter === name && styles.filterSelected]}>
          <Text style={[styles.filterText, filter === name && styles.filterTextSelected]}>{name || 'All folders'}{filter === name ? ' ✓' : ''}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
    {!loaded ? <View style={styles.empty}><ActivityIndicator color={colors.sky} /><Text style={s.body}>Loading your saved ideas…</Text></View> : !visible.length ? <View style={styles.empty}>
      <Text style={styles.emptyMark} accessibilityElementsHidden>↗</Text>
      <Text style={s.heading}>{items.length ? 'Nothing here just yet.' : 'Your next trip starts with a find.'}</Text>
      <Text style={s.body}>{items.length ? 'Try a different search or folder.' : 'Save a travel link above. We’ll help you find the places worth keeping.'}</Text>
    </View> : null}
    {visible.map(item => {
      const expanded = details.includes(item.id);
      const status = item.status === 'analyzing' ? 'Reading your post' : item.status === 'ready' ? 'Ready to explore' : item.status === 'needs_input' ? 'Needs a caption' : item.status === 'failed' ? 'Try again' : 'Saved';
      return <View key={item.id} style={styles.idea}>
        <View style={styles.meta}><Text style={styles.folder}>{item.folder}</Text><Text style={s.small}>{inspirationSource(item.source_url)}</Text></View>
        <Text accessibilityRole="header" style={styles.ideaTitle}>{item.analysis?.title ?? 'A new place to discover'}</Text>
        <View style={styles.statusRow}>{item.status === 'analyzing' ? <ActivityIndicator size="small" color={colors.sky} /> : <Text style={styles.statusMark}>{item.status === 'ready' ? '✓' : '○'}</Text>}<Text style={styles.status}>{status}</Text>{item.analysis ? <Text style={s.small}>· {item.analysis.places.length} places</Text> : null}</View>
        {item.analysis ? <>
          <Text style={s.body}>{item.analysis.summary}</Text>
          <View style={styles.places}>{item.analysis.places.map((place, index) => <View key={`${place.name}:${place.location}`} style={styles.place}>
            <Text style={styles.placeIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.placeCopy}><Text style={s.strong}>{placeLabel(place.name)}</Text>{place.location ? <Text style={s.small}>{placeLabel(place.location)}</Text> : null}{expanded ? <Text style={styles.evidence}>{place.evidence}</Text> : null}</View>
          </View>)}</View>
          {item.analysis.places.length ? <UseInspiration inspirationId={item.id} /> : null}
        </> : <Text accessibilityLiveRegion="polite" style={s.body}>{item.message}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="link" disabled={busy} onPress={() => void run(async () => { await Linking.openURL(item.source_url); })} style={styles.textAction}><Text style={s.link}>Open post ↗</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${item.analysis?.title ?? 'saved post'}`} aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setDetails(current => expanded ? current.filter(id => id !== item.id) : [...current, item.id])} style={styles.textAction}><Text style={s.link}>{expanded ? 'Less detail −' : 'Details & options +'}</Text></Pressable>
        </View>
        {item.status !== 'ready' ? <AppButton label="Retry analysis" variant="secondary" disabled={busy} onPress={() => void run(async () => { await analyzeInspiration(item.id); setItems(await loadInspiration()); })} /> : null}
        {expanded ? <View style={styles.details}>
          <Text selectable style={s.small}>{item.source_url}</Text>
          {item.analysis?.planningNotes.map((note, index) => <Text key={index} style={s.small}>{note}</Text>)}
          {item.analysis?.tags.length ? <Text style={styles.folder}>{item.analysis.tags.join(' · ')}</Text> : null}
          <AppButton label="Edit folder or caption" variant="secondary" disabled={busy} onPress={() => edit(item)} />
        </View> : null}
        {removeId === item.id ? <View style={styles.details}>
          <Text style={s.body}>Delete this saved link and its analysis?</Text>
          <AppButton label="Delete saved link" loading={busy} onPress={() => void run(async () => {
            await removeInspiration(item.id);
            setItems(current => current.filter(saved => saved.id !== item.id));
            setDetails(current => current.filter(id => id !== item.id));
            setRemoveId(null);
            setMessage('Saved link deleted.');
          })} />
          <AppButton label="Keep it" variant="secondary" disabled={busy} onPress={() => setRemoveId(null)} />
        </View> : <Pressable accessibilityRole="button" accessibilityLabel={`Delete saved link: ${item.analysis?.title ?? item.source_url}`} accessibilityState={{ disabled: busy }} disabled={busy} style={styles.textAction} onPress={() => setRemoveId(item.id)}><Text style={styles.remove}>Delete saved link</Text></Pressable>}
      </View>;
    })}
  </View></Screen>;
}
const styles = StyleSheet.create({
  page: { gap: spacing.xl }, intro: { gap: spacing.md }, summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  count: { color: colors.sky, fontSize: 13, lineHeight: 21, fontWeight: '700' },
  composer: { padding: spacing.lg, gap: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  library: { gap: spacing.md }, filters: { gap: spacing.sm },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  filterSelected: { backgroundColor: colors.sky, borderColor: colors.sky }, filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' }, filterTextSelected: { color: colors.paper },
  idea: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl, paddingBottom: spacing.sm, gap: spacing.md },
  meta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }, folder: { color: colors.sky, fontSize: 13, lineHeight: 21, fontWeight: '700' },
  ideaTitle: { color: colors.ink, fontSize: 23, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }, status: { color: colors.sky, fontSize: 13, fontWeight: '600' }, statusMark: { color: colors.sky, fontSize: 16 },
  places: { paddingVertical: spacing.sm, gap: spacing.lg }, place: { flexDirection: 'row', gap: spacing.md }, placeIndex: { color: colors.sky, fontSize: 13, lineHeight: 23, fontWeight: '700', minWidth: 26 }, placeCopy: { flex: 1, gap: spacing.xs },
  evidence: { color: colors.textMuted, fontSize: 13, lineHeight: 21, paddingTop: spacing.sm }, actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.md },
  textAction: { minHeight: 44, justifyContent: 'center' }, details: { gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md }, remove: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  empty: { paddingVertical: spacing.xxl, gap: spacing.md, alignItems: 'flex-start' }, emptyMark: { color: colors.sky, fontSize: 36 }, notice: { color: colors.ink, lineHeight: 23, padding: spacing.lg, backgroundColor: colors.surfaceTint, borderRadius: radius.md },
});
