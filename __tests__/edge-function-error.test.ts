import { FunctionsHttpError } from '@supabase/supabase-js';

import { edgeFunctionErrorMessage } from '@/lib/edge-function-error';

describe('edgeFunctionErrorMessage', () => {
  it('extracts the server JSON error from a non-2xx function response', async () => {
    const error = new FunctionsHttpError(new Response(JSON.stringify({ error: 'The itinerary draft failed safety validation. Retry generation.' }), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    await expect(edgeFunctionErrorMessage(error, 'Fallback')).resolves.toBe('The itinerary draft failed safety validation. Retry generation.');
  });

  it('falls back to a normal error message', async () => {
    await expect(edgeFunctionErrorMessage(new Error('Network unavailable'), 'Fallback')).resolves.toBe('Network unavailable');
  });
});
