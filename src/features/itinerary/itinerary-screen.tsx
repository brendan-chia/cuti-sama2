import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ItineraryState, StoredItinerary } from '../../../packages/contracts/src/itinerary';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { ItineraryTopBar, TripBottomNav } from '@/features/itinerary/itinerary-chrome';
import { destinationPhotoUrl } from '@/features/itinerary/remote-photos';
import { generateItinerary, generationOperationKey, loadItineraryState } from '@/features/itinerary/service';
import { createUuid } from '@/lib/uuid';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  tripId: string;
  onBack: () => void;
  onReview?: (dayNumber?: number) => void;
  onHome?: () => void;
  onGroup?: () => void;
  onMore?: () => void;
  loadAction?: typeof loadItineraryState;
  generateAction?: typeof generateItinerary;
  slowAfterMs?: number;
  autoGenerate?: boolean;
};

const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const shortDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Flexible';

function activityGlyph(tags: string[]) {
  const text = tags.join(' ').toLowerCase();
  if (/(food|cafe|market|dining)/.test(text)) return '♨';
  if (/(shop|craft)/.test(text)) return '▰';
  if (/(nature|park|garden)/.test(text)) return '⌁';
  if (/(museum|culture|heritage)/.test(text)) return '◆';
  return '●';
}

function itineraryStats(version: StoredItinerary) {
  const activities = version.itinerary.days.flatMap((day) => day.activities);
  const currencies = new Set(activities.map((item) => item.estimate.currency));
  const total = activities.reduce((sum, item) => sum + item.estimate.maximum, 0);
  const minutes = activities.reduce((sum, item) => sum + toMinutes(item.timeBlock.end) - toMinutes(item.timeBlock.start), 0);
  const dated = version.itinerary.days.filter((day) => day.date);
  return {
    budget: currencies.size === 1 ? `${activities[0]?.estimate.currency ?? ''} ${Math.round(total).toLocaleString()}` : 'Mixed',
    date: dated.length ? `${shortDate(dated[0].date)}${dated.length > 1 ? `–${shortDate(dated.at(-1)?.date ?? null)}` : ''}` : 'Flexible dates',
    hours: `${Math.max(1, Math.round(minutes / 60))} hrs`,
  };
}

