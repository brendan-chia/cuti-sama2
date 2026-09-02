import { useRouter } from 'expo-router';
import { IdentityRecoveryScreen } from '@/features/recovery/identity-recovery-screen';

export default function RecoverRoute() { const router = useRouter(); return <IdentityRecoveryScreen onRejoin={() => router.replace('/join')} onHome={() => router.replace('/')} />; }
