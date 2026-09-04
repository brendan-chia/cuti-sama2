import { FunctionsHttpError } from '@supabase/supabase-js';

export async function edgeFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch {
      // Fall through to the SDK message or supplied fallback.
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
