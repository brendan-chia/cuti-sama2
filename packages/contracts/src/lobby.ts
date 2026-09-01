import { z } from 'zod';

import { PlanningModeSchema } from './trip';

export const LobbyMemberSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().min(1).max(50),
  discriminator: z.number().int().min(1),
  role: z.enum(['organizer', 'member']),
  ready: z.boolean(),
  joinedAt: z.iso.datetime(),
});

export type LobbyMember = z.infer<typeof LobbyMemberSchema>;

export const LobbySchema = z.object({
  tripId: z.uuid(),
  tripName: z.string().min(2).max(80),
  mode: PlanningModeSchema,
  startedAt: z.iso.datetime().nullable(),
  joiningOpen: z.boolean(),
  currentMemberId: z.uuid(),
  currentRole: z.enum(['organizer', 'member']),
  members: z.array(LobbyMemberSchema).min(1).max(8),
});

export type Lobby = z.infer<typeof LobbySchema>;

export function memberLabel(member: LobbyMember) {
  return member.discriminator > 1
    ? `${member.displayName} · ${member.discriminator}`
    : member.displayName;
}
