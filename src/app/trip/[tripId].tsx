import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { z } from 'zod';

import { InviteTokenSchema } from '../../../packages/contracts/src/invite';
import { LobbyScreen } from '@/features/lobby/lobby-screen';

export default function TripLobbyRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const inviteToken = InviteTokenSchema.safeParse(tripId);
  if (inviteToken.success) return <Redirect href={{ pathname: '/invite/[token]', params: { token: inviteToken.data } }} />;
  if (!z.uuid().safeParse(tripId).success) return <Redirect href="/join" />;
  return (
    <LobbyScreen
      tripId={tripId ?? ''}
      onInvite={() => router.push({ pathname: '/trip/[tripId]/share', params: { tripId: tripId ?? '' } })}
      onConstraints={() => router.push({ pathname: '/trip/[tripId]/constraints', params: { tripId: tripId ?? '' } })}
      onPreferences={() => router.push({ pathname: '/trip/[tripId]/room', params: { tripId: tripId ?? '' } })}
      onIdentityLost={() => router.replace('/recover')}
      onAccessRevoked={() => {
        Alert.alert('Trip Room access ended', 'The organiser removed this membership or the room is no longer available.');
        router.replace('/');
      }}
    />
  );
}
