import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ConstraintCollection } from '../../../packages/contracts/src/constraints';
import { AppButton } from '@/components/app-button';
import { DateField } from '@/components/date-field';
import { FormField } from '@/components/form-field';
import { Screen } from '@/components/screen';
import {
  buildConstraintRequest, constraintToForm, initialConstraintForm,
  type ConstraintErrors, type ConstraintFormValues,
} from '@/domain/constraint-validation';
import { loadConstraintCollection, lockConstraints, saveConstraints, subscribeToConstraints } from '@/features/constraints/service';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  tripId: string;
  onBack: () => void;
  onRoom?: () => void;
  loadAction?: typeof loadConstraintCollection;
  saveAction?: typeof saveConstraints;
  lockAction?: typeof lockConstraints;
  subscribeAction?: typeof subscribeToConstraints;
};

export function ConstraintsScreen({ tripId, onBack, onRoom, loadAction = loadConstraintCollection, saveAction = saveConstraints, lockAction = lockConstraints, subscribeAction = subscribeToConstraints }: Props) {
  const [collection, setCollection] = useState<ConstraintCollection | null>(null);
  const [values, setValues] = useState<ConstraintFormValues>(initialConstraintForm);
  const [errors, setErrors] = useState<ConstraintErrors>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const ownVersion = useRef<string | null | undefined>(undefined);

  const acceptCollection = useCallback((next: ConstraintCollection) => {
    setCollection(next);
    const nextVersion = next.ownConstraint?.updatedAt ?? null;
    if (!dirty || ownVersion.current !== nextVersion) {
      setValues(constraintToForm(next.ownConstraint));
      setDirty(false);
      ownVersion.current = nextVersion;
    }
  }, [dirty]);

  const refresh = useCallback(async () => {
    try { acceptCollection(await loadAction(tripId)); setErrors((current) => ({ ...current, form: undefined })); }
    catch (cause) { setErrors({ form: cause instanceof Error ? cause.message : 'Could not load constraints.' }); }
  }, [acceptCollection, loadAction, tripId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!collection) return undefined;
    let cleanup: (() => Promise<unknown>) | undefined;
    let active = true;
    void subscribeAction(collection, { onChanged: () => void refresh(), onConnection: (value) => active && setConnected(value) })
      .then((value) => { if (active) cleanup = value; else void value(); });
    return () => { active = false; if (cleanup) void cleanup(); };
  }, [collection?.tripId, refresh, subscribeAction]); // eslint-disable-line react-hooks/exhaustive-deps

  function update<Field extends keyof ConstraintFormValues>(field: Field, value: ConstraintFormValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setDirty(true);
  }

  async function submit() {
    if (!collection) return;
    const result = buildConstraintRequest(tripId, collection.mode, values);
    if (!result.success) { setErrors(result.errors); return; }
    setBusy(true); setErrors({});
    try { acceptCollection(await saveAction(result.data)); setDirty(false); }
    catch (cause) { setErrors({ form: cause instanceof Error ? cause.message : 'Could not save constraints.' }); }
    finally { setBusy(false); }
  }

  async function lock() {
    setBusy(true); setErrors({});
    try { acceptCollection(await lockAction(tripId)); }
    catch (cause) { setErrors({ form: cause instanceof Error ? cause.message : 'Could not lock constraints.' }); }
    finally { setBusy(false); }
  }

  if (!collection) return <Screen scroll={false}><View style={styles.center}><Text style={styles.title}>Opening constraints…</Text>{errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}</View></Screen>;

  const locked = collection.lockedAt !== null;
  const completeCount = collection.members.filter((member) => member.complete).length;
  const undecided = collection.mode === 'undecided';
  return <Screen footer={<View style={styles.footer}>
    {!locked ? <AppButton label={collection.ownConstraint ? 'Update my constraints' : 'Submit my constraints'} loading={busy} onPress={() => void submit()} testID="save-constraints" /> : null}
    {collection.currentRole === 'organizer' && !locked ? <AppButton disabled={!collection.canLock} label="Lock constraints" loading={busy} onPress={() => void lock()} testID="lock-constraints" variant="secondary" /> : null}
    {locked && onRoom ? <AppButton label="Enter preference room" onPress={onRoom} testID="open-preference-room" /> : null}
  </View>} testID="constraints-screen">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ Trip room</Text></Pressable>
    <View style={styles.headingRow}><View style={styles.headingText}><Text style={styles.kicker}>HARD CONSTRAINTS</Text><Text style={styles.title}>{collection.tripName}</Text></View><View style={styles.connection}><View style={[styles.dot, connected ? styles.live : null]} /><Text style={styles.meta}>{connected ? 'Live' : 'Connecting'}</Text></View></View>
    <Text style={styles.intro}>Add the boundaries this trip must respect. These stay separate from preferences and cannot be edited after the organiser locks collection.</Text>
    <View style={[styles.statusCard, locked ? styles.lockedCard : null]}><Text style={styles.statusTitle}>{locked ? 'Collection locked' : `${completeCount} of ${collection.members.length} complete`}</Text><Text style={styles.meta}>{locked ? 'Your submitted constraints are now read-only.' : collection.canLock ? 'Everyone is complete. The organiser can lock collection.' : 'Completion updates live as each traveller submits.'}</Text></View>
    <View style={styles.memberList}>{collection.members.map((member) => <View key={member.memberId} style={styles.memberRow}><Text style={styles.memberName}>{member.displayName}{member.discriminator > 1 ? ` · ${member.discriminator}` : ''}{member.memberId === collection.currentMemberId ? ' (you)' : ''}</Text><Text style={[styles.memberState, member.complete ? styles.complete : null]}>{member.complete ? 'COMPLETE' : 'WAITING'}</Text></View>)}</View>

    <View pointerEvents={locked ? 'none' : 'auto'} style={[styles.form, locked ? styles.readOnly : null]}>
      <Text style={styles.sectionTitle}>Your non-negotiables</Text>
      <Text style={styles.meta}>{undecided ? 'All fields in Essentials are required.' : 'Essentials are optional in this planning mode.'}</Text>
      <FormField error={errors.origin} label={`Origin${undecided ? ' *' : ''}`} onChangeText={(text) => update('origin', text)} placeholder="e.g. Kuala Lumpur, Malaysia" value={values.origin} />
      <View style={styles.group}><DateField error={errors.startsOn} label={`Earliest start${undecided ? ' *' : ''}`} onChange={(value) => update('startsOn', value)} required={undecided} value={values.startsOn} /><DateField error={errors.endsOn} label={`Latest end${undecided ? ' *' : ''}`} minimumDate={values.startsOn || undefined} onChange={(value) => update('endsOn', value)} required={undecided} value={values.endsOn} /></View>
      <FormField error={errors.dateFlexibilityDays} keyboardType="number-pad" label={`Date flexibility in days${undecided ? ' *' : ''}`} onChangeText={(text) => update('dateFlexibilityDays', text)} placeholder="0 for fixed dates" value={values.dateFlexibilityDays} />
      <View style={styles.group}><FormField error={errors.budgetMin} keyboardType="decimal-pad" label={`Minimum budget (MYR)${undecided ? ' *' : ''}`} onChangeText={(text) => update('budgetMin', text)} placeholder="800" value={values.budgetMin} /><FormField error={errors.budgetMax} keyboardType="decimal-pad" label={`Maximum budget (MYR)${undecided ? ' *' : ''}`} onChangeText={(text) => update('budgetMax', text)} placeholder="1500" value={values.budgetMax} /></View>
      <FormField error={errors.maxTravelHours} keyboardType="decimal-pad" label={`Maximum one-way travel time (hours)${undecided ? ' *' : ''}`} onChangeText={(text) => update('maxTravelHours', text)} placeholder="6" value={values.maxTravelHours} />
      <FormField error={errors.accessibilityRequirements} hint="Shared with all trip members during planning. Enter None if there are no requirements." label={`Accessibility requirements${undecided ? ' *' : ''}`} multiline onChangeText={(text) => update('accessibilityRequirements', text)} placeholder="Mobility, sensory, dietary, or other access needs" value={values.accessibilityRequirements} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: values.accessibilityVisibilityConsent }} onPress={() => update('accessibilityVisibilityConsent', !values.accessibilityVisibilityConsent)} style={[styles.consent, errors.accessibilityVisibilityConsent ? styles.consentError : null]}><View style={[styles.checkbox, values.accessibilityVisibilityConsent ? styles.checkboxChecked : null]}><Text style={styles.checkmark}>{values.accessibilityVisibilityConsent ? '✓' : ''}</Text></View><Text style={styles.consentText}>I understand this accessibility information will be visible to trip members.</Text></Pressable>
      {errors.accessibilityVisibilityConsent ? <Text style={styles.error}>{errors.accessibilityVisibilityConsent}</Text> : null}
      <View style={styles.divider} /><Text style={styles.sectionTitle}>Optional filters</Text>
      <FormField label="Climate" onChangeText={(text) => update('climate', text)} placeholder="e.g. Avoid extreme heat" value={values.climate} />
      <FormField label="Visa concern" multiline onChangeText={(text) => update('visaConcern', text)} placeholder="e.g. Visa-free entry required" value={values.visaConcern} />
      <FormField label="Transport" multiline onChangeText={(text) => update('transport', text)} placeholder="e.g. No overnight buses" value={values.transport} />
      <FormField label="Accommodation" multiline onChangeText={(text) => update('accommodation', text)} placeholder="e.g. Step-free private room" value={values.accommodation} />
    </View>
    {errors.form ? <Text accessibilityRole="alert" style={styles.error}>{errors.form}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, back: { color: colors.sky, fontSize: typography.body, marginBottom: spacing.xl }, headingRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, headingText: { flex: 1 }, kicker: { color: colors.coral, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.6 }, title: { color: colors.white, fontSize: typography.title, fontWeight: '900', marginTop: spacing.sm }, intro: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24, marginTop: spacing.md }, connection: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, dot: { backgroundColor: colors.disabled, borderRadius: radius.pill, height: 8, width: 8 }, live: { backgroundColor: colors.sky }, statusCard: { backgroundColor: colors.midnightRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.lg }, lockedCard: { borderColor: colors.gold }, statusTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' }, meta: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 }, memberList: { marginTop: spacing.lg }, memberRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 }, memberName: { color: colors.white, flex: 1, fontSize: typography.small, fontWeight: '700' }, memberState: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800' }, complete: { color: colors.gold }, form: { gap: spacing.lg, marginTop: spacing.xxl }, readOnly: { opacity: 0.72 }, sectionTitle: { color: colors.white, fontSize: typography.heading, fontWeight: '800' }, group: { gap: spacing.lg }, consent: { alignItems: 'flex-start', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg }, consentError: { borderColor: colors.danger }, checkbox: { alignItems: 'center', borderColor: colors.textMuted, borderRadius: 4, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 }, checkboxChecked: { backgroundColor: colors.sky, borderColor: colors.sky }, checkmark: { color: colors.midnight, fontWeight: '900' }, consentText: { color: colors.textMuted, flex: 1, fontSize: typography.small, lineHeight: 19 }, divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: spacing.sm }, error: { color: colors.danger, fontSize: typography.small, lineHeight: 19 }, footer: { gap: spacing.md },
});
