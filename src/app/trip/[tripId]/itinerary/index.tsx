import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItineraryScreen } from '@/features/itinerary/itinerary-screen';

export default function ItineraryRoute() {
  const { tripId, fromQuest } = useLocalSearchParams<{ tripId: string; fromQuest?: string }>(); const router = useRouter();
  const id = tripId ?? '';
  return <ItineraryScreen
    tripId={id}
    autoGenerate={fromQuest === '1'}
    onBack={() => router.back()}
    onReview={(day = 1) => router.push({ pathname: '/trip/[tripId]/itinerary/[version]' as never, params: { tripId: id, version: 'latest', day: String(day) } })}
    onHome={() => router.push({ pathname: '/trip/[tripId]' as never, params: { tripId: id } })}
    onGroup={() => router.push({ pathname: '/trip/[tripId]/room' as never, params: { tripId: id } })}
    onMore={() => router.push({ pathname: '/trip/[tripId]/destinations' as never, params: { tripId: id } })}
  />;
}
