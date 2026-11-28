import type { Sql } from '../../db/client.js';
import type { Role } from '../../types/auth.js';

export interface ProfileRow {
  id: string;
  role: Role;
  full_name: string | null;
  email: string;
}

export interface StudentRow {
  track: 'Canada' | 'US' | null;
  cycle: string | null;
  cohort_id: string | null;
  primary_mentor_id: string | null;
}

export interface MentorRow {
  title: string | null;
  status: 'onboarding' | 'active' | 'paused';
  scheduling_url: string | null;
}

export interface CreditRow {
  kind: 'review' | 'one_on_one';
  balance: number;
}

export async function findRole(sql: Sql, id: string): Promise<Role | null> {
  const [row] = await sql<{ role: Role }[]>`select role from public.profiles where id = ${id}`;
  return row?.role ?? null;
}

export async function findProfile(sql: Sql, id: string): Promise<ProfileRow | null> {
  const [row] = await sql<ProfileRow[]>`
    select id, role, full_name, email from public.profiles where id = ${id}
  `;
  return row ?? null;
}

export async function findStudent(sql: Sql, id: string): Promise<StudentRow | null> {
  const [row] = await sql<StudentRow[]>`
    select track, cycle, cohort_id, primary_mentor_id from public.student_profiles where user_id = ${id}
  `;
  return row ?? null;
}

export async function findMentor(sql: Sql, id: string): Promise<MentorRow | null> {
  const [row] = await sql<MentorRow[]>`
    select title, status, scheduling_url from public.mentor_profiles where user_id = ${id}
  `;
  return row ?? null;
}

export async function listEnrolledModules(sql: Sql, studentId: string): Promise<string[]> {
  const rows = await sql<{ module_slug: string }[]>`
    select e.module_slug
    from public.enrollments e
    join public.program_modules m on m.slug = e.module_slug
    where e.student_id = ${studentId}
    order by m.sort_order
  `;
  return rows.map((row) => row.module_slug);
}

export async function listCreditBalances(sql: Sql, studentId: string): Promise<CreditRow[]> {
  return sql<CreditRow[]>`
    select kind, coalesce(sum(delta), 0)::int as balance
    from public.credit_ledger
    where student_id = ${studentId}
    group by kind
  `;
}
