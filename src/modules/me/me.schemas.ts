import { z } from 'zod';
import { ROLES } from '../../types/auth.js';

const track = z.enum(['Canada', 'US']);

/** GET /me: who the caller is and, for students, what they can access (section 6). */
export const meResponse = z.object({
  // Output shapes describe what the database already holds; they don't re-validate it.
  // Auth accepts some addresses zod's email check rejects, and that must never 500 GET /me.
  id: z.guid(),
  email: z.string(),
  fullName: z.string().nullable(),
  role: z.enum(ROLES),
  student: z
    .object({
      track: track.nullable(),
      cycle: z.string().nullable(),
      cohortId: z.guid().nullable(),
      hasSeat: z.boolean(),
      primaryMentorId: z.guid().nullable(),
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
