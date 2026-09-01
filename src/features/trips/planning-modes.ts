import type { PlanningMode } from '../../../packages/contracts/src/trip';

export type PlanningModeOption = {
  value: PlanningMode;
  eyebrow: string;
  title: string;
  description: string;
  step: string;
};

export const planningModeOptions: PlanningModeOption[] = [
  {
    value: 'destination_locked',
    eyebrow: 'Locked in',
    title: 'We know where we are going',
    description: 'Bring the group together around preferences and build the itinerary.',
    step: '01',
  },
  {
    value: 'shortlist',
    eyebrow: 'Compare',
    title: 'We are choosing between places',
    description: 'Add two to five candidates, then compare them fairly as a group.',
    step: '02',
  },
  {
    value: 'undecided',
    eyebrow: 'Discover',
    title: 'Help us decide',
    description: 'Start with everyone’s constraints and discover a destination together.',
    step: '03',
  },
];
