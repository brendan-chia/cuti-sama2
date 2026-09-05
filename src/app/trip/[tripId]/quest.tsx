import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import { QuestScreen } from '@/features/quest/quest-screen';

export default function TripQuestRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  if (!z.uuid().safeParse(tripId).success) return <Redirect href="/join" />;
  return <QuestScreen key={tripId} tripId={tripId} onBack={() => router.replace({ pathname: '/trip/[tripId]', params: { tripId } })} onItinerary={() => router.push({ pathname: '/trip/[tripId]/itinerary', params: { tripId, fromQuest: '1' } })} />;
}
