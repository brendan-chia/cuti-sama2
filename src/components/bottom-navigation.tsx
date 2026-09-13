import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';

const destinations = [
  { label: 'Home', accessibilityLabel: 'Homepage', href: '/', path: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  { label: 'Trips', accessibilityLabel: 'Past and ongoing trips', href: '/trips', path: 'M8 6V3h8v3M4 6h16v15H4ZM8 6v15M16 6v15' },
  { label: 'Create', accessibilityLabel: 'Create trip', href: '/new-trip', path: 'M12 5v14M5 12h14' },
  { label: 'Social', accessibilityLabel: 'Friends and social', href: '/social', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-4-4' },
  { label: 'Account', accessibilityLabel: 'Account and profile', href: '/profile', path: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8' },
] as const;

export function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { section } = useGlobalSearchParams();
  const active = pathname.startsWith('/trip/') || pathname === '/trips' || (pathname === '/profile' && section === 'trips') ? '/trips'
    : ['/create', '/solo', '/new-trip'].includes(pathname) ? '/new-trip'
    : ['/social', '/discover', '/join'].includes(pathname) || pathname.startsWith('/invite/') ? '/social'
    : ['/profile', '/inspiration', '/recover'].includes(pathname) ? '/profile' : pathname === '/' ? '/' : '';
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={s.safe}>
    <View style={s.row} accessibilityRole="tablist">
      {destinations.map(item => {
        const selected = item.href === active;
        const create = item.href === '/new-trip';
        return <Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={item.accessibilityLabel} aria-selected={selected} accessibilityState={{ selected }} onPress={() => router.navigate(item.href)} style={({ pressed }) => [s.tab, pressed && s.pressed]}>
          <View style={[s.icon, selected && s.selectedIcon, create && s.create]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={create ? colors.onAction : selected ? colors.sky : colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={item.path} /></Svg>
          </View>
          <Text style={[s.label, selected && s.selectedLabel]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', width: '100%', maxWidth: 720, alignSelf: 'center', paddingVertical: 6 },
  tab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 48, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectedIcon: { backgroundColor: colors.leafSurface },
  create: { backgroundColor: colors.action },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  selectedLabel: { color: colors.sky, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
