import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItineraryVersionScreen } from '@/features/itinerary-revision/itinerary-version-screen';

export default function ItineraryVersionRoute() {
  const { tripId, version, day } = useLocalSearchParams<{ tripId: string; version: string; day?: string }>(); const router = useRouter();
  const openVersion = (nextVersion: number) => router.replace({ pathname: '/trip/[tripId]/itinerary/[version]' as never, params: { tripId: tripId ?? '', version: String(nextVersion) } });
  return <ItineraryVersionScreen initialDay={Number(day) || 1} tripId={tripId ?? ''} version={version ?? 'latest'} onBack={() => router.back()} onRevise={() => router.push({ pathname: '/trip/[tripId]/itinerary/revise' as never, params: { tripId: tripId ?? '' } })} onVersion={openVersion} />;
}
