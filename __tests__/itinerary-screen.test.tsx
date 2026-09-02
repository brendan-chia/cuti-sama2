import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { ItineraryState } from '../packages/contracts/src/itinerary';
import { ItineraryScreen } from '@/features/itinerary/itinerary-screen';
import { validItinerary } from './itinerary-contract.test';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const operationKey = '8ae175da-33cc-4e25-a083-0dfc5dfb733c';
const stored = { versionId: '77e3c78c-a1e0-41c2-9f1c-582ed656d770', version: 1, generatedAt: '2026-09-02T10:00:00Z', itinerary: validItinerary };
const locked: ItineraryState = { tripId, tripName: 'Penang escape', currentRole: 'organizer', lockedDestination: { name: 'Penang', country: 'Malaysia', lockedAt: '2026-09-02T09:00:00Z' }, latest: null, operation: null };
afterEach(async () => { jest.clearAllMocks(); await cleanup(); });

it('keeps generation unavailable until a destination is locked', async () => {
  const screen = await render(<ItineraryScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => ({ ...locked, lockedDestination: null }))} />);
  expect(await screen.findByTestId('destination-required')).toBeTruthy();
  expect(screen.queryByTestId('generate-itinerary')).toBeNull();
});

it('restores and renders only a schema-valid stored version after restart', async () => {
  const screen = await render(<ItineraryScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => ({ ...locked, latest: stored }))} />);
  expect(await screen.findByTestId('stored-itinerary')).toBeTruthy();
  expect(screen.getByText('Heritage walk')).toBeTruthy();
});

it('restores a pending operation and retries with its original idempotency key', async () => {
  const result = { tripId, version: stored }; const generateAction = jest.fn(async () => result);
  const state = { ...locked, operation: { idempotencyKey: operationKey, status: 'pending' as const, startedAt: '2020-09-02T10:00:00Z', error: null } };
  const screen = await render(<ItineraryScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => state)} generateAction={generateAction} />);
  await fireEvent.press(await screen.findByTestId('retry-itinerary'));
  expect(generateAction).toHaveBeenCalledWith(tripId, operationKey);
});

it('shows progress and a same-operation retry control after the timeout threshold', async () => {
  const never = new Promise<never>(() => undefined); const generateAction = jest.fn(() => never);
  const screen = await render(<ItineraryScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => locked)} generateAction={generateAction} slowAfterMs={0} />);
  await fireEvent.press(await screen.findByTestId('generate-itinerary'));
  expect(screen.getByTestId('itinerary-progress')).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('retry-itinerary-inline')).toBeTruthy());
});
