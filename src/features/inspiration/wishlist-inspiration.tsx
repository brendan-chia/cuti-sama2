import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SavedIdeasPicker } from './saved-ideas-picker';
import { pendingInspiration, queueInspiration } from './planning';
import { loadInspiration } from './service';
import { questStyles as s } from '@/features/quest/quest-styles';

export function WishlistInspiration({ tripId, disabled }: { tripId: string; disabled?: boolean }) {
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const id = await pendingInspiration(tripId);
      if (!id) return;
      const idea = (await loadInspiration()).find(item => item.id === id && item.status === 'ready');
      if (active && idea?.analysis) setNames(idea.analysis.places.map(place => [place.name, place.location].filter(Boolean).join(', ')).join('\n'));
    })().catch(() => { if (active) setError('Could not load your saved idea. Choose it again below.'); });
    return () => { active = false; };
  }, [tripId]);
  async function choose(text: string, id: string) {
    setBusy(true); setError('');
    try { await queueInspiration(tripId, id); setNames(text); }
    catch { setError('Could not attach these places. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={s.panel}>
    <Text style={s.kicker}>FROM YOUR SAVED COLLECTION</Text>
    {!names ? <Text style={s.body}>Let the places you’ve saved inspire where you go next.</Text> : null}
    <SavedIdeasPicker disabled={disabled || busy} onChoose={(text, id) => { void choose(text, id); }} />
    {names ? <View style={s.success}>
      <Text style={s.strong}>Saved places for this trip</Text>
      <Text style={s.body}>{names}</Text>
      <Text style={s.small}>Use these ideas to choose your countries below. Once your destination is decided, confirm matching places in Explore. They will be checked for visiting automatically. Choosing another saved idea replaces this one.</Text>
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
  </View>;
}
