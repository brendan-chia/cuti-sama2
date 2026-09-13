import { useLocalSearchParams, useRouter } from 'expo-router';
import { TripModeScreen } from '@/features/trip-mode/trip-mode-screen';
export default function TripModeRoute() {
  const { tripId, changePlan } = useLocalSearchParams<{ tripId: string; changePlan?: string }>();
  const router = useRouter();
  return <TripModeScreen key={tripId} tripId={tripId ?? ''} startWithRescue={changePlan === 'true'} backLabel={changePlan === 'true' ? 'Back to my trips' : 'Back to itinerary'} onBack={() => router.back()} />;
}
