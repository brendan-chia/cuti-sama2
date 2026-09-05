import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/theme/tokens';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.midnight },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.midnightRaised },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'Create a Trip Room' }} />
        <Stack.Screen name="join" options={{ title: 'Join a Trip Room' }} />
        <Stack.Screen name="recover" options={{ title: 'Recover room access' }} />
        <Stack.Screen name="invite/[token]" options={{ title: 'Trip invitation' }} />
        <Stack.Screen name="trip/[tripId]" options={{ title: 'Trip Lobby' }} />
        <Stack.Screen name="trip/[tripId]/constraints" options={{ title: 'Trip constraints' }} />
        <Stack.Screen name="trip/[tripId]/room" options={{ title: 'Preference table' }} />
        <Stack.Screen name="trip/[tripId]/share" options={{ title: 'Invite the group' }} />
        <Stack.Screen name="trip/[tripId]/reveal" options={{ title: 'Group match' }} />
        <Stack.Screen name="trip/[tripId]/destinations" options={{ title: 'Destinations' }} />
        <Stack.Screen name="trip/[tripId]/vote" options={{ title: 'Vote' }} />
        <Stack.Screen name="trip/[tripId]/itinerary/index" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[tripId]/itinerary/revise" options={{ title: 'Revise itinerary' }} />
        <Stack.Screen name="trip/[tripId]/itinerary/[version]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
