import { useLocalSearchParams } from 'expo-router';
import { ShareInvitationScreen } from '@/features/invites/share-invitation-screen';

export default function ShareInvitationRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <ShareInvitationScreen tripId={tripId ?? ''} />;
}
