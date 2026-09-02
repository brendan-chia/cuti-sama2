import { useLocalSearchParams, useRouter } from 'expo-router';

import { ReviseItineraryScreen } from '@/features/itinerary-revision/revise-itinerary-screen';

export default function ReviseItineraryRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>(); const router = useRouter();
  return <ReviseItineraryScreen tripId={tripId ?? ''} onBack={() => router.back()} onActivated={(version) => router.replace({ pathname: '/trip/[tripId]/itinerary/[version]' as never, params: { tripId: tripId ?? '', version: String(version) } })} />;
}
