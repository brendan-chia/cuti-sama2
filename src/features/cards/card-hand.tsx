import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import type { PreferenceChoice } from '../../../packages/contracts/src/preferences';
import { PreferenceCard } from '@/features/cards/preference-card';
import { colors, spacing, typography } from '@/theme/tokens';

const THROW_DISTANCE = -110;
const THROW_VELOCITY = -760;

export function isUpwardCardThrow(translationY: number, velocityY: number) {
  'worklet';
  return translationY < THROW_DISTANCE || velocityY < THROW_VELOCITY;
}

function SwipeableCard({ card, selected, customText, disabled, reducedMotion, onDropActive, onPlay }: { card: PreferenceChoice; selected: boolean; customText?: string | null; disabled: boolean; reducedMotion: boolean; onDropActive: (active: boolean) => void; onPlay: (card: PreferenceChoice) => void }) {
  const x = useSharedValue(0); const y = useSharedValue(0); const rotation = useSharedValue(0); const active = useSharedValue(false);
  const reset = () => { 'worklet'; x.value = withSpring(0); y.value = withSpring(0); rotation.value = withSpring(0); if (active.value) { active.value = false; runOnJS(onDropActive)(false); } };
  const play = () => onPlay(card);
  const gesture = Gesture.Pan().enabled(!disabled).activeOffsetY([-10, 10]).failOffsetX([-24, 24]).onChange((event) => {
    x.value = Math.max(-24, Math.min(24, event.translationX)); y.value = Math.min(12, event.translationY); rotation.value = Math.max(-6, Math.min(6, event.velocityX / 220));
    const next = event.translationY < -74;
    if (next !== active.value) { active.value = next; runOnJS(onDropActive)(next); }
  }).onEnd((event) => {
    if (isUpwardCardThrow(event.translationY, event.velocityY)) {
      active.value = false; runOnJS(onDropActive)(false);
      if (reducedMotion) runOnJS(play)();
      else y.value = withTiming(-240, { duration: 240 }, (finished) => { if (finished) { runOnJS(play)(); x.value = 0; y.value = 0; rotation.value = 0; } });
    } else reset();
  }).onFinalize(() => { if (y.value > -200) reset(); });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotation.value}deg` }] }));
  return <GestureDetector gesture={gesture}><Animated.View style={animated}><PreferenceCard accessibilityHint={`${card.accessibilityHint} Swipe up or double tap to play this card.`} card={card} compact customText={customText} disabled={disabled} onPress={play} selected={selected} /></Animated.View></GestureDetector>;
}

export function CardHand({ cards, selectedId, customText, disabled, reducedMotion, onDropActive, onPlay }: { cards: PreferenceChoice[]; selectedId: string | null; customText?: string | null; disabled: boolean; reducedMotion: boolean; onDropActive: (active: boolean) => void; onPlay: (card: PreferenceChoice) => void }) {
  return <View style={styles.hand}>
    <Text style={styles.handLabel}>YOUR HAND · SWIPE A CARD UP TO PLAY</Text>
    <ScrollView contentContainerStyle={styles.cards} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} snapToInterval={166} testID="card-hand">
      {cards.map((card) => <SwipeableCard card={card} customText={card.id === 'custom' ? customText : null} disabled={disabled} key={card.id} onDropActive={onDropActive} onPlay={onPlay} reducedMotion={reducedMotion} selected={selectedId === card.id} />)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  hand: { marginHorizontal: -spacing.xl, marginTop: spacing.lg }, handLabel: { color: colors.textMuted, fontSize: typography.label, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.md, paddingHorizontal: spacing.xl },
  cards: { gap: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
});
