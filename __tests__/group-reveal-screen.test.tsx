import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { GroupMatchResult } from '../packages/contracts/src/group-match';
import { GroupRevealScreen } from '@/features/group-reveal/group-reveal-screen';

const mockUseEffect = useEffect;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void | (() => void)) => mockUseEffect(effect, []) }));
const tripId = '67e3c78c-a1e0-41c2-9f1c-582ed656d777';
afterEach(async () => { await cleanup(); });

function result(mode: GroupMatchResult['mode']): GroupMatchResult {
  const actions = {
    destination_locked: { kind: 'generate_itinerary' as const, label: 'Generate an itinerary', route: `/trip/${tripId}/itinerary` },
    shortlist: { kind: 'compare_shortlist' as const, label: 'Compare the shortlist', route: `/trip/${tripId}/shortlist` },
    undecided: { kind: 'discover_destinations' as const, label: 'Discover destinations', route: `/trip/${tripId}/discover` },
  };
  return {
    runId: null, tripId, tripName: 'Anywhere together', mode, status: 'matched', blockingCategories: [], generatedAt: '2026-09-01T00:00:00Z', nextAction: actions[mode],
    prose: { heading: 'Here’s where the group aligns', summary: 'Submitted inputs only.', factWording: {}, source: 'deterministic' },
    facts: [{ factId: 'agreement:climate:cool', kind: 'agreement', category: 'climate', title: 'Climate to respect', detail: 'Cool weather', sourceIds: ['constraint:member:climate'] }],
    sources: [{ sourceId: 'constraint:member:climate', memberId: '11111111-1111-4111-8111-111111111111', attribution: null, groupVisible: false, inputKind: 'constraint', category: 'climate', value: 'Cool weather' }],
  };
}

describe.each([
  ['destination_locked', 'generate_itinerary'], ['shortlist', 'compare_shortlist'], ['undecided', 'discover_destinations'],
] as const)('GroupRevealScreen %s mode', (mode, action) => {
  it('routes the correct next planning action and keeps private attribution hidden', async () => {
    const onNext = jest.fn();
    const screen = await render(<GroupRevealScreen tripId={tripId} onBack={jest.fn()} onNext={onNext} loadAction={jest.fn(async () => result(mode))} />);
    const button = await screen.findByTestId(`next-${action}`);
    await fireEvent.press(button);
    expect(onNext).toHaveBeenCalledWith(result(mode).nextAction.route);
    await fireEvent.press(screen.getByTestId('sources-agreement:climate:cool'));
    await waitFor(() => expect(screen.getByText('Private member input')).toBeTruthy());
    expect(screen.queryByText('Organiser')).toBeNull();
  });
});

it('shows blocking categories, no invented next action, and offers recoverable retry after load errors', async () => {
  const blocked: GroupMatchResult = { ...result('undecided'), status: 'blocked', blockingCategories: ['dates'], nextAction: result('undecided').nextAction };
  let shouldFail = true;
  const load = jest.fn(async () => { if (shouldFail) throw new Error('Request timed out'); return blocked; });
  const screen = await render(<GroupRevealScreen tripId={tripId} onBack={jest.fn()} onNext={jest.fn()} loadAction={load} />);
  expect(await screen.findByText('Request timed out')).toBeTruthy();
  shouldFail = false;
  await fireEvent.press(screen.getByTestId('retry-reveal'));
  expect(await screen.findByText('No valid match remains')).toBeTruthy();
  expect(screen.getByText('DATES')).toBeTruthy();
  expect(screen.queryByTestId('next-discover_destinations')).toBeNull();
});
