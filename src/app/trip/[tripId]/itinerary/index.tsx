import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItineraryScreen } from '@/features/itinerary/itinerary-screen';

export default function ItineraryRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>(); const router = useRouter();
  return <ItineraryScreen tripId={tripId ?? ''} onBack={() => router.back()} />;
}
