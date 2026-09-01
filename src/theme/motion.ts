import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const motion = {
  cardThrowMs: 260,
  cardRevealMs: 420,
  reducedFadeMs: 120,
} as const;

export function roundMotion(reduced: boolean) {
  return reduced
    ? { submitDuration: 0, revealDuration: motion.reducedFadeMs, throwDistance: 0, usesSpatialMotion: false }
    : { submitDuration: motion.cardThrowMs, revealDuration: motion.cardRevealMs, throwDistance: 28, usesSpatialMotion: true };
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

