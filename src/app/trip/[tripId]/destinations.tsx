import { useLocalSearchParams, useRouter } from 'expo-router';

import { DestinationsScreen } from '@/features/destinations/destinations-screen';

export default function DestinationsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>(); const router = useRouter();
  return <DestinationsScreen tripId={tripId ?? ''} onBack={() => router.back()} onContinue={() => router.push({ pathname: '/trip/[tripId]/itinerary' as never, params: { tripId: tripId ?? '' } })} />;
}

