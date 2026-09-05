import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RevisionInstruction, RevisionPreview } from '../../../packages/contracts/src/revision';
import { AppButton } from '@/components/app-button';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import { estimateLabel } from '@/features/itinerary-revision/estimate-label';
import { activateItinerary, loadRevisionState, reviseItinerary } from '@/features/itinerary-revision/service';
import { recoveryKind, recoveryMessage } from '@/features/recovery/errors';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Kind = RevisionInstruction['kind'];
type Props = { tripId: string; onBack: () => void; onActivated: (version: number) => void; loadAction?: typeof loadRevisionState; reviseAction?: typeof reviseItinerary; activateAction?: typeof activateItinerary };
const choices: { kind: Kind; label: string; detail: string }[] = [
  { kind: 'pace', label: 'Adjust pace', detail: 'Relax, balance, or fill the days.' },
  { kind: 'replace_activity', label: 'Replace activity', detail: 'Swap one activity while keeping the rest.' },
  { kind: 'budget_cap', label: 'Set budget cap', detail: 'Keep the per-person maximum under a cap.' },
];

export function ReviseItineraryScreen({ tripId, onBack, onActivated, loadAction = loadRevisionState, reviseAction = reviseItinerary, activateAction = activateItinerary }: Props) {
  const [kind, setKind] = useState<Kind>('pace'); const [pace, setPace] = useState<'relaxed' | 'balanced' | 'full'>('balanced'); const [activityId, setActivityId] = useState(''); const [brief, setBrief] = useState(''); const [amount, setAmount] = useState(''); const [currency, setCurrency] = useState('MYR');
  const [baseVersionId, setBaseVersionId] = useState<string | null>(null); const [preview, setPreview] = useState<RevisionPreview | null>(null); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false); const [activating, setActivating] = useState(false); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const state = await loadAction(tripId); if (state.currentRole !== 'organizer') throw new Error('Only the organiser can revise the itinerary.'); setBaseVersionId(state.active?.versionId ?? null); setPreview(state.pending); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open revision tools.'); }
    finally { setLoading(false); }
  }, [loadAction, tripId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const instruction = useMemo<RevisionInstruction | null>(() => {
    if (kind === 'pace') return { kind, pace };
    if (kind === 'replace_activity') return activityId.trim() && brief.trim().length >= 3 ? { kind, activityId: activityId.trim(), replacementBrief: brief.trim() } : null;
    const numeric = Number(amount); return numeric > 0 && /^[A-Z]{3}$/.test(currency.toUpperCase()) ? { kind, amount: numeric, currency: currency.toUpperCase() } : null;
  }, [activityId, amount, brief, currency, kind, pace]);
  const submit = useCallback(async () => {
    if (!baseVersionId || !instruction) return; setSubmitting(true); setError(null);
    try { const result = await reviseAction(tripId, baseVersionId, instruction); setPreview(result.preview); }
    catch (cause) { setError(recoveryMessage(recoveryKind(cause))); }
    finally { setSubmitting(false); }
  }, [baseVersionId, instruction, reviseAction, tripId]);
  const activate = useCallback(async () => {
    if (!baseVersionId || !preview) return; setActivating(true); setError(null);
    try { await activateAction(tripId, preview.candidate.versionId, baseVersionId); onActivated(preview.candidate.version); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not activate this revision.'); }
    finally { setActivating(false); }
  }, [activateAction, baseVersionId, onActivated, preview, tripId]);
  if (loading && !baseVersionId) return <Screen><Text style={styles.title}>Restoring revision history…</Text></Screen>;
  return <Screen testID="revise-itinerary-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Active itinerary</Text></Pressable>
    <Text style={styles.kicker}>BOUNDED REVISION</Text><Text style={styles.title}>{preview ? 'Review before activation' : 'What should change?'}</Text>
    <Text style={styles.intro}>{preview ? 'Only changed days and updated estimates are highlighted. The shared itinerary remains unchanged until you activate this version.' : 'Choose one focused adjustment. The current version stays recoverable.'}</Text>
    {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{error}</Text></View> : null}
    {!preview ? <>
      <View style={styles.choices}>{choices.map((choice) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: choice.kind === kind }} key={choice.kind} onPress={() => setKind(choice.kind)} style={[styles.choice, choice.kind === kind ? styles.choiceSelected : null]} testID={`revision-${choice.kind}`}><Text style={styles.choiceTitle}>{choice.label}</Text><Text style={styles.body}>{choice.detail}</Text></Pressable>)}</View>
      {kind === 'pace' ? <View style={styles.paces}>{(['relaxed', 'balanced', 'full'] as const).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: value === pace }} key={value} onPress={() => setPace(value)} style={[styles.pace, value === pace ? styles.paceSelected : null]}><Text style={styles.paceText}>{value}</Text></Pressable>)}</View> : null}
      {kind === 'replace_activity' ? <View style={styles.fields}><FormField label="Activity ID" value={activityId} onChangeText={setActivityId} autoCapitalize="none" hint="Shown in the activity details." /><FormField label="Replacement brief" value={brief} onChangeText={setBrief} multiline placeholder="A quieter indoor cultural activity" /></View> : null}
      {kind === 'budget_cap' ? <View style={styles.fields}><FormField label="Per-person maximum" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500" /><FormField label="Currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} /></View> : null}
      <View style={styles.action}><AppButton label="Generate revision preview" onPress={() => void submit()} disabled={!instruction || !baseVersionId} loading={submitting} testID="preview-revision" /></View>
    </> : <View style={styles.preview} testID="revision-preview">
      <View style={styles.estimateCard}><Text style={styles.estimateLabel}>UPDATED TRIP ESTIMATE</Text><Text style={styles.estimateBefore}>{estimateLabel(preview.diff.beforeEstimate)}</Text><Text style={styles.estimateAfter}>→ {estimateLabel(preview.diff.afterEstimate)}</Text></View>
      {preview.diff.changedDays.map((day) => <View key={day.dayNumber} style={styles.changedDay} testID={`changed-day-${day.dayNumber}`}><Text style={styles.dayTitle}>Day {day.dayNumber} · {day.change}</Text><Text style={styles.body}>{estimateLabel(day.beforeEstimate)} → {estimateLabel(day.afterEstimate)}</Text>{day.activityChanges.map((item) => <Text key={`${item.activityId}-${item.change}`} style={styles.change}>{item.change.toUpperCase()} · {item.beforeTitle ?? 'New activity'}{item.afterTitle && item.afterTitle !== item.beforeTitle ? ` → ${item.afterTitle}` : ''}</Text>)}</View>)}
      <Text style={styles.summary}>{preview.candidate.itinerary.summary}</Text>
      <View style={styles.action}><AppButton label="Activate revised version" onPress={() => void activate()} loading={activating} testID="activate-revision" /></View>
      <View style={styles.action}><AppButton label="Keep current version" onPress={onBack} variant="secondary" /></View>
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({ back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, body: { color: colors.textMuted, fontSize: typography.small, lineHeight: 20 }, choices: { gap: spacing.md, marginTop: spacing.xl }, choice: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.lg }, choiceSelected: { backgroundColor: colors.surface, borderColor: colors.coral }, choiceTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' }, paces: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, pace: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, padding: spacing.md }, paceSelected: { backgroundColor: colors.coral, borderColor: colors.coral }, paceText: { color: colors.ink, fontSize: typography.small, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' }, fields: { gap: spacing.lg, marginTop: spacing.xl }, action: { marginTop: spacing.lg }, errorBox: { borderColor: colors.danger, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg, padding: spacing.md }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 20 }, preview: { marginTop: spacing.xl }, estimateCard: { backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.xl }, estimateLabel: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, estimateBefore: { color: colors.textMuted, fontSize: typography.small, textDecorationLine: 'line-through' }, estimateAfter: { color: colors.gold, fontSize: typography.heading, fontWeight: '900' }, changedDay: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.sm, paddingVertical: spacing.xl }, dayTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '900' }, change: { color: colors.sky, fontSize: typography.small, fontWeight: '800' }, summary: { color: colors.sky, fontSize: typography.body, lineHeight: 24, marginTop: spacing.xl } });
