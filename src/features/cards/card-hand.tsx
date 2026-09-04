import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import type { PreferenceChoice } from '../../../packages/contracts/src/preferences';
import { PreferenceCard } from '@/features/cards/preference-card';
import { colors, spacing, typography } from '@/theme/tokens';

export function CardHand({ cards, selectedId, customText, disabled, onSelect }: { cards: PreferenceChoice[]; selectedId: string | null; customText?: string | null; disabled: boolean; onSelect: (card: PreferenceChoice) => void }) {
  return <View style={styles.hand}>
    <Text style={styles.handLabel}>YOUR HAND · TAP ONE CARD</Text>
    <ScrollView contentContainerStyle={styles.cards} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToInterval={166} testID="card-hand">
      {cards.map((card) => <PreferenceCard card={card} compact customText={card.id === 'custom' ? customText : null} disabled={disabled} key={card.id} onPress={() => onSelect(card)} selected={selectedId === card.id} />)}
    </ScrollView>
  </View>;
}

export function ThrowingCard({ card, customText, disabled, reducedMotion, onDropActive, onThrow }: { card: PreferenceChoice; customText?: string | null; disabled: boolean; reducedMotion: boolean; onDropActive: (active: boolean) => void; onThrow: () => void }) {
  const x = useSharedValue(0); const y = useSharedValue(0); const rotation = useSharedValue(0); const active = useSharedValue(false);
  const reset = () => { 'worklet'; x.value = withSpring(0); y.value = withSpring(0); rotation.value = withSpring(0); if (active.value) { active.value = false; runOnJS(onDropActive)(false); } };
  const gesture = Gesture.Pan().enabled(!disabled).onChange((event) => {
    x.value = event.translationX; y.value = Math.min(16, event.translationY); rotation.value = Math.max(-8, Math.min(8, event.velocityX / 180));
    const next = event.translationY < -74;
    if (next !== active.value) { active.value = next; runOnJS(onDropActive)(next); }
  }).onEnd((event) => {
    if (event.translationY < -110 || event.velocityY < -760) {
      active.value = false; runOnJS(onDropActive)(false);
      if (reducedMotion) runOnJS(onThrow)();
      else y.value = withTiming(-240, { duration: 240 }, (finished) => { if (finished) { runOnJS(onThrow)(); x.value = 0; y.value = 0; rotation.value = 0; } });
    } else reset();
  }).onFinalize(() => { if (y.value > -200) reset(); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotation.value}deg` }] }));
  return <GestureDetector gesture={gesture}><Animated.View style={[styles.throwCard, animated]} testID="draggable-card"><PreferenceCard card={card} customText={customText} disabled={disabled} selected /></Animated.View></GestureDetector>;
}

const styles = StyleSheet.create({
  hand: { marginHorizontal: -spacing.xl, marginTop: spacing.lg }, handLabel: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.md, paddingHorizontal: spacing.xl },
  cards: { gap: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.sm }, throwCard: { alignSelf: 'center', elevation: 12, marginTop: spacing.lg, zIndex: 4 },
});
