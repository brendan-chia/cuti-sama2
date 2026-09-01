import { useRouter } from 'expo-router';
import { JoinEntryScreen } from '@/features/invites/join-entry-screen';

export default function JoinRoute() {
  const router = useRouter();
  return <JoinEntryScreen onToken={(token) => router.push({ pathname: '/invite/[token]', params: { token } })} />;
}
