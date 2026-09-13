import type { ReactNode } from 'react';
import { View } from 'react-native';
import { questStyles as s } from '@/features/quest/quest-styles';

export function ItineraryDays({ children }: { children: ReactNode[] }) {
  return <View style={s.stack} testID="itinerary-list">{children}</View>;
}
