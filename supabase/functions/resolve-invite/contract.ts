import { z } from 'zod';
import { TokenSchema } from '../_shared/invites.ts';

export const ResolveInvitePayloadSchema = z.object({ token: TokenSchema });
