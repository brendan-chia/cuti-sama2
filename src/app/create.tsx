import { useRouter } from 'expo-router';

import { CreateTripScreen } from '@/features/trips/create-trip-screen';

export default function CreateTripRoute() {
  const router = useRouter();
  return (
    <CreateTripScreen
      onCreated={(trip) => router.replace({ pathname: '/trip/[tripId]', params: { tripId: trip.tripId } })}
    />
  );
}
