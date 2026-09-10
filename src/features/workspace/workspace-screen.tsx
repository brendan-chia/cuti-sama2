import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { decisionLabel, responseSummary, type DecisionKind, type Workspace, type WorkspaceAction, type WorkspacePlace } from '../../../packages/contracts/src/workspace';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { loadWorkspace, updateWorkspace, readCachedWorkspace, WorkspaceAccessError } from './service';
import { InspirationReview } from './inspiration-review';
import { DecisionEditor } from './decision-editor';
import { BookingEditor, PlaceEditor } from './item-editors';
import { colors } from '@/theme/tokens';
import { questStyles as s } from '@/features/quest/quest-styles';

const sections = ['Overview', 'Plan', 'Places', 'Bookings'] as const;
type Section = typeof sections[number];
const titles = { dates: 'Dates', destination: 'Destination', budget: 'Budget' };
type Props = { tripId: string; destination?: string; initialSection?: string; loadAction?: typeof loadWorkspace; updateAction?: typeof updateWorkspace };
export function WorkspaceScreen({ tripId, destination, initialSection, loadAction = loadWorkspace, updateAction = updateWorkspace }: Props) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const snapshot = useRef<Workspace | null>(null);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [section, setSection] = useState<Section>(sections.find(value => value.toLowerCase() === initialSection?.toLowerCase()) ?? 'Overview');
  const [decision, setDecision] = useState<DecisionKind | null>(null); const [people, setPeople] = useState(false);
  const [placeEditor, setPlaceEditor] = useState<WorkspacePlace | 'new' | null>(null);
  const [bookingEditor, setBookingEditor] = useState<Workspace['bookings'][number] | 'new' | null>(null);
  const [busy, setBusy] = useState(false); const saving = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [stale, setStale] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<'all' | 'saved' | 'scheduled'>('all'); const [day, setDay] = useState(1); const [draftDays, setDraftDays] = useState('3');
  const scroll = useRef<ScrollView>(null);
  const accept = useCallback((next: Workspace) => { if (!snapshot.current || next.revision >= snapshot.current.revision) { snapshot.current = next; setWorkspace(next); } }, []);
  const refresh = useCallback(async () => { try { accept(await loadAction(tripId)); setStale(false); } catch (cause) { setStale(true); if (cause instanceof WorkspaceAccessError) { snapshot.current = null; setWorkspace(null); } setError(cause instanceof Error ? cause.message : 'Could not refresh this trip.'); } }, [accept, loadAction, tripId]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => { try { const next = await loadAction(tripId); if (active) { accept(next); setStale(false); } } catch (cause) { if (active) { setStale(true); setError(cause instanceof Error ? cause.message : 'Could not load your trip.'); if (cause instanceof WorkspaceAccessError) { snapshot.current = null; setWorkspace(null); } else { const cached = await readCachedWorkspace(tripId); if (active && cached) accept(cached.value); } } } };
    void load(); const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [accept, loadAction, tripId]));
  async function save(action: WorkspaceAction) {
    if (!workspace || saving.current || stale) return false;
    if (editRevision !== null && editRevision !== workspace.revision) { setError('This trip changed while you were editing. Your draft is kept here. Copy any changes you want to keep, then discard this draft and review the latest version.'); return false; }
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { const updated = await updateAction(tripId, editRevision ?? workspace.revision, action); accept(updated); setEditRevision((placeEditor || bookingEditor || decision) ? updated.revision : null); setNotice(action.type === 'respond' ? 'Your response is saved. The shared decision is not confirmed yet.' : 'Changes saved.'); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your changes were not saved.'); await refresh(); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  function openDecision(value: DecisionKind) { setEditRevision(snapshot.current?.revision ?? null); setDecision(value); }
  function openPlace(value: WorkspacePlace | 'new') { setEditRevision(snapshot.current?.revision ?? null); setPlaceEditor(value); }
  function openBooking(value: Workspace['bookings'][number] | 'new') { setEditRevision(snapshot.current?.revision ?? null); setBookingEditor(value); }
  function closeEditors() { setEditRevision(null); setPlaceEditor(null); setBookingEditor(null); setDecision(null); setError(''); }
  function changeSection(next: Section) { setEditRevision(null); setSection(next); setPeople(false); setDecision(null); setNotice(''); scroll.current?.scrollTo({ y: 0, animated: false }); }
  async function openLink(url: string) { try { await Linking.openURL(url); } catch { setError('Could not open this link. Please try again.'); } }
  const legacy = () => router.push({ pathname: '/trip/[tripId]/legacy', params: { tripId } });
  if (!workspace) return <Screen><View style={s.stack}>
    <Text accessibilityRole="header" style={s.title}>{error ? 'Your trip is still here.' : 'Opening your trip…'}</Text>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Retry workspace" onPress={() => void refresh()} /><AppButton label="Open existing trip planner" variant="secondary" onPress={legacy} /></> : <Text style={s.body}>Loading your shared plan.</Text>}
    <AppButton label="Back to trips" variant="secondary" onPress={() => router.replace('/trips')} />
  </View></Screen>;
  const currentDecision = workspace.decisions.find(value => value.kind === decision);
  const orderedDecisions = (['dates', 'destination', 'budget'] as const).map(kind => workspace.decisions.find(value => value.kind === kind)!);
  const nextDecision = orderedDecisions.find(value => value.status !== 'confirmed' && !value.responses.some(response => response.memberId === workspace.currentMemberId));
  const dates = workspace.decisions.find(value => value.kind === 'dates')?.confirmed;
  const days = Math.max(1, dates?.startsOn && dates.endsOn ? (Date.parse(dates.endsOn) - Date.parse(dates.startsOn)) / 86400000 + 1 : 1, ...workspace.places.map(place => place.day ?? 1));
  const visiblePlaces = workspace.places.filter(place => `${place.name} ${place.location}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'scheduled' ? place.day !== null : place.day === null)));
  const scheduled = workspace.places.filter(place => place.day === day).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const editing = !!(placeEditor || bookingEditor);
  return <Screen testID="trip-workspace" scrollRef={scroll}><View style={s.stack}>
    <View style={style.header}><Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>{workspace.tripName}</Text><Pressable accessibilityRole="button" accessibilityLabel={`People, ${workspace.members.length} travellers`} disabled={editing} onPress={() => { setPeople(!people); setDecision(null); }} style={style.people}><Text style={s.link}>People ({workspace.members.length})</Text></Pressable></View>
    {!editing ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={style.sections} accessibilityRole="tablist">{sections.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value && !people }} onPress={() => changeSection(value)} style={[style.section, section === value && !people && style.active]}><Text style={[s.strong, section === value && style.activeText]}>{value}</Text></Pressable>)}</ScrollView> : null}
    {stale ? <View style={s.success}><Text style={s.body}>Showing the last loaded version. Reconnect before saving.</Text><AppButton label="Reconnect and refresh" variant="secondary" onPress={() => void refresh()} /></View> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {editRevision !== null && editRevision !== workspace.revision && (editing || decision) ? <AppButton label="Discard draft and review latest version" variant="secondary" onPress={closeEditors} /> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text> : null}
    {placeEditor ? <PlaceEditor key={placeEditor === 'new' ? 'new' : placeEditor.id} place={placeEditor === 'new' ? undefined : placeEditor} busy={busy || stale} save={save} close={closeEditors} />
      : bookingEditor ? <BookingEditor key={bookingEditor === 'new' ? 'new' : bookingEditor.id} booking={bookingEditor === 'new' ? undefined : bookingEditor} busy={busy || stale} save={save} close={closeEditors} />
      : people ? <><Text style={s.heading}>Travelling together</Text>{workspace.members.map(member => <View key={member.memberId} style={style.row}><Text style={s.strong}>{member.name}{member.memberId === workspace.currentMemberId ? ' (you)' : ''}</Text><Text style={s.small}>{member.role === 'organizer' ? 'Organiser' : 'Traveller'}</Text></View>)}{workspace.currentRole === 'organizer' && workspace.travelParty !== 'solo' ? <AppButton label="Invite people" onPress={() => router.push({ pathname: '/trip/[tripId]/share', params: { tripId } })} /> : null}<AppButton label="Manage membership" variant="secondary" onPress={legacy} /></>
      : currentDecision ? <DecisionEditor key={decision} workspace={workspace} decision={currentDecision} busy={busy || stale} save={save} close={closeEditors} />
      : section === 'Overview' ? <>
        <Text style={s.heading}>{decisionLabel(workspace.decisions.find(value => value.kind === 'destination')?.confirmed ?? null)}</Text>
        <Text style={s.body}>{decisionLabel(dates ?? null)}</Text>
        {destination && !workspace.decisions.find(value => value.kind === 'destination')?.responses.length ? <View style={s.success}><Text style={s.body}>Your destination idea: {destination}</Text><AppButton label="Save this destination response" disabled={busy || stale} onPress={() => void save({ type: 'respond', kind: 'destination', value: { destination }, abstain: false })} /></View> : null}
        <View style={s.success}><Text style={s.heading}>Your next step</Text><Text style={s.body}>{nextDecision ? `Add your ${titles[nextDecision.kind].toLowerCase()} preference. You can keep planning while others respond.` : 'Your responses are saved. Add places or work on the draft while decisions are being confirmed.'}</Text><AppButton label={nextDecision ? `Choose ${titles[nextDecision.kind].toLowerCase()}` : 'Add a place'} onPress={() => nextDecision ? openDecision(nextDecision.kind) : openPlace('new')} /></View>
        <Text style={s.heading}>Decisions</Text>{orderedDecisions.map(value => <Pressable key={value.kind} accessibilityRole="button" accessibilityLabel={`${titles[value.kind]}, ${responseSummary(value, workspace.members.length)}`} onPress={() => openDecision(value.kind)} style={style.row}><View style={{ flex: 1, gap: 4 }}><Text style={s.strong}>{titles[value.kind]}</Text><Text style={s.small}>{responseSummary(value, workspace.members.length)}</Text></View><Text style={s.link}>Review →</Text></Pressable>)}
        {workspace.needsReview ? <View style={s.success}><Text style={s.heading}>Plan needs review</Text><Text style={s.body}>A confirmed decision changed. Check your saved places, itinerary and bookings.</Text><AppButton label="Review plan" variant="secondary" onPress={() => changeSection('Plan')} /></View> : null}
        <Text style={s.small}>Last updated {new Date(workspace.updatedAt).toLocaleString('en-MY')}</Text>
        <AppButton label="Keep trips across devices" variant="secondary" onPress={() => router.push({ pathname: '/profile', params: { section: 'settings' } })} />
        {workspace.legacyStarted ? <AppButton label="Open previous guided plan" variant="secondary" onPress={() => router.push({ pathname: '/trip/[tripId]/quest', params: { tripId } })} /> : null}
      </> : section === 'Places' ? <>
        <InspirationReview workspace={workspace} busy={busy || stale} save={save} />
        <Text style={s.heading}>Places for this trip</Text><Text style={s.body}>Save possibilities first. Add a day when they belong in the plan.</Text>
        <AppButton label="Add a place" onPress={() => openPlace('new')} /><AppButton label="Use saved inspiration" variant="secondary" onPress={() => router.push('/inspiration')} />
        <FormField label="Search places" value={query} onChangeText={setQuery} />
        <View style={s.row}>{(['all', 'saved', 'scheduled'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.chip, filter === value && s.chipSelected]}><Text style={filter === value ? s.chipTextSelected : s.chipText}>{value === 'all' ? 'All' : value === 'saved' ? 'Unscheduled' : 'Scheduled'}</Text></Pressable>)}</View>
        {!visiblePlaces.length ? <Text style={s.body}>{workspace.places.length ? 'No places match. Change your search or filter.' : 'Your first place will appear here. No dates needed yet.'}</Text> : null}
        {visiblePlaces.map(place => <View key={place.id} style={style.place}><Text style={s.heading}>{place.name}</Text><Text style={s.body}>{place.location}</Text><Text style={s.small}>{place.day ? `Day ${place.day}${place.time ? ` · ${place.time} local time` : ''}` : 'Saved · Not scheduled'}</Text><AppButton label={`Edit ${place.name}`} variant="secondary" onPress={() => openPlace(place)} /><AppButton label={`Locate ${place.name} on map`} variant="secondary" onPress={() => void openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.location}`)}`)} /></View>)}
      </> : section === 'Plan' ? <>
        <Text style={s.heading}>Day-by-day plan</Text><Text style={s.body}>Provisional draft · Confirm dates and check travel times before booking.</Text>
        <ScrollView horizontal contentContainerStyle={s.row}>{Array.from({ length: days }, (_, index) => index + 1).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: day === value }} onPress={() => setDay(value)} style={[s.chip, day === value && s.chipSelected]}><Text style={day === value ? s.chipTextSelected : s.chipText}>Day {value}</Text></Pressable>)}</ScrollView>
        {!scheduled.length ? <Text style={s.body}>No activities on this day. Add a place and choose its day to start planning.</Text> : null}
        {scheduled.map(place => <View key={place.id} style={style.place}><Text style={s.link}>{place.time ? `${place.time} · local time` : 'Time not set'}</Text><Text style={s.heading}>{place.name}</Text><Text style={s.body}>{place.location}</Text>{place.note ? <Text style={s.body}>{place.note}</Text> : null}<Text style={s.small}>Opening hours and travel time not checked.</Text><AppButton label={`Edit time or day for ${place.name}`} variant="secondary" onPress={() => openPlace(place)} /></View>)}
        {workspace.currentRole === 'organizer' && workspace.places.some(place => place.day === null) ? <View style={s.success}><Text style={s.heading}>Start with a simple outline</Text><Text style={s.body}>Spread unscheduled places across your days. Existing activities stay where they are. Review travel times and opening hours yourself.</Text>{!dates ? <FormField label="Number of days for the draft" value={draftDays} onChangeText={setDraftDays} keyboardType="number-pad" maxLength={2} /> : null}<AppButton label="Build a draft from saved places" disabled={busy || stale || (!dates && (!/^\d+$/.test(draftDays) || Number(draftDays) < 1 || Number(draftDays) > 30))} onPress={() => void save({ type: 'build_draft', days: dates ? days : Number(draftDays) })} /></View> : null}
        <AppButton label="Add activity" onPress={() => openPlace('new')} />
        <AppButton label="Choose from saved places" variant="secondary" onPress={() => changeSection('Places')} />
        {workspace.legacyStarted ? <AppButton label="Open previous generated itinerary" variant="secondary" onPress={() => router.push({ pathname: '/trip/[tripId]/itinerary', params: { tripId } })} /> : null}
        {workspace.needsReview && workspace.currentRole === 'organizer' ? <AppButton label="I have reviewed the plan and bookings" disabled={busy || stale} variant="secondary" onPress={() => void save({ type: 'reviewed' })} /> : null}
      </> : <>
        <Text style={s.heading}>Transport and stays</Text><Text style={s.body}>Keep details in one place. Selected options are not bookings.</Text>
        {workspace.currentRole === 'organizer' ? <AppButton label="Add booking details" onPress={() => openBooking('new')} /> : <Text style={s.small}>The organiser manages shared booking details.</Text>}
        {!workspace.bookings.length ? <Text style={s.body}>No bookings added. You can keep planning without booking yet.</Text> : null}
        {workspace.bookings.map(booking => <View key={booking.id} style={style.place}><Text style={s.small}>{booking.kind === 'stay' ? 'Stay' : 'Transport'} · {booking.status === 'booked' ? 'Booked · entered by organiser' : 'Selected · Not booked'}</Text><Text style={s.heading}>{booking.title}</Text><Text style={s.body}>{booking.note}</Text><Text style={s.strong}>{booking.cost === null ? 'Cost not entered' : `RM ${booking.cost.toLocaleString('en-MY')} · total booking cost`}</Text>{booking.url ? <AppButton label="Open provider website" variant="secondary" onPress={() => void openLink(booking.url!)} /> : null}{workspace.currentRole === 'organizer' ? <AppButton label={`Edit ${booking.title}`} variant="secondary" onPress={() => openBooking(booking)} /> : null}</View>)}
      </>}
  </View></Screen>;
}
const style = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, people: { minHeight: 48, justifyContent: 'center' }, sections: { gap: 16 }, section: { minHeight: 48, paddingHorizontal: 4, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, active: { borderBottomColor: colors.sky }, activeText: { color: colors.sky }, row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, place: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 } });
