import { z } from 'zod';
const RoundTypeSchema = z.enum(['vibe', 'pace', 'must_have']);
export const SubmitCardPayloadSchema = z.object({
  tripId: z.uuid(), roundId: z.uuid(), roundType: RoundTypeSchema,
  choiceId: z.string().regex(/^[a-z0-9_]{2,40}$/), customText: z.string().trim().min(1).max(60).nullable(), idempotencyKey: z.uuid(),
}).strict().superRefine((value, context) => {
  if ((value.choiceId === 'custom') !== (value.customText !== null)) context.addIssue({ code: 'custom', path: ['customText'], message: 'Invalid custom card.' });
  if (value.choiceId === 'custom' && value.roundType !== 'must_have') context.addIssue({ code: 'custom', path: ['choiceId'], message: 'Invalid custom card round.' });
});
