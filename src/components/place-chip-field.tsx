import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Newlines separate entries; commas remain part of captions and addresses. */
export function PlaceChipField({ value, onChangeText, editable = true }: {
  value: string; onChangeText: (value: string) => void; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const lines = value.split('\n');
  const draft = lines.pop() ?? '';
  const prefix = lines.length ? `${lines.join('\n')}\n` : '';
  function commit() {
    if (editable && draft.trim() && value.length < 6000) onChangeText(`${value}\n`);
  }
  return <View style={styles.group}>
    <Text style={styles.label}>Caption or place names</Text>
    <View style={[styles.field, focused && styles.focused]}>
      {lines.some(line => line.trim()) ? <View style={styles.chips}>
        {lines.map((line, index) => line.trim() ? <View key={index} style={styles.chip}>
          <View style={styles.dot} />
          <Text style={styles.name}>{line}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line}`} accessibilityState={{ disabled: !editable }} disabled={!editable}
            onPress={() => onChangeText([...lines.filter((_, i) => i !== index), draft].join('\n'))}
            style={({ pressed }) => [styles.remove, pressed && editable && styles.pressed]}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View> : null)}
      </View> : null}
      <TextInput accessibilityLabel="Caption or place names" accessibilityHint="Type or paste a caption. Use a new line to add a place chip."
        placeholder="Add a place, or paste a caption…" placeholderTextColor={colors.textMuted}
        value={draft} editable={editable} multiline maxLength={Math.max(0, 6000 - prefix.length)}
        onChangeText={text => { if (editable) onChangeText(prefix + text.replace(/\r\n?/g, '\n')); }}
        onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); commit(); }}
        selectionColor={colors.orange} style={styles.input} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: spacing.sm }, label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  field: { backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  focused: { borderColor: colors.sky, backgroundColor: colors.paper },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingLeft: spacing.md, gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.orange },
  name: { flexShrink: 1, paddingVertical: spacing.sm, color: colors.ink, fontSize: typography.small, lineHeight: 20, fontWeight: '700' },
  remove: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  removeText: { color: colors.textMuted, fontSize: 20, lineHeight: 24 }, pressed: { backgroundColor: colors.surfaceTint },
  input: { minHeight: 44, color: colors.ink, fontSize: typography.body, lineHeight: 23, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, textAlignVertical: 'top' },
});
