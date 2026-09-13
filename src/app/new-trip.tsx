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
    <View style={s.panel}><Text style={s.kicker}>01 · YOUR OWN PACE</Text><Text style={s.heading}>Just you and the possibilities.</Text><Text style={s.body}>Choose your dates, find your places, and make every day your own.</Text><AppButton label="Plan a solo adventure" onPress={() => router.push('/solo')} /></View>
    <View style={s.panel}><Text style={s.kicker}>02 · BETTER TOGETHER</Text><Text style={s.heading}>Get your favourite people on board.</Text><Text style={s.body}>Bring everyone’s ideas together, vote on a destination, and build a shared plan.</Text><AppButton label="Start a group trip" variant="secondary" onPress={() => router.push('/create')} /></View>
  </View></Screen>;
}
