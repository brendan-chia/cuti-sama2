import { validateGroqWording } from '../_shared/ai-validation.ts';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

Deno.test('accepts schema-valid wording for supported deterministic facts', () => {
  const value = validateGroqWording({ heading: 'Common ground', summary: 'The group aligns.', facts: [{ factId: 'agreement:vibe:quiet', wording: 'Quiet stays are shared.' }] }, ['agreement:vibe:quiet']);
  assert(value?.facts.length === 1, 'valid wording should pass');
});

Deno.test('rejects unknown conclusions, duplicate fact IDs, extra keys, and invalid schema', () => {
  assert(validateGroqWording({ heading: 'Book Bali', summary: 'Invented.', facts: [{ factId: 'invented:bali', wording: 'Book Bali.' }] }, ['agreement:vibe:quiet']) === null, 'unknown fact should fail');
  assert(validateGroqWording({ heading: 'x', summary: 'x', facts: [{ factId: 'agreement:vibe:quiet', wording: 'x' }, { factId: 'agreement:vibe:quiet', wording: 'y' }] }, ['agreement:vibe:quiet']) === null, 'duplicates should fail');
  assert(validateGroqWording({ heading: 'x', summary: 'x', facts: [], destination: 'Bali' }, ['agreement:vibe:quiet']) === null, 'extra keys should fail');
  assert(validateGroqWording({ heading: '', summary: 'x', facts: [] }, []) === null, 'invalid strings should fail');
});

