import { Redirect, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';
import { InviteTokenSchema } from '../../../packages/contracts/src/invite';
import { WorkspaceScreen } from '@/features/workspace/workspace-screen';
export default function TripWorkspaceRoute() {
  const { tripId, destination, section } = useLocalSearchParams<{ tripId: string; destination?: string; section?: string }>();
  const token = InviteTokenSchema.safeParse(tripId);
  if (token.success) return <Redirect href={{ pathname: '/invite/[token]', params: { token: token.data } }} />;
  if (!z.uuid().safeParse(tripId).success) return <Redirect href="/join" />;
  return <WorkspaceScreen key={tripId} tripId={tripId} destination={destination} initialSection={section} />;
}
