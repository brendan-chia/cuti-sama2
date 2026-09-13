import { useLocalSearchParams, useRouter } from 'expo-router';
import { TripModeScreen } from '@/features/trip-mode/trip-mode-screen';
export default function TripModeRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  return <TripModeScreen key={tripId} tripId={tripId ?? ''} onBack={() => router.back()} />;
}
