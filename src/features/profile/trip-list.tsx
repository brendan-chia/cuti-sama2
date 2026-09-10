import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { colors } from '@/theme/tokens';
import type { MyTrip } from './service';
type Props = { trips: MyTrip[]; completed: Set<string>; busy: boolean; onOpen: (id: string) => void; onComplete: (id: string) => void; onManage: (id: string) => void };
export function TripList({ trips, completed, busy, onOpen, onComplete, onManage }: Props) {
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  return <View>{trips.map(trip => <View key={trip.id} style={s.item}>
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${trip.name}`} onPress={() => onOpen(trip.id)} style={({ pressed }) => [s.open, pressed && { opacity: 0.7 }]}>
        <Text style={s.name}>{trip.name}</Text>
        <Text style={s.body}>{trip.travel_party === 'solo' ? 'Solo trip' : 'Group trip'} · {completed.has(trip.id) ? 'Completed' : trip.planning_started_at ? 'Planning' : 'Draft'}</Text>
        <Text style={s.meta}>{trip.starts_on ? new Date(`${trip.starts_on}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Dates not decided'}{trip.ends_on ? ` – ${new Date(`${trip.ends_on}T12:00:00`).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}` : ''}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${trip.name}`} accessibilityState={{ expanded: menu === trip.id }} onPress={() => { setMenu(menu === trip.id ? null : trip.id); setConfirm(null); }} style={s.more}><Text style={s.moreText}>•••</Text></Pressable>
    </View>
    {menu === trip.id ? <View style={s.actions}>
      {!completed.has(trip.id) ? confirm === trip.id ? <><Text style={s.body}>Move this trip to Past trips?</Text><AppButton label="Mark completed" disabled={busy} onPress={() => onComplete(trip.id)} /><AppButton label="Keep in current trips" variant="secondary" onPress={() => setConfirm(null)} /></> : <AppButton label="Mark trip completed" variant="secondary" onPress={() => setConfirm(trip.id)} /> : null}
      {!trip.planning_started_at && trip.travel_party !== 'solo' ? <AppButton label="Manage public listing" variant="secondary" onPress={() => onManage(trip.id)} /> : null}
      <AppButton label="Close options" variant="secondary" onPress={() => setMenu(null)} />
    </View> : null}
  </View>)}</View>;
}
const s = StyleSheet.create({ item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12 }, row: { flexDirection: 'row', alignItems: 'center' }, open: { flex: 1, paddingVertical: 12, gap: 8 }, name: { color: colors.ink, fontSize: 20, fontWeight: '700' }, body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 }, meta: { color: colors.textMuted, fontSize: 14 }, more: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, moreText: { color: colors.sky, fontSize: 18 }, actions: { gap: 12, paddingVertical: 12 } });
