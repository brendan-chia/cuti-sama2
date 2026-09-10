import { useState } from 'react';
import { Text, View } from 'react-native';
import { WorkspaceBookingSchema, WorkspacePlaceSchema, type Workspace, type WorkspaceAction, type WorkspacePlace } from '../../../packages/contracts/src/workspace';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { createUuid } from '@/lib/uuid';
import { questStyles as s } from '@/features/quest/quest-styles';

type EditorProps = { busy: boolean; save: (action: WorkspaceAction) => Promise<boolean>; close: () => void };
export function PlaceEditor({ place, busy, save, close }: EditorProps & { place?: WorkspacePlace }) {
  const [id] = useState(() => place?.id ?? createUuid());
  const [name, setName] = useState(place?.name ?? ''); const [location, setLocation] = useState(place?.location ?? '');
  const [note, setNote] = useState(place?.note ?? ''); const [day, setDay] = useState(place?.day?.toString() ?? '');
  const [time, setTime] = useState(place?.time ?? ''); const [url, setUrl] = useState(place?.sourceUrl ?? ''); const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  async function submit() {
    const parsed = WorkspacePlaceSchema.safeParse({ id, name, location, note, day: day.trim() ? Number(day) : null, time: time.trim() || null, sourceUrl: url.trim() || null });
    if (!parsed.success) { setError('Enter a place name, a day from 1 to 30 (optional), a time as HH:MM, and a valid web link if provided.'); return; }
    if (parsed.data.time && !parsed.data.day) { setError('Choose a day for this time, or clear the time to keep the place unscheduled.'); return; }
    if (await save({ type: 'place', place: parsed.data })) close();
  }
  return <View style={s.stack}>
    <Text accessibilityRole="header" style={s.heading}>{place ? 'Edit place' : 'Add a place'}</Text>
    <FormField label="Place name" value={name} onChangeText={setName} maxLength={160} />
    <FormField label="City or address" value={location} onChangeText={setLocation} maxLength={240} />
    <FormField label="Notes (optional)" hint="Opening hours, access needs, or why you want to go." value={note} onChangeText={setNote} multiline maxLength={1200} />
    <FormField label="Source link (optional)" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" maxLength={2000} />
    <FormField label="Day (optional)" hint="Leave blank to save without scheduling. Enter 1–30 to add it to the draft plan." value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} />
    <FormField label="Local time (optional)" hint="24-hour time, for example 09:30." value={time} onChangeText={setTime} maxLength={5} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <AppButton label="Save place" loading={busy} onPress={() => void submit()} />
    <AppButton label="Cancel editing" variant="secondary" disabled={busy} onPress={close} />
    {place ? remove ? <><Text style={s.body}>Remove this place from Saved places and the draft itinerary?</Text><AppButton label="Confirm removal" disabled={busy} onPress={() => void save({ type: 'remove_place', id }).then(ok => { if (ok) close(); })} /><AppButton label="Keep place" variant="secondary" onPress={() => setRemove(false)} /></> : <AppButton label="Remove place" variant="secondary" onPress={() => setRemove(true)} /> : null}
  </View>;
}

export function BookingEditor({ booking, busy, save, close }: EditorProps & { booking?: Workspace['bookings'][number] }) {
  const [id] = useState(() => booking?.id ?? createUuid()); const [title, setTitle] = useState(booking?.title ?? '');
  const [kind, setKind] = useState<'transport' | 'stay'>(booking?.kind ?? 'transport');
  const [status, setStatus] = useState<'selected' | 'booked'>(booking?.status ?? 'selected');
  const [note, setNote] = useState(booking?.note ?? ''); const [cost, setCost] = useState(booking?.cost?.toString() ?? '');
  const [url, setUrl] = useState(booking?.url ?? ''); const [error, setError] = useState(''); const [remove, setRemove] = useState(false);
  async function submit() {
    const parsed = WorkspaceBookingSchema.safeParse({ id, title, kind, status, note, cost: cost.trim() ? Number(cost) : null, url: url.trim() || null });
    if (!parsed.success) { setError('Enter a title, a non-negative price, and a valid web link if provided.'); return; }
    if (await save({ type: 'booking', booking: parsed.data })) close();
  }
  return <View style={s.stack}>
    <Text accessibilityRole="header" style={s.heading}>{booking ? 'Edit booking' : 'Add transport or a stay'}</Text>
    <FormField label="Title" placeholder="e.g. Train to Ipoh · 16 October" value={title} onChangeText={setTitle} maxLength={160} />
    <AppButton label={kind === 'transport' ? 'Type: Transport · change to Stay' : 'Type: Stay · change to Transport'} variant="secondary" onPress={() => setKind(kind === 'transport' ? 'stay' : 'transport')} />
    <AppButton label={status === 'selected' ? 'Not booked · mark as booked' : 'Booked · mark as not booked'} variant="secondary" onPress={() => setStatus(status === 'selected' ? 'booked' : 'selected')} />
    <Text style={s.small}>Only mark booked after receiving confirmation from your provider. Saving here makes no purchase.</Text>
    <FormField label="Details" hint="Add traveller names, provider, dates, local times and time zones, or check-in details." value={note} onChangeText={setNote} maxLength={1200} multiline />
    <FormField label="Total cost for this booking (MYR, optional)" hint="Full booking cost, not per person or per night." value={cost} onChangeText={setCost} keyboardType="decimal-pad" maxLength={12} />
    <FormField label="Provider link (optional)" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" maxLength={2000} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <AppButton label="Save booking details" loading={busy} onPress={() => void submit()} />
    <AppButton label="Cancel editing" variant="secondary" disabled={busy} onPress={close} />
    {booking ? remove ? <><Text style={s.body}>Remove these details? This does not cancel a booking with the provider.</Text><AppButton label="Remove booking details" disabled={busy} onPress={() => void save({ type: 'remove_booking', id }).then(ok => { if (ok) close(); })} /><AppButton label="Keep details" variant="secondary" onPress={() => setRemove(false)} /></> : <AppButton label="Remove details" variant="secondary" onPress={() => setRemove(true)} /> : null}
  </View>;
}
