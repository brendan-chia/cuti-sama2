import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton } from '@/components/app-button';
import { malaysiaDestinations, worldDestinations } from '@/features/home/destination-row';
import { questStyles as s } from '@/features/quest/quest-styles';
export default function DestinationDetail() {
  const { name } = useLocalSearchParams<{ name: string }>(); const router = useRouter();
  const place = [...malaysiaDestinations, ...worldDestinations].find(item => item.name === name);
  return <Screen><View style={s.stack}>
    {place ? <><Image source={place.image} accessibilityLabel={place.name} contentFit="cover" style={{ width: '100%', height: 240, borderRadius: 16 }} />
      <Text style={s.small}>{place.region} · Destination idea</Text><Text accessibilityRole="header" style={s.title}>{place.name}</Text><Text style={s.body}>{place.detail}</Text>
      <Text style={s.body}>Start a draft around this destination. You can decide on dates and invite people later.</Text>
      <AppButton label={`Plan a trip to ${place.name}`} onPress={() => router.push({ pathname: '/new-trip', params: { destination: place.name } })} />
    </> : <Text style={s.body}>This destination idea is unavailable.</Text>}
    <AppButton label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
  </View></Screen>;
}
