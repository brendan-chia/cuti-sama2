import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';

const destinations = [
  { label: 'Home', accessibilityLabel: 'Home', href: '/', path: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  { label: 'Trips', accessibilityLabel: 'Trips', href: '/trips', path: 'M8 6V3h8v3M4 6h16v15H4ZM8 6v15M16 6v15' },
  { label: 'Saved', accessibilityLabel: 'Saved ideas', href: '/inspiration', path: 'M6 3h12v19l-6-4-6 4Z' },
  { label: 'Account', accessibilityLabel: 'Account', href: '/profile', path: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8' },
] as const;

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { section } = useGlobalSearchParams();
  const active = pathname === '/inspiration' ? '/inspiration'
    : pathname === '/profile' && section !== 'trips' ? '/profile'
    : pathname === '/' || pathname === '/destination' ? '/' : '/trips';
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={s.safe}>
    <View style={s.row} accessibilityRole="tablist">
      {destinations.map(item => {
        const selected = item.href === active;
        return <Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={item.accessibilityLabel} accessibilityState={{ selected }} onPress={() => router.navigate(item.href)} style={({ pressed }) => [s.tab, pressed && s.pressed]}>
          <View style={[s.icon, selected && s.selectedIcon]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={selected ? colors.sky : colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={item.path} /></Svg>
          </View>
          <Text style={[s.label, selected && s.selectedLabel]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center', paddingVertical: 6 },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 46, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selectedIcon: { backgroundColor: colors.surfaceTint },
  create: { backgroundColor: colors.sky },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  selectedLabel: { color: colors.sky, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
