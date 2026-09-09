import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadProfile } from '@/features/profile/service';
import { colors, radius, spacing } from '@/theme/tokens';

export function PersonalMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadProfile().then(profile => { if (active) { setAvatar(profile.avatar_url); setName(profile.display_name); } }).catch(() => {});
    return () => { active = false; };
  }, []));
  const entries = [
    { label: 'My trips', icon: '✈', section: 'trips' },
    { label: 'Travel passport / profile', icon: '◎', section: 'passport' },
    { label: 'Saved inspiration', icon: '♡', section: 'inspiration' },
    { label: 'Settings', icon: '⚙', section: 'settings' },
  ];
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open personal space" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
      {avatar ? <Image source={{ uri: avatar }} onError={() => setAvatar(null)} style={styles.photo} /> : <Text style={styles.initial}>{name.trim().slice(0, 1).toUpperCase() || '◎'}</Text>}
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss personal menu" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <SafeAreaView pointerEvents="box-none" style={styles.safe}>
          <View style={styles.menu} accessibilityViewIsModal>
            <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>Your personal space</Text><Text style={styles.subtitle}>{name || 'Your next adventure starts here.'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close personal menu" onPress={() => setOpen(false)} style={styles.close}><Text style={styles.icon}>×</Text></Pressable></View>
            {entries.map(entry => <Pressable key={entry.section} accessibilityRole="button" onPress={() => { setOpen(false); if (entry.section === 'inspiration') router.push('/inspiration'); else router.push({ pathname: '/profile', params: { section: entry.section } }); }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <Text style={styles.icon}>{entry.icon}</Text><Text style={styles.label}>{entry.label}</Text><Text style={styles.chevron}>›</Text>
            </Pressable>)}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surfaceTint, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' }, initial: { fontSize: 23, fontWeight: '800', color: colors.sky },
  overlay: { flex: 1, backgroundColor: 'rgba(91,64,46,0.25)' }, safe: { flex: 1, alignItems: 'flex-end', padding: spacing.lg },
  menu: { width: '100%', maxWidth: 380, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }, copy: { flex: 1 },
  title: { color: colors.ink, fontWeight: '800', fontSize: 20 }, subtitle: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, minHeight: 56 },
  icon: { color: colors.sky, fontSize: 23 }, label: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' }, chevron: { color: colors.textMuted, fontSize: 23 }, pressed: { opacity: 0.65 },
});
