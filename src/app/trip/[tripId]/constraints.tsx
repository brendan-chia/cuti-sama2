import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConstraintsScreen } from '@/features/constraints/constraints-screen';

export default function ConstraintsRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  return <ConstraintsScreen tripId={tripId ?? ''} onBack={() => router.back()} onRoom={() => router.push({ pathname: '/trip/[tripId]/room', params: { tripId: tripId ?? '' } })} />;
}
