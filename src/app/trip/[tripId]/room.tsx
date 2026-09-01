import { useLocalSearchParams, useRouter } from 'expo-router';
import { TripRoomScreen } from '@/features/trip-room/trip-room-screen';
export default function TripRoomRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  return <TripRoomScreen tripId={tripId ?? ''} onBack={() => router.back()} />;
}
