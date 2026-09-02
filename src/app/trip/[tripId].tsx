import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { LobbyScreen } from '@/features/lobby/lobby-screen';

export default function TripLobbyRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  return (
    <LobbyScreen
      tripId={tripId ?? ''}
      onInvite={() => router.push({ pathname: '/trip/[tripId]/share', params: { tripId: tripId ?? '' } })}
      onConstraints={() => router.push({ pathname: '/trip/[tripId]/constraints', params: { tripId: tripId ?? '' } })}
      onIdentityLost={() => router.replace('/recover')}
      onAccessRevoked={() => {
        Alert.alert('Trip Room access ended', 'The organiser removed this membership or the room is no longer available.');
        router.replace('/');
      }}
    />
  );
}
