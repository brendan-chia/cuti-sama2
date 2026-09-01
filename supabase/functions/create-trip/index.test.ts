import { CreateTripPayloadSchema } from './contract.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('accepts each valid planning mode shape', () => {
  const base = {
    tripName: 'December escape',
    startsOn: null,
    endsOn: null,
    idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b',
  };
  assert(CreateTripPayloadSchema.safeParse({ ...base, mode: 'destination_locked', destinations: ['Langkawi'] }).success, 'locked mode should pass');
  assert(CreateTripPayloadSchema.safeParse({ ...base, mode: 'shortlist', destinations: ['Bangkok', 'Da Nang'] }).success, 'shortlist should pass');
  assert(CreateTripPayloadSchema.safeParse({ ...base, mode: 'undecided', destinations: [] }).success, 'undecided should pass');
});

Deno.test('rejects duplicate shortlist destinations', () => {
  const result = CreateTripPayloadSchema.safeParse({
    tripName: 'December escape',
    mode: 'shortlist',
    destinations: ['Bangkok', 'bangkok'],
    startsOn: null,
    endsOn: null,
    idempotencyKey: '9ae175da-33cc-4e25-a083-0dfc5dfb733b',
  });
  assert(!result.success, 'duplicates should fail');
});
