import { useLocalSearchParams, useRouter } from 'expo-router';

import { queueInspiration } from '@/features/inspiration/planning';
import { Alert } from 'react-native';
import { CreateTripScreen } from '@/features/trips/create-trip-screen';

export default function CreateTripRoute() {
  const router = useRouter();
  const { inspirationId } = useLocalSearchParams<{ inspirationId?: string }>();
  return (
    <CreateTripScreen
      onCreated={async (trip) => {
        if (inspirationId) {
          try { await queueInspiration(trip.tripId, inspirationId); }
          catch { Alert.alert('Trip created', 'Your inspiration is still saved. Choose it from Explore when you plan your stops.'); }
        }
        router.replace({ pathname: '/trip/[tripId]', params: { tripId: trip.tripId } });
      }}
    />
  );
}
