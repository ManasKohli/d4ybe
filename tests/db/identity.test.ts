import { afterAll, describe, expect, it } from 'vitest';
import { createAuthUser, hasDb, inRollback, pgError, testDb } from '../helpers/db.js';

// D18, D23: a new auth user gets a profile; the role comes only from an invite.
describe.skipIf(!hasDb)('handle_new_user trigger', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('makes a plain sign-up a student with a student profile', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx, { email: 'New.Student@Example.com', metadata: { full_name: '  Riley  ' } });
      const [profile] = await tx`select role, email, full_name from public.profiles where id = ${id}`;
      expect(profile).toEqual({ role: 'student', email: 'new.student@example.com', full_name: 'Riley' });
      const students = await tx`select user_id from public.student_profiles where user_id = ${id}`;
      expect(students).toHaveLength(1);
    });
  });

  it('ignores a role in sign-up metadata', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx, { metadata: { role: 'admin', full_name: 'Mallory' } });
      const [profile] = await tx`select role from public.profiles where id = ${id}`;
      expect(profile?.role).toBe('student');
    });
  });

  it('gives an invited user the invited role and marks the invite accepted', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into public.invites (email, role) values ('mentor.new@example.com', 'mentor')`;
      const id = await createAuthUser(tx, { email: 'mentor.new@example.com', invited: true });
      const [profile] = await tx`select role from public.profiles where id = ${id}`;
      expect(profile?.role).toBe('mentor');
      const [mentor] = await tx`select status from public.mentor_profiles where user_id = ${id}`;
      expect(mentor?.status).toBe('onboarding');
      expect(await tx`select 1 from public.student_profiles where user_id = ${id}`).toHaveLength(0);
      const [invite] = await tx`select accepted_at from public.invites where email = 'mentor.new@example.com'`;
      expect(invite?.accepted_at).toBeInstanceOf(Date);
    });
  });

  it('does not hand staff roles to someone who self-signs-up with an invited address', async () => {
    await inRollback(sql, async (tx) => {
      await tx`insert into public.invites (email, role) values ('boss@example.com', 'admin')`;
      const id = await createAuthUser(tx, { email: 'boss@example.com', invited: false });
      const [profile] = await tx`select role from public.profiles where id = ${id}`;
      expect(profile?.role).toBe('student');
      const [invite] = await tx`select accepted_at from public.invites where email = 'boss@example.com'`;
      expect(invite?.accepted_at).toBeNull();
    });
  });

  it('makes a dashboard invite with no invites row a student (first-admin runbook)', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx, { invited: true });
      const [profile] = await tx`select role from public.profiles where id = ${id}`;
      expect(profile?.role).toBe('student');
    });
  });

  it('keeps profiles.email in step with an auth email change', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`update auth.users set email = 'Changed@Example.com' where id = ${id}`;
      const [profile] = await tx`select email from public.profiles where id = ${id}`;
      expect(profile?.email).toBe('changed@example.com');
    });
  });

  it('deletes a person’s profile and personal rows with their auth user', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      await tx`insert into public.credit_ledger (student_id, kind, delta, reason) values (${id}, 'review', 2, 'grant')`;
      await tx`delete from auth.users where id = ${id}`;
      expect(await tx`select 1 from public.profiles where id = ${id}`).toHaveLength(0);
      expect(await tx`select 1 from public.credit_ledger where student_id = ${id}`).toHaveLength(0);
    });
  });

  it('rejects an unknown role', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx);
      const err = await pgError(tx, (sp) => sp`update public.profiles set role = 'owner' where id = ${id}`);
      expect(err?.code).toBe('23514');
    });
  });
});
