import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GroupRevealScreen } from '@/features/group-reveal/group-reveal-screen';

export default function GroupRevealRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  return <GroupRevealScreen tripId={tripId ?? ''} onBack={() => router.back()} onNext={(route) => router.push(route as Href)} />;
}
