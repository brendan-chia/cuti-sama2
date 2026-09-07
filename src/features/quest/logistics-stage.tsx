import { LogisticsOptions } from './logistics-options';
import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { emptyLogistics, logisticsDraftNotice, logisticsTotals, StaySchema, TransportSchema, type Stay, type Transport } from '../../../packages/contracts/src/logistics';
import type { QuestAction, QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { DateField } from '@/components/date-field';
import { money } from './budget-stage';
import { questStyles as s } from './quest-styles';

type Props = { room: QuestRoom; busy: boolean; act: (action: QuestAction) => Promise<boolean>; onItinerary?: () => void; onSectionChange?: () => void };
function Choices<T extends string>({ values, value, onChange, disabled }: { values: readonly T[]; value: T; onChange: (value: T) => void; disabled: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{values.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: item === value, disabled }} disabled={disabled} onPress={() => onChange(item)} style={s.chip}><Text style={item === value ? s.strong : s.small}>{item === value ? '● ' : '○ '}{item}</Text></Pressable>)}</View>;
}

function TransportForm({ room, busy, act }: Props) {
  const [manual, setManual] = useState(false);
  const [direction, setDirection] = useState<Transport['direction']>('arrival');
  const [chosenMemberId, setChosenMemberId] = useState(room.currentMemberId);
  const memberId = room.currentRole === 'organizer' && room.members.some((member) => member.memberId === chosenMemberId) ? chosenMemberId : room.currentMemberId;
  const traveller = room.members.find((member) => member.memberId === memberId)!;
  const own = memberId === room.currentMemberId;
  const existing = (room.logistics ?? emptyLogistics).transport.find((item) => item.memberId === memberId && item.direction === direction);
  const saveForTraveller: Props['act'] = (action) => act((action.type === 'transport' || action.type === 'skip_transport') && !own ? { ...action, memberId } : action);
  return <View style={s.stack}>
    <Text style={s.small}>Choose inbound and return journeys from the suggestions. Prices are per person, in MYR.</Text>
    {room.currentRole === 'organizer' ? <View style={s.stack}><Text style={s.strong}>Transport for</Text><View style={s.row}>{room.members.map((member) => <Pressable key={member.memberId} accessibilityRole="radio" accessibilityLabel={`Transport for ${member.displayName}`} accessibilityState={{ checked: memberId === member.memberId, disabled: busy }} disabled={busy} onPress={() => setChosenMemberId(member.memberId)} style={[s.chip, memberId === member.memberId && s.chipSelected]}><Text style={memberId === member.memberId ? s.chipTextSelected : s.chipText}>{member.memberId === room.currentMemberId ? 'You' : member.displayName}</Text></Pressable>)}</View></View> : null}
    <Choices values={['arrival', 'departure']} value={direction} onChange={setDirection} disabled={busy} />
    <LogisticsOptions key={`${memberId}-${direction}`} room={room} kind="transport" direction={direction} busy={busy} act={saveForTraveller} />
    {existing ? <Text style={s.strong}>Saved: {existing.departureLocation} → {existing.arrivalLocation} · {money(existing.cost)} · {existing.status}</Text> : null}
    <AppButton label={manual ? "Hide booking details" : "Add or edit my own booking"} variant="secondary" disabled={busy} onPress={() => setManual(!manual)} />
    {manual ? <JourneyEditor key={`${memberId}-${direction}-${JSON.stringify(existing)}`} existing={existing} direction={direction} busy={busy} act={saveForTraveller} saveLabel={own ? 'Save my transport' : `Save ${traveller.displayName}’s transport`} /> : null}
    <AppButton label={own ? "I haven't booked transport yet" : `${traveller.displayName} hasn’t booked transport yet`} variant="secondary" disabled={busy} onPress={() => void saveForTraveller({ type: 'skip_transport' })} />
    {(room.logistics ?? emptyLogistics).skippedMemberIds.includes(memberId) ? <Text style={s.small}>Transport marked for later. Any selected journeys are still included.</Text> : null}
  </View>;
}

