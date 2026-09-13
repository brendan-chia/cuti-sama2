import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';

export default function Social() {
  const router = useRouter();
  return <Screen><View style={s.stack}>
    <Text style={s.title}>Travel together.</Text>
    <Text style={s.body}>Meet travellers with a trip in mind, or join friends who already have a plan.</Text>
    <View style={s.panel}><Text style={s.kicker}>FIND YOUR TRAVEL PEOPLE</Text><Text style={s.heading}>Explore with new people</Text>
      <Text style={s.body}>Browse public trips and find a group you would like to join.</Text>
      <AppButton label="Discover public trips" onPress={() => router.push('/discover')} />
    </View>
    <View style={s.panel}><Text style={s.kicker}>A PLACE IN THEIR PLANS</Text><Text style={s.heading}>Already invited?</Text>
      <Text style={s.body}>Use an invitation from your friends to join their Trip Room.</Text>
      <AppButton label="Join with an invitation" variant="secondary" onPress={() => router.push('/join')} />
    </View>
  </View></Screen>;
}
