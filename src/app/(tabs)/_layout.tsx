import { Tabs } from 'expo-router';
export default function MainTabs() {
  return <Tabs tabBar={() => null} screenOptions={{ headerShown: false, lazy: true }}>
    <Tabs.Screen name="index" options={{ title: 'Home' }} />
    <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
    <Tabs.Screen name="inspiration" options={{ title: 'Saved' }} />
    <Tabs.Screen name="profile" options={{ title: 'Account' }} />
  </Tabs>;
}
