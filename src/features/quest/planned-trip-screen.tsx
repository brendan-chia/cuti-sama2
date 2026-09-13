import { FlightPath } from '@/components/flight-path';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import type { QuestRoom } from '../../../packages/contracts/src/quest';
import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { ItineraryPlan } from './itinerary-plan';
import { loadQuest } from './service';
import { questStyles as s } from './quest-styles';

export function PlannedTripScreen({ tripId, onBack, loadAction = loadQuest }: {
  tripId: string; onBack: () => void; loadAction?: typeof loadQuest;
}) {
  const [room, setRoom] = useState<QuestRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    const requestKey = `${tripId}:${retry}`;
    let activeRequest: string | null = requestKey;
    setRoom(null); setError(null);
    void loadAction(tripId).then(next => { if (activeRequest === requestKey) setRoom(next); })
      .catch(cause => { if (activeRequest === requestKey) setError(cause instanceof Error ? cause.message : 'Could not load the saved trip.'); });
    return () => { activeRequest = null; };
  }, [tripId, loadAction, retry]));
  return <Screen><View style={s.stack}>
    <AppButton label="Back to trip" variant="secondary" onPress={onBack} />
    <Text accessibilityRole="header" style={s.title}>{room?.tripName ?? 'Your trip'}</Text>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><AppButton label="Try again" onPress={() => setRetry(value => value + 1)} /></> :
      !room ? <Text style={s.body}>Loading your saved stops…</Text> :
      room.stage !== 'complete' ? <Text style={s.body}>Generate your itinerary from the Logistics summary when you are ready.</Text> :
      <><FlightPath stage={room.travelParty === 'solo' ? 5 : 6} solo={room.travelParty === 'solo'} /><Text accessibilityRole="header" style={s.heading}>Itinerary station</Text><ItineraryPlan room={room} /></>}
  </View></Screen>;
}
