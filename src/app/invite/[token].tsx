import { useLocalSearchParams, useRouter } from 'expo-router';
import { JoinTripScreen } from '@/features/invites/join-trip-screen';

export default function InviteRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  return <JoinTripScreen token={token ?? ''} onJoined={(tripId) => router.replace({ pathname: '/trip/[tripId]', params: { tripId } })} />;
}
