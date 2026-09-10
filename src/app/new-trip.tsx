import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';

export default function NewTrip() {
  const router = useRouter();
  return <Screen><View style={s.stack}>
    <Text style={s.title}>Make your next getaway.</Text>
    <Text style={s.body}>An adventure just for you, or a plan to share with your favourite people.</Text>
    <AppButton label="Plan a solo adventure" onPress={() => router.push('/solo')} />
    <AppButton label="Start a group trip" variant="secondary" onPress={() => router.push('/create')} />
  </View></Screen>;
}
