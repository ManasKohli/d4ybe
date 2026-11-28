import { z } from 'zod';
import { ROLES } from '../../types/auth.js';

const track = z.enum(['Canada', 'US']);

/** GET /me: who the caller is and, for students, what they can access (section 6). */
export const meResponse = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string().nullable(),
  role: z.enum(ROLES),
  student: z
    .object({
      track: track.nullable(),
      cycle: z.string().nullable(),
      cohortId: z.uuid().nullable(),
      hasSeat: z.boolean(),
      primaryMentorId: z.uuid().nullable(),
      enrolledModules: z.array(z.string()),
      credits: z.object({ review: z.number().int(), oneOnOne: z.number().int() }),
    })
    .nullable(),
  mentor: z
    .object({
      title: z.string().nullable(),
      status: z.enum(['onboarding', 'active', 'paused']),
      schedulingUrl: z.string().nullable(),
    })
    .nullable(),
});

export type MeResponse = z.infer<typeof meResponse>;