function JourneyEditor({ existing, direction, busy, act, saveLabel }: { existing?: Transport; direction: Transport['direction']; busy: boolean; act: Props['act']; saveLabel: string }) {
  const [mode, setMode] = useState<Transport['mode']>(existing?.mode ?? 'flight');
  const [status, setStatus] = useState<Transport['status']>(existing?.status ?? 'proposed');
  const [departureLocation, setFrom] = useState(existing?.departureLocation ?? '');
  const [arrivalLocation, setTo] = useState(existing?.arrivalLocation ?? '');
  const [departureAt, setDeparture] = useState(existing?.departureAt ?? '');
  const [arrivalAt, setArrival] = useState(existing?.arrivalAt ?? '');
  const [price, setPrice] = useState(existing?.cost.toString() ?? '');
  const [bookingLink, setLink] = useState(existing?.bookingLink ?? '');
  const [error, setError] = useState('');
  async function save() {
    const parsed = TransportSchema.safeParse({ direction, mode, status, departureLocation, arrivalLocation, departureAt, arrivalAt, cost: price.trim() ? Number(price) : NaN, bookingLink: bookingLink.trim() || null });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError(''); await act({ type: 'transport', transport: parsed.data });
  }
  return <View style={s.panel}>
    <Choices values={['flight', 'train', 'bus', 'car']} value={mode} onChange={setMode} disabled={busy} />
    <FormField label="Departure city / airport" value={departureLocation} onChangeText={setFrom} editable={!busy} />
    <FormField label="Destination city / airport" value={arrivalLocation} onChangeText={setTo} editable={!busy} />
    <JourneyTime label="Departure" value={departureAt} onChange={setDeparture} busy={busy} />
    <JourneyTime label="Arrival" value={arrivalAt} onChange={setArrival} busy={busy} />
    <FormField label="Estimated transport price (MYR)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} editable={!busy} />
    <FormField label="Transport booking link (optional)" keyboardType="url" autoCapitalize="none" value={bookingLink} onChangeText={setLink} editable={!busy} />
    <Choices values={['proposed', 'selected', 'booked']} value={status} onChange={setStatus} disabled={busy} />
    <Text style={s.small}>Only selected or booked journeys constrain the itinerary. Select your preferred journey even if you will book later.</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <AppButton label={saveLabel} disabled={busy} onPress={() => void save()} />
  </View>;
}

function JourneyTime({ label, value, onChange, busy }: { label: string; value: string; onChange: (value: string) => void; busy: boolean }) {
  const [date, setDate] = useState(value.slice(0, 10));
  const [time, setTime] = useState(value.slice(11, 16));
  const [offset, setOffset] = useState(value.endsWith('Z') ? '+00:00' : value.slice(19));
  return <View style={s.stack}>
    <DateField label={`${label} date`} value={date} onChange={(next) => { if (!busy) { setDate(next); onChange(`${next}T${time}:00${offset}`); } }} />
    <FormField label={`${label} local time`} hint="24-hour time" placeholder="14:30" maxLength={5} value={time} editable={!busy} onChangeText={(next) => { setTime(next); onChange(`${date}T${next}:00${offset}`); }} />
    <FormField label={`${label} UTC offset`} hint="Use the city’s offset on your travel date. Malaysia: +08:00; Japan: +09:00." placeholder="+09:00" maxLength={6} value={offset} editable={!busy} onChangeText={(next) => { setOffset(next); onChange(`${date}T${time}:00${next}`); }} />
  </View>;
}

function StayEditor({ room, busy, act, onSaved }: Props & { onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', area: '', image: '', latitude: '', longitude: '', totalCost: '', checkIn: room.period?.startsOn ?? '', checkOut: room.period?.endsOn ?? '', rating: '', distance: '', bookingLink: '', provider: '' });
  const [id] = useState(() => Crypto.randomUUID());
  const [error, setError] = useState('');
  const field = (key: keyof typeof form, label: string) => <FormField key={key} label={label} value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} editable={!busy} />;
  async function save() {
    const parsed = StaySchema.safeParse({ ...form, id, latitude: form.latitude.trim() ? Number(form.latitude) : NaN, longitude: form.longitude.trim() ? Number(form.longitude) : NaN, totalCost: form.totalCost.trim() ? Number(form.totalCost) : NaN, rating: form.rating.trim() ? Number(form.rating) : NaN });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (await act({ type: 'stay', stay: parsed.data })) onSaved();
  }
  return <View style={s.panel}>
    <Text style={s.heading}>Add a stay to compare</Text><Text style={s.small}>Copy details from a provider listing. Use the total for all travellers and all nights. These are member-entered estimates, not live quotes.</Text>
    {field('name', 'Hotel / stay name')}{field('area', 'City / area')}{field('image', 'Image URL')}
    {field('totalCost', 'Total stay price (MYR)')}
    <DateField label="Check-in" value={form.checkIn} onChange={(checkIn) => setForm({ ...form, checkIn })} />
    <DateField label="Check-out" value={form.checkOut} onChange={(checkOut) => setForm({ ...form, checkOut })} />
    {field('rating', 'Rating (out of 10)')}{field('distance', 'Distance from main trip area')}
    {field('latitude', 'Stay latitude')}{field('longitude', 'Stay longitude')}
    {field('bookingLink', 'Stay booking link')}{field('provider', 'Source / provider')}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <AppButton label="Add stay option" disabled={busy} onPress={() => void save()} />
    {(room.logistics?.stays.length ?? 0) > 0 ? <AppButton label="Cancel" variant="secondary" disabled={busy} onPress={onSaved} /> : null}
  </View>;
}

