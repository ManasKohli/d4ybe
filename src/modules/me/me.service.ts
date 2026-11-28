import type { Sql } from '../../db/client.js';
import { AppError } from '../../errors/app-error.js';
import type { AuthUser } from '../../types/auth.js';
import * as repo from './me.repository.js';
import { meResponse, type MeResponse } from './me.schemas.js';

export type MeService = ReturnType<typeof createMeService>;

export function createMeService(sql: Sql) {
  return {
    loadAuthUser: (id: string) => loadAuthUser(sql, id),
    getMe: (user: AuthUser) => getMe(sql, user),
  };
}

/** Used by the auth middleware on every request: the role is read from profiles, never the token. */
async function loadAuthUser(sql: Sql, id: string): Promise<AuthUser | null> {
  const role = await repo.findRole(sql, id);
  return role ? { id, role } : null;
}

async function getMe(sql: Sql, user: AuthUser): Promise<MeResponse> {
  const profile = await repo.findProfile(sql, user.id);
  if (!profile) throw AppError.unauthorized('Invalid or expired token');

  let student: MeResponse['student'] = null;
  if (profile.role === 'student') {
    const [row, modules, credits] = await Promise.all([
      repo.findStudent(sql, user.id),
      repo.listEnrolledModules(sql, user.id),
      repo.listCreditBalances(sql, user.id),
    ]);
    const balance = (kind: repo.CreditRow['kind']) => credits.find((c) => c.kind === kind)?.balance ?? 0;
    student = {
      track: row?.track ?? null,
      cycle: row?.cycle ?? null,
      cohortId: row?.cohort_id ?? null,
      hasSeat: Boolean(row?.cohort_id),
      primaryMentorId: row?.primary_mentor_id ?? null,
      enrolledModules: modules,
      credits: { review: balance('review'), oneOnOne: balance('one_on_one') },
    };
  }

  let mentor: MeResponse['mentor'] = null;
  if (profile.role === 'mentor') {
    const row = await repo.findMentor(sql, user.id);
    mentor = row
      ? { title: row.title, status: row.status, schedulingUrl: row.scheduling_url }
      : { title: null, status: 'onboarding', schedulingUrl: null };
  }

  // Parse on the way out: the schema is the contract, and nothing outside it leaks.
  return meResponse.parse({
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    student,
    mentor,
  });
}
