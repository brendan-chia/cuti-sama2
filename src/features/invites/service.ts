import {
  CachedInvitationSchema,
  DisplayNameSchema,
  InviteContextSchema,
  InvitationStatusSchema,
  IssuedInvitationSchema,
  JoinTripResultSchema,
  type CachedInvitation,
  type InvitationStatus,
  type IssuedInvitation,
  type JoinTripResult,
} from '../../../packages/contracts/src/invite';
import * as Crypto from 'expo-crypto';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { ensureAnonymousSession } from '@/lib/auth';
import {
  clearCachedInvitation,
  getCachedInvitation,
  saveCachedInvitation,
  saveLastTripId,
} from '@/lib/secure-storage';
import { requireSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
  parse: (value: unknown) => T,
) {
  await ensureAnonymousSession();
  const { data, error } = await requireSupabase().functions.invoke(functionName, { body });
  if (error) {
    let message = error.message || `${functionName} failed.`;
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json() as { error?: unknown };
        if (typeof payload.error === 'string') message = payload.error;
      } catch {
        // Retain the SDK error when the response has no readable JSON body.
      }
    }
    throw new Error(message);
  }
  try {
    return parse(data);
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      throw new Error('The server returned invitation data in an unexpected format.');
    }
    throw cause;
  }
}

async function readCachedInvitation(tripId: string): Promise<CachedInvitation | null> {
  const raw = await getCachedInvitation(tripId);
  if (!raw) return null;
  try {
    return CachedInvitationSchema.parse(JSON.parse(raw));
  } catch {
    await clearCachedInvitation(tripId);
    return null;
  }
}

export async function getInvitationStatus(tripId: string): Promise<{
  status: InvitationStatus;
  invitation: CachedInvitation | null;
}> {
  const status = await invoke('manage-invite', { action: 'status', tripId }, (value) =>
    InvitationStatusSchema.parse(value),
  );
  const cached = await readCachedInvitation(tripId);
  const invitation = status.status === 'open' && cached?.inviteId === status.inviteId ? cached : null;
  if (cached && !invitation) await clearCachedInvitation(tripId);
  return { status, invitation };
}

async function issue(tripId: string, action: 'issue' | 'rotate'): Promise<IssuedInvitation> {
  const bytes = Crypto.getRandomBytes(32);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    base64 += alphabet[(combined >> 18) & 63];
    base64 += alphabet[(combined >> 12) & 63];
    base64 += second === undefined ? '=' : alphabet[(combined >> 6) & 63];
    base64 += third === undefined ? '=' : alphabet[combined & 63];
  }
  const token = base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const invitation = await invoke(
    'manage-invite',
    { action, tripId, token, idempotencyKey: createUuid() },
    (value) => IssuedInvitationSchema.parse(value),
  );
  await saveCachedInvitation(tripId, JSON.stringify(invitation));
  return invitation;
}

export function issueInvitation(tripId: string) {
  return issue(tripId, 'issue');
}

export function rotateInvitation(tripId: string) {
  return issue(tripId, 'rotate');
}

export async function closeInvitation(tripId: string) {
  const status = await invoke(
    'manage-invite',
    { action: 'close', tripId, idempotencyKey: createUuid() },
    (value) => InvitationStatusSchema.parse(value),
  );
  await clearCachedInvitation(tripId);
  return status;
}

export function resolveInvitation(token: string) {
  return invoke('resolve-invite', { token }, (value) => InviteContextSchema.parse(value));
}

export async function joinTrip(
  token: string,
  displayName: string,
  confirmDuplicate: boolean,
  idempotencyKey = createUuid(),
): Promise<JoinTripResult> {
  const validName = DisplayNameSchema.parse(displayName);
  const result = await invoke(
    'join-trip',
    { token, displayName: validName, confirmDuplicate, idempotencyKey },
    (value) => JoinTripResultSchema.parse(value),
  );
  if (result.status === 'joined') await saveLastTripId(result.tripId);
  return result;
}