function StayCard({ stay, room, busy, act }: Props & { stay: Stay }) {
  const [error, setError] = useState('');
  const logistics = room.logistics ?? emptyLogistics;
  const votes = logistics.votes.filter((vote) => vote.stayId === stay.id);
  async function open() {
    try { if (!/^https?:\/\//i.test(stay.bookingLink)) throw new Error(); await Linking.openURL(stay.bookingLink); }
    catch { setError('Could not open this provider. Check the booking link.'); }
  }
  return <View style={s.panel}>
    {stay.provider !== 'AI planning estimate' ? <Image source={{ uri: stay.image }} accessibilityLabel={stay.name} style={{ width: '100%', height: 170, borderRadius: 16 }} /> : null}
    <Text style={s.heading}>{stay.name}{logistics.selectedStayId === stay.id ? ' · Confirmed' : ''}</Text>
    <Text style={s.body}>{stay.area} · {stay.distance}</Text>
    <Text style={s.strong}>{money(stay.totalCost)} total · {money(Math.ceil(stay.totalCost * 100 / room.members.length) / 100)}/person</Text>
    <Text style={s.small}>{stay.checkIn} – {stay.checkOut} · {(Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86400000} nights{stay.provider !== 'AI planning estimate' ? ` · ${stay.rating}/10` : ''}</Text>
    <Text style={s.small}>{stay.provider}{stay.provider === 'AI planning estimate' ? ' · Verify location, price and availability before booking' : ' · Member-entered estimate'}</Text>
    {room.travelParty !== 'solo' ? <AppButton label={`${votes.some((vote) => vote.memberId === room.currentMemberId) ? 'Voted' : 'Vote'} · ${votes.length}`} variant="secondary" disabled={busy} onPress={() => void act({ type: 'stay_vote', stayId: stay.id })} /> : null}
    <AppButton label="View / Book" variant="secondary" onPress={() => void open()} />
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {room.currentRole === 'organizer' ? <AppButton label="Confirm stay" disabled={busy || logistics.selectedStayId === stay.id} onPress={() => void act({ type: 'confirm_stay', stayId: stay.id })} /> : null}
  </View>;
}

export function LogisticsSummary({ room }: { room: QuestRoom }) {
  const logistics = room.logistics ?? emptyLogistics;
  const totals = logisticsTotals(logistics, room.members.map((member) => member.memberId), room.budgetSummary?.comfortablePerPerson ?? 0);
  return <View style={s.panel}>
    <Text style={s.kicker}>LOGISTICS SUMMARY</Text><Text style={s.heading}>{room.members.length} travellers</Text>
    <Text style={s.strong}>Arrival · local time at destination</Text>
    {room.members.map((member) => { const arrival = logistics.transport.find((item) => item.memberId === member.memberId && item.direction === 'arrival' && item.status !== 'proposed'); return <Text key={member.memberId} style={s.body}>{member.displayName} · {arrival ? `${arrival.arrivalAt.slice(0, 10)} ${arrival.arrivalAt.slice(11, 16)} (${arrival.arrivalLocation}, UTC${arrival.arrivalAt.slice(19)})` : 'To be confirmed'}</Text>; })}
    <Text style={s.strong}>Departure · local time at origin</Text>
    {room.members.map((member) => { const departure = logistics.transport.find((item) => item.memberId === member.memberId && item.direction === 'departure' && item.status !== 'proposed'); return <Text key={member.memberId} style={s.body}>{member.displayName} · {departure ? `${departure.departureAt.slice(0, 10)} ${departure.departureAt.slice(11, 16)} (${departure.departureLocation})` : 'To be confirmed'}</Text>; })}
    <Text style={s.heading}>{totals.stay?.name ?? 'Stay to be confirmed'}</Text>
    {totals.stay ? <Text style={s.body}>{totals.stay.checkIn} – {totals.stay.checkOut}{'\n'}{money(totals.stay.totalCost)} total · {money(totals.stayPerPerson)}/person</Text> : null}
    <Text style={s.body}>Average transport/person · {money(Math.round(totals.averageTransport * 100) / 100)}</Text>
    <Text style={s.strong}>Shared activity budget/person · {money(totals.remaining)}</Text>
    <Text style={s.small}>Uses the lowest remaining amount so everyone can afford the shared plan. Unknown costs still need to be reserved.</Text>
    {totals.draft ? <Text style={s.error}>Draft itinerary · {logisticsDraftNotice}</Text> : null}
  </View>;
}

export function LogisticsStage(props: Props) {
  const { room, busy, act, onItinerary, onSectionChange } = props;
  const [tab, setTab] = useState(() => room.stage === 'complete' && !logisticsTotals(room.logistics ?? emptyLogistics, room.members.map((member) => member.memberId), room.budgetSummary?.comfortablePerPerson ?? 0).draft ? 'Summary' : 'Transport');
  const [adding, setAdding] = useState(false);
  const navigate = (next: string) => { setTab(next); onSectionChange?.(); };
  const logistics = room.logistics ?? emptyLogistics;
  const totals = logisticsTotals(logistics, room.members.map((member) => member.memberId), room.budgetSummary?.comfortablePerPerson ?? 0);
  const own = totals.members.find((member) => member.memberId === room.currentMemberId)!;
  async function finish(skip: boolean) { if (await act({ type: 'complete_logistics', skip, revision: room.revision })) onItinerary?.(); }
  return <View style={s.stack}>
    <Choices values={['Transport', 'Accommodation', 'Summary']} value={tab} onChange={navigate} disabled={busy} />
    {tab === 'Transport' ? <TransportForm {...props} /> : null}
    {tab === 'Accommodation' ? <View style={s.stack}>
      <Text style={s.heading}>{room.travelParty === 'solo' ? 'Where will you stay?' : 'Where will everyone stay?'}</Text><Text style={s.body}>{room.travelParty === 'solo' ? 'Compare the suggestions, add your favourite and confirm your stay.' : 'Compare stays and vote for a favourite. The organiser confirms the stay.'} Booking and payment happen with the provider.</Text>
      {logistics.stays.map((stay) => <StayCard key={stay.id} {...props} stay={stay} />)}
      <LogisticsOptions room={room} kind="stays" busy={busy} act={act} />
      {adding ? <StayEditor {...props} onSaved={() => setAdding(false)} /> : <AppButton label="Add my own accommodation" disabled={busy || logistics.stays.length >= 20} onPress={() => setAdding(true)} />}
      {room.currentRole === 'organizer' ? <AppButton label="Help me choose later" variant="secondary" disabled={busy} onPress={() => void act({ type: 'skip_stay' })} /> : null}
      {logistics.staySkipped ? <Text style={s.small}>Stay marked for later.</Text> : null}
    </View> : null}
    <View style={s.success} testID="logistics-budget"><Text style={s.kicker}>YOUR TRIP BUDGET</Text>
      <Text style={s.body}>Trip budget per person · {money(room.budgetSummary?.comfortablePerPerson ?? 0)}</Text>
      <Text style={s.body}>Transport · −{money(own.transportCost)}</Text><Text style={s.body}>Accommodation · −{money(totals.stayPerPerson)}</Text>
      <Text style={s.heading}>Remaining · {money(own.remaining)}</Text>
      <Text style={s.body}>{money(own.remaining)} available for food, activities and local transport</Text>
      {totals.draft ? <Text style={s.small}>Provisional: unknown transport and stay costs are not deducted yet.</Text> : null}
      {totals.remaining < 0 ? <Text accessibilityRole="alert" style={s.error}>Selected logistics exceed the group budget. Choose cheaper transport or a cheaper stay before generating.</Text> : null}
    </View>
    {tab === 'Summary' ? <><LogisticsSummary room={room} /><AppButton label="Edit" variant="secondary" disabled={busy} onPress={() => navigate('Transport')} />
      {room.currentRole === 'organizer' ? <AppButton label={totals.draft ? 'Confirm & Generate Draft Itinerary' : 'Confirm & Generate Itinerary'} disabled={busy || totals.remaining < 0} onPress={() => void finish(totals.draft)} /> : <Text style={s.body}>The organiser can confirm this summary and generate the itinerary.</Text>}
    </> : <>{tab === 'Transport' ? <AppButton label="Next: Accommodation" disabled={busy} onPress={() => navigate('Accommodation')} /> : null}<AppButton label="Review logistics summary" variant={tab === 'Transport' ? 'secondary' : 'primary'} disabled={busy} onPress={() => navigate('Summary')} /></>}
    {room.stage === 'complete' && onItinerary ? <AppButton label="View our itinerary" variant="secondary" onPress={onItinerary} /> : null}
    {tab !== 'Summary' && room.currentRole === 'organizer' ? <AppButton label="Skip for now" variant="secondary" disabled={busy} onPress={() => navigate('Summary')} /> : null}
  </View>;
}
