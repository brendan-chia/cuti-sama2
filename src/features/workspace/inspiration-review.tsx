import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Inspiration } from '../../../packages/contracts/src/inspiration';
import type { Workspace, WorkspaceAction } from '../../../packages/contracts/src/workspace';
import { AppButton } from '@/components/app-button';
import { pendingInspiration, clearPendingInspiration } from '@/features/inspiration/planning';
import { loadInspiration } from '@/features/inspiration/service';
import { createUuid } from '@/lib/uuid';
import { questStyles as s } from '@/features/quest/quest-styles';

export function InspirationReview({ workspace, busy, save }: { workspace: Workspace; busy: boolean; save: (action: WorkspaceAction) => Promise<boolean> }) {
  const [item, setItem] = useState<Inspiration | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void pendingInspiration(workspace.tripId).then(async id => {
      if (!id) return;
      const items = await loadInspiration(); if (active) setItem(items.find(value => value.id === id) ?? null);
    }).catch(() => { if (active) setError('Could not load the selected idea. It is still available in Saved.'); });
    return () => { active = false; };
  }, [workspace.tripId]);
  if (!item) return error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null;
  return <View style={s.success}>
    <Text style={s.heading}>Review places from your saved idea</Text><Text style={s.body}>{item.analysis?.title ?? item.source_url}</Text>
    <Text style={s.small}>These are suggestions from the source. Check each location before adding it. Places remain unscheduled and do not change your destination.</Text>
    {!item.analysis?.places.length ? <Text style={s.body}>No places found yet. Retry analysis in Saved, or add a place manually.</Text> : null}
    {item.analysis?.places.map((place, index) => {
      const added = workspace.places.some(value => value.name.toLowerCase() === place.name.toLowerCase() && value.location.toLowerCase() === (place.location ?? '').toLowerCase());
      return <View key={index} style={s.stack}><Text style={s.strong}>{place.name} · {place.location || 'Location needs checking'}</Text><Text style={s.small}>{place.evidence}</Text><AppButton label={added ? `${place.name} is saved` : `Add ${place.name} as an unscheduled idea`} variant="secondary" disabled={busy || added} onPress={() => void save({ type: 'place', place: { id: createUuid(), name: place.name.slice(0, 160), location: (place.location ?? '').slice(0, 240), note: place.evidence.slice(0, 1200), sourceUrl: item.source_url, day: null, time: null } })} /></View>;
    })}
    <AppButton label="Done reviewing this idea" variant="secondary" disabled={busy} onPress={() => void clearPendingInspiration(workspace.tripId).then(() => setItem(null)).catch(() => setError('Could not close this review. Please try again.'))} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
  </View>;
}
