import { cleanup, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { DestinationCard, DestinationResult, Evidence } from '../packages/contracts/src/destination';
import { DestinationsScreen } from '@/features/destinations/destinations-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
const evidence: Evidence = { status: 'estimated', label: 'Cost: Estimated', sourceLabel: 'Placeholder catalogue', sourceUrl: null, observedAt: '2026-08-15T00:00:00Z', stale: true };
afterEach(async () => { await cleanup(); });

function card(name: string, overrides: Partial<DestinationCard> = {}): DestinationCard {
  return {
    destinationId: `catalogue:${name}`, catalogueId: '10000000-0000-4000-8000-000000000001', name, country: name === 'Penang' ? 'Malaysia' : 'Vietnam', supported: true, eligible: true, excludedBy: [],
    matchReasons: ['Estimated travel time is within every submitted maximum.', 'Interests include food, heritage.'],
    estimate: { currency: 'MYR', minimum: 800, maximum: 1_600, evidence }, travelTimes: [{ origin: 'Kuala Lumpur', minutes: 60, evidence: { ...evidence, label: 'Travel time: Estimated' } }],
    interests: ['food', 'heritage'], primaryCompromise: 'Heat may make long walking days uncomfortable.', confidence: { level: 'medium', label: 'Medium confidence', warning: 'Some evidence is estimated or may be out of date.' },
    provenance: [evidence, { ...evidence, status: 'unavailable', label: 'Visa: Unavailable' }, { ...evidence, status: 'unavailable', label: 'Safety: Unavailable' }, { ...evidence, status: 'unavailable', label: 'Opening hours: Unavailable' }, { ...evidence, status: 'unavailable', label: 'Availability: Unavailable' }], ...overrides,
  };
}
function result(mode: DestinationResult['mode'], destinations: DestinationCard[]): DestinationResult {
  return { tripId, tripName: 'Anywhere together', mode, kind: mode === 'undecided' ? 'discovery' : mode === 'shortlist' ? 'comparison' : 'locked', destinations, noMatch: null, generatedAt: '2026-09-01T00:00:00Z' };
}

describe.each([
  ['destination_locked', 'Evidence before the itinerary', [card('Da Nang')]],
  ['shortlist', 'The trade-offs, side by side', [card('Da Nang'), card('Penang')]],
  ['undecided', 'Filtered possibilities', [card('Da Nang'), card('Penang')]],
] as const)('%s seeded catalogue journey', (mode, heading, destinations) => {
  it('renders the correct journey and transparent card evidence', async () => {
    const screen = await render(<DestinationsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => result(mode, [...destinations]))} />);
    expect(await screen.findByText(heading)).toBeTruthy();
    expect(screen.getByText(destinations[0].name)).toBeTruthy();
    expect(screen.getAllByText(/Cost: Estimated/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Safety: Unavailable/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PRIMARY COMPROMISE/).length).toBeGreaterThan(0);
  });
});

it('shows the minimum revision categories without silently changing constraints', async () => {
  const noMatch: DestinationResult = { ...result('undecided', []), noMatch: { revisionCategories: ['budget', 'travel_time'] } };
  const screen = await render(<DestinationsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => noMatch)} />);
  expect(await screen.findByTestId('destination-no-match')).toBeTruthy();
  expect(screen.getByText('BUDGET')).toBeTruthy(); expect(screen.getByText('TRAVEL TIME')).toBeTruthy();
  expect(screen.getByText(/Nothing has been changed\./)).toBeTruthy();
});

it('keeps a near-match and unsupported manual destination visible with warnings', async () => {
  const near = card('Da Nang', { eligible: false, excludedBy: ['budget'] });
  const unsupported = card('Reykjavík', { destinationId: 'manual:reykjavik', catalogueId: null, country: null, supported: false, interests: [], estimate: { currency: null, minimum: null, maximum: null, evidence: { ...evidence, status: 'unavailable', label: 'Cost: Unavailable' } }, travelTimes: [], confidence: { level: 'low', label: 'Low confidence', warning: 'Not in the launch catalogue. Data may be unavailable.' } });
  const screen = await render(<DestinationsScreen tripId={tripId} onBack={jest.fn()} loadAction={jest.fn(async () => result('shortlist', [near, unsupported]))} />);
  expect(await screen.findByText(/NEAR MATCH/)).toBeTruthy();
  expect(screen.getByText('Not in the launch catalogue · lower-confidence comparison')).toBeTruthy();
  expect(screen.getByText('Travel time: Unavailable')).toBeTruthy();
});
