import { useLocalSearchParams, useRouter } from 'expo-router';

import { VotingScreen } from '@/features/voting/voting-screen';

export default function VoteRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>(); const router = useRouter();
  return <VotingScreen tripId={tripId ?? ''} onBack={() => router.back()} onItinerary={() => router.push({ pathname: '/trip/[tripId]/itinerary' as never, params: { tripId: tripId ?? '' } })} />;
}