export function ItineraryScreen({ tripId, onBack, onReview, onHome, onGroup, onMore, loadAction = loadItineraryState, generateAction = generateItinerary, slowAfterMs = 30_000, autoGenerate = false }: Props) {
  const [state, setState] = useState<ItineraryState | null>(null); const [version, setVersion] = useState<StoredItinerary | null>(null);
  const [operationKey, setOperationKey] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [generating, setGenerating] = useState(false); const [slow, setSlow] = useState(false); const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const autoStarted = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const next = await loadAction(tripId); setState(next); setVersion(next.latest);
      if (next.operation?.status === 'pending') { setOperationKey(next.operation.idempotencyKey); setSlow(Date.now() - Date.parse(next.operation.startedAt) >= slowAfterMs); }
      else if (next.operation?.status === 'failed') { setOperationKey(next.operation.idempotencyKey); setError(next.operation.error); setSlow(true); }
      else { setOperationKey(null); setSlow(false); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore the itinerary.'); }
    finally { setLoading(false); }
  }, [loadAction, slowAfterMs, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = useCallback(async (requestedKey?: string) => {
    const key = requestedKey ?? await generationOperationKey(tripId, state?.lockedDestination?.lockedAt);
    const sequence = ++requestSequence.current; setOperationKey(key); setGenerating(true); setSlow(false); setError(null);
    const timer = setTimeout(() => { if (requestSequence.current === sequence) setSlow(true); }, slowAfterMs);
    try {
      const result = await generateAction(tripId, key);
      if (requestSequence.current === sequence) { setVersion(result.version); setSlow(false); await refresh(); }
    } catch (cause) {
      if (requestSequence.current === sequence) { setError(cause instanceof Error ? cause.message : 'Could not generate the itinerary.'); setSlow(true); }
    } finally { clearTimeout(timer); if (requestSequence.current === sequence) setGenerating(false); }
  }, [generateAction, refresh, slowAfterMs, tripId, state?.lockedDestination?.lockedAt]);

  useEffect(() => {
    if (autoGenerate && !autoStarted.current && !loading && !error && state?.currentRole === 'organizer' && state.lockedDestination && !state.latest && !state.operation && !generating) {
      autoStarted.current = true;
      void run();
    }
  }, [autoGenerate, loading, error, state, generating, run]);

  useEffect(() => {
    if (state?.currentRole !== 'member' || version) return;
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [state?.currentRole, version, refresh]);

  if (loading && !state) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>Restoring itinerary…</Text></View></Screen>;
  if (!state) return <Screen scroll={false}><View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error ?? 'The itinerary is unavailable.'}</Text><View style={styles.action}><AppButton label="Try again" onPress={() => void refresh()} /></View></View></Screen>;

  const locked = state.lockedDestination; const retryKey = operationKey ?? createUuid(); const retryPending = Boolean(operationKey) && slow;
  const footer = version ? <TripBottomNav onHome={onHome ?? onBack} onItinerary={() => undefined} onOpen={() => onReview?.(1)} onGroup={onGroup} onMore={onMore ?? onBack} /> : locked && !error && state.currentRole === 'organizer' ? <View style={styles.generateFooter}>
    {!generating && !retryPending ? <AppButton label="Generate itinerary" onPress={() => void run()} testID="generate-itinerary" /> : null}
    {!generating && retryPending ? <AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary" variant="secondary" /> : null}
  </View> : undefined;

  return <Screen contentStyle={styles.content} footer={footer} testID="itinerary-screen">
    <ItineraryTopBar onBack={onBack} title="Itinerary" />
    {!locked ? <View style={styles.padded}><Text style={styles.kicker}>TRIP PLAN</Text><Text style={styles.title}>Destination required</Text><View style={styles.notice} testID="destination-required"><Text style={styles.sectionTitle}>Lock a destination first</Text><Text style={styles.body}>Generation stays unavailable until the group has locked its final destination.</Text></View></View> : null}
    {locked && !version ? <View style={styles.padded}><Text style={styles.kicker}>AI ITINERARY</Text><Text style={styles.title}>{locked.name}</Text>
      {generating ? <View style={styles.notice} testID="itinerary-progress"><Text style={styles.sectionTitle}>{slow ? 'Still building your draft…' : 'Building your trip…'}</Text><Text accessibilityLiveRegion="polite" style={styles.body}>{slow ? 'This is taking longer than expected. You can safely retry the same request.' : 'Balancing the group’s pace, budget, and must-haves.'}</Text>{slow ? <View style={styles.action}><AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary-inline" variant="secondary" /></View> : null}</View> : null}
      {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{state.currentRole === 'organizer' ? <View style={styles.action}><AppButton label="Retry same request" onPress={() => void run(retryKey)} testID="retry-itinerary-error" variant="secondary" /></View> : null}</View> : null}
      {!generating && !error ? <Text style={styles.intro}>{state.currentRole === 'organizer' ? 'Build a day-by-day plan using your dates, selected places, traveller count and group budget.' : 'Your organiser will generate the shared itinerary. It will appear here when it is ready.'}</Text> : null}
    </View> : null}
    {version ? <View testID="stored-itinerary">
      <View style={styles.hero}>
        <Image accessibilityLabel={`${version.itinerary.destination.name} destination`} cachePolicy="memory-disk" contentFit="cover" priority="high" source={destinationPhotoUrl(version.itinerary.destination.name)} style={StyleSheet.absoluteFill} transition={240} />
        <View style={styles.heroShade} />
        <View style={styles.heroCopy}><Text style={styles.heroTitle}>{version.itinerary.destination.name}</Text><View style={styles.activeChip}><Text style={styles.activeText}>Active</Text></View></View>
      </View>
      <View style={styles.stats}>{(() => { const stats = itineraryStats(version); return <>
        <View style={styles.stat}><Text style={styles.statIcon}>▣</Text><View><Text style={styles.statValue}>{version.itinerary.days.length} days</Text><Text style={styles.statLabel}>{stats.date}</Text></View></View>
        <View style={styles.stat}><Text style={styles.statIcon}>♧</Text><View><Text style={styles.statValue}>{stats.budget}</Text><Text style={styles.statLabel}>Est. total</Text></View></View>
        <View style={styles.stat}><Text style={styles.statIcon}>◷</Text><View><Text style={styles.statValue}>{stats.hours}</Text><Text style={styles.statLabel}>Activities</Text></View></View>
      </>; })()}</View>
      <View style={styles.tabs}><Text style={[styles.tab, styles.activeTab]}>Itinerary</Text><Text style={styles.tab}>Members</Text><Text style={styles.tab}>Notes</Text><Text style={styles.tab}>Files</Text></View>
      <View style={styles.days}>
        {version.itinerary.warnings.map((warning) => <Text key={warning} style={styles.warning}>△ {warning}</Text>)}
        {version.itinerary.days.map((day) => {
          const total = day.activities.reduce((sum, item) => sum + item.estimate.maximum, 0); const currency = day.activities[0]?.estimate.currency;
          return <Pressable accessibilityRole="button" key={day.dayNumber} onPress={() => onReview?.(day.dayNumber)} style={({ pressed }) => [styles.day, pressed ? styles.pressed : null]} testID={`day-${day.dayNumber}`}>
            <View style={styles.dayMeta}><View><Text style={styles.dayLabel}>DAY {day.dayNumber}{day.date ? ` · ${day.date}` : ''}</Text><Text style={styles.dayTitle}>{day.title}</Text></View><View style={styles.dayPrice}><Text style={styles.dayPriceText}>{currency} {Math.round(total).toLocaleString()}</Text></View></View>
            <View style={styles.timeline}>{day.activities.map((activity, index) => <View key={activity.activityId} style={styles.activity} testID={`activity-${activity.activityId}`}>
              <View style={styles.timelineRail}><View style={[styles.activityIcon, index % 2 ? styles.activityIconWarm : null]}><Text style={styles.activityGlyph}>{activityGlyph(activity.tags)}</Text></View>{index < day.activities.length - 1 ? <View style={styles.railLine} /> : null}</View>
              <View style={styles.activityCopy}><Text style={styles.time}>{activity.timeBlock.start}–{activity.timeBlock.end}</Text><Text style={styles.activityTitle}>{activity.title}</Text><Text numberOfLines={1} style={styles.location}>{activity.location.name}</Text><Text numberOfLines={2} style={styles.body}>{activity.description}</Text><Text style={styles.estimate}>{activity.estimate.currency} {activity.estimate.minimum}–{activity.estimate.maximum}</Text></View>
            </View>)}</View>
          </Pressable>;
        })}
        <Text style={styles.source}>Draft confidence {version.itinerary.confidence.score}%. Confirm opening hours, prices, and accessibility before booking.</Text>
      </View>
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0 }, padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl }, center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  action: { marginTop: spacing.lg, width: '100%' }, generateFooter: { gap: spacing.md }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23, marginTop: spacing.lg },
  notice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl }, sectionTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 }, errorBox: { backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.xl, padding: spacing.lg }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, textAlign: 'center' },
  hero: { backgroundColor: colors.surfaceTint, height: 176, overflow: 'hidden', position: 'relative' }, heroShade: { backgroundColor: 'rgba(66, 46, 30, .25)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, heroCopy: { bottom: spacing.lg, left: spacing.lg, position: 'absolute' }, heroTitle: { color: colors.paper, fontSize: 24, fontWeight: '900', letterSpacing: -.6, textShadowColor: 'rgba(0,0,0,.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }, activeChip: { alignSelf: 'flex-start', backgroundColor: colors.sky, borderRadius: radius.sm, marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3 }, activeText: { color: colors.paper, fontSize: 9, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, stat: { alignItems: 'center', backgroundColor: colors.sand, borderRadius: radius.sm, flex: 1, flexDirection: 'row', gap: 6, minHeight: 48, paddingHorizontal: spacing.sm }, statIcon: { color: colors.disabled, fontSize: 15 }, statValue: { color: colors.ink, fontSize: 10, fontWeight: '900' }, statLabel: { color: colors.disabled, fontSize: 8, marginTop: 2 },
  tabs: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.xl, paddingHorizontal: spacing.lg }, tab: { color: colors.textMuted, fontSize: 10, paddingBottom: spacing.md, paddingTop: spacing.sm }, activeTab: { borderBottomColor: colors.sky, borderBottomWidth: 2, color: colors.ink, fontWeight: '800' },
  days: { gap: spacing.md, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, paddingTop: spacing.lg }, day: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', padding: spacing.md }, pressed: { opacity: .78, transform: [{ scale: .995 }] }, dayMeta: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, dayLabel: { color: colors.sky, fontSize: 9, fontWeight: '800', letterSpacing: .7 }, dayTitle: { color: colors.sky, fontSize: typography.body, fontWeight: '800', marginTop: spacing.sm }, dayPrice: { backgroundColor: colors.background, borderColor: colors.gold, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.sm, paddingVertical: 4 }, dayPriceText: { color: colors.gold, fontSize: 8, fontWeight: '800' },
  timeline: { marginTop: spacing.md }, activity: { flexDirection: 'row', minHeight: 104 }, timelineRail: { alignItems: 'center', width: 44 }, activityIcon: { alignItems: 'center', backgroundColor: colors.sky, borderRadius: radius.pill, height: 34, justifyContent: 'center', width: 34 }, activityIconWarm: { backgroundColor: colors.coral }, activityGlyph: { color: colors.ink, fontSize: 15, fontWeight: '900' }, railLine: { backgroundColor: colors.border, flex: 1, marginVertical: 3, width: 1 }, activityCopy: { flex: 1, paddingBottom: spacing.md }, time: { color: colors.sky, fontSize: 9, fontWeight: '800' }, activityTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 3 }, location: { color: colors.sky, fontSize: 9, marginTop: 3 }, estimate: { alignSelf: 'flex-start', backgroundColor: colors.surfaceTint, borderRadius: 4, color: colors.gold, fontSize: 8, fontWeight: '800', marginTop: 5, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 2 }, warning: { color: colors.gold, fontSize: typography.small, lineHeight: 18 }, source: { color: colors.textMuted, fontSize: 9, lineHeight: 15, marginTop: spacing.md, textAlign: 'center' },
});
