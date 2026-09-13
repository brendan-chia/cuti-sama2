import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { questStyles as s } from '@/features/quest/quest-styles';
import { demoTrips } from './demo-trip-data';

export function DemoTrips() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  return <View style={s.stack}>
    <Text accessibilityRole="header" style={s.heading}>Trips to explore</Text>
    <Text style={s.small}>Demo trips with fictional hosts, sample itineraries and estimated budgets. Requests are simulated for this demo.</Text>
    {demoTrips.map(trip => {
      const open = expanded === trip.id;
      const sent = requested.includes(trip.id);
      return <View key={trip.id} style={s.panel}>
        <Text style={s.kicker}>DEMO TRIP · {trip.destination}</Text>
        <Text accessibilityRole="header" style={s.heading}>{trip.name}</Text>
        <Text style={s.body}>{trip.description}</Text>
        <Text style={s.small}>Hosted by {trip.host} · {trip.travellers}/{trip.capacity} travellers</Text>
        <Text style={s.body}>{trip.dates}</Text>
        <Text style={s.strong}>{trip.budget}</Text>
        <AppButton label={open ? 'Hide trip details' : 'View trip details'} variant="secondary" onPress={() => setExpanded(open ? null : trip.id)} />
        {open ? <View style={s.stack}>
          <Text style={s.strong}>{trip.style}</Text>
          <Text accessibilityRole="header" style={s.heading}>The plan</Text>
          {trip.days.map(day => <Text key={day} style={s.body}>{day}</Text>)}
          <Text accessibilityRole="header" style={s.heading}>Budget & meeting point</Text>
          <Text style={s.body}>{trip.included}</Text>
          <Text style={s.body}>{trip.meeting}</Text>
          <Text style={s.small}>Sample plan only. Accommodation, activities and transport are not booked.</Text>
          <AppButton label={sent ? 'Request sent' : 'Request to join'} disabled={sent} onPress={() => setRequested(current => [...current, trip.id])} />
          {sent ? <Text accessibilityLiveRegion="polite" style={s.body}>Request sent · Demo only. No real host has been contacted.</Text> : null}
        </View> : null}
      </View>;
    })}
  </View>;
}
