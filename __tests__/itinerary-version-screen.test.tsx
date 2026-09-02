import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { ItineraryVersionScreen } from '@/features/itinerary-revision/itinerary-version-screen';
import { validItinerary } from './itinerary-contract.test';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777'; const versionId = '77e3c78c-a1e0-41c2-9f1c-582ed656d770';
const stored = { versionId, version: 1, generatedAt: '2026-09-02T10:00:00Z', itinerary: validItinerary };
const state = { tripId, tripName: 'Penang escape', currentRole: 'member' as const, active: stored, history: [{ versionId, version: 1, generatedAt: stored.generatedAt, active: true, instruction: null }], pending: null };
afterEach(async () => { jest.clearAllMocks(); await cleanup(); });

it('gives members day-by-day read-only shared access', async () => {
  const screen = await render(<ItineraryVersionScreen tripId={tripId} version="latest" onBack={jest.fn()} onRevise={jest.fn()} onVersion={jest.fn()} loadAction={jest.fn(async () => state)} />);
  expect(await screen.findByTestId('member-readonly')).toBeTruthy();
  expect(screen.getByTestId('day-1')).toBeTruthy();
  expect(screen.queryByTestId('revise-itinerary')).toBeNull();
});

it('allows only the organiser UI to enter revision', async () => {
  const onRevise = jest.fn(); const screen = await render(<ItineraryVersionScreen tripId={tripId} version="latest" onBack={jest.fn()} onRevise={onRevise} onVersion={jest.fn()} loadAction={jest.fn(async () => ({ ...state, currentRole: 'organizer' as const }))} />);
  fireEvent.press(await screen.findByTestId('revise-itinerary'));
  expect(onRevise).toHaveBeenCalledTimes(1);
});
