import { calendarDate, useCurrentDate } from '@/lib/current-date';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type DateFieldProps = {
  error?: string;
  label: string;
  minimumDate?: string;
  rangeStart?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
}
function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function displayDate(value: string) {
  return parseDate(value)?.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) ?? 'Choose date';
}

export function DateField({ error, label, minimumDate, rangeStart, onChange, required = false, value }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const today = useCurrentDate();
  const minimum = minimumDate && parseDate(minimumDate) && minimumDate > today ? minimumDate : today;
  const selected = parseDate(value);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0, 12).getDate();
  const lastPreviousMonth = dateOnly(new Date(year, monthIndex, 0, 12));
  const previousDisabled = Boolean(minimum && lastPreviousMonth < minimum);
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  function toggle() {
    if (!showPicker) {
      const freshMinimum = minimum > calendarDate() ? minimum : calendarDate();
      const initial = selected && value >= freshMinimum ? selected : parseDate(freshMinimum)!;
      setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1, 12));
    }
    setShowPicker(!showPicker);
  }
  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.hint}>{required ? 'Required' : 'Optional'} · Tap to choose from the calendar</Text>
    <Pressable accessibilityLabel={label} accessibilityRole="button" aria-expanded={showPicker} accessibilityState={{ expanded: showPicker }} onPress={toggle} style={({ pressed }) => [styles.input, error && styles.inputError, pressed && styles.pressed]}>
      <Text style={selected ? styles.value : styles.placeholder}>{selected ? displayDate(value) : 'Choose date'}</Text><Text aria-hidden style={styles.calendar}>{showPicker ? 'CLOSE' : 'CALENDAR'}</Text>
    </Pressable>
    {showPicker ? <View style={styles.calendarPanel} testID={`${label.toLowerCase().replace(/\s+/g, '-')}-picker`}>
      <View style={styles.monthHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Previous month for ${label}`} aria-disabled={previousDisabled} accessibilityState={{ disabled: previousDisabled }} disabled={previousDisabled} style={[styles.monthButton, previousDisabled && styles.disabled]} onPress={() => setMonth(new Date(year, monthIndex - 1, 1, 12))}><Text style={styles.monthArrow}>‹</Text></Pressable>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.monthTitle}>{month.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Next month for ${label}`} style={styles.monthButton} onPress={() => setMonth(new Date(year, monthIndex + 1, 1, 12))}><Text style={styles.monthArrow}>›</Text></Pressable>
      </View>
      <View style={styles.week}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
      {Array.from({ length: cells.length / 7 }, (_, week) => <View style={styles.week} key={week}>{cells.slice(week * 7, week * 7 + 7).map((day, column) => {
        if (!day) return <View key={column} style={styles.dayCell} />;
        const date = dateOnly(new Date(year, monthIndex, day, 12));
        const disabled = Boolean(minimum && date < minimum);
        const endpoint = date === rangeStart || date === value;
        const inRange = Boolean(rangeStart && value >= rangeStart && date >= rangeStart && date <= value);
        const checked = date === value || date === rangeStart;
        return <Pressable key={column} accessibilityRole="button" accessibilityLabel={displayDate(date)} aria-pressed={checked} aria-disabled={disabled} accessibilityState={{ selected: checked, disabled }} disabled={disabled} onPress={() => { if (date < minimum || date < calendarDate()) return; onChange(date); setShowPicker(Boolean(rangeStart)); }} style={({ pressed }) => [styles.dayCell, disabled && !checked && styles.disabled, pressed && styles.pressed]}>{inRange ? <View testID={`date-range-${date}`} style={[styles.rangeLine, date === rangeStart && { left: '50%' }, date === value && { right: '50%' }]} /> : null}<View style={[styles.dayCircle, endpoint && styles.selectedDay]}><Text style={[styles.dayText, endpoint && styles.selectedText]}>{day}</Text></View></Pressable>;
      })}</View>)}
      <Text style={styles.hint}>Select a day to confirm your date.</Text>
    </View> : null}
    {value ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => onChange('')} style={styles.clearButton}><Text style={styles.clearText}>Clear date</Text></Pressable> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  calendarPanel: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthArrow: { fontSize: 28, color: colors.sky },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: 8 },
  dayCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dayText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rangeLine: { position: 'absolute', left: 0, right: 0, height: 32, backgroundColor: colors.leafSurface },
  selectedDay: { backgroundColor: colors.sky },
  selectedText: { color: colors.paper },
  disabled: { opacity: 0.3 },
  group: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: typography.small, lineHeight: 19 },
  input: {
    alignItems: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  pressed: { opacity: 0.82 },
  value: { color: colors.ink, fontSize: typography.body, flex: 1 },
  placeholder: { color: colors.textMuted, fontSize: typography.body, flex: 1 },
  calendar: { color: colors.sky, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.1 },
  clearButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: spacing.sm },
  clearText: { color: colors.sky, fontSize: typography.small, fontWeight: '700' },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 18 },
});
