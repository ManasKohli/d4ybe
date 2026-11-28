import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { Sql } from '../../src/db/client.js';
import { createMeService } from '../../src/modules/me/me.service.js';
import { authAdmin, createAuthUser, hasDb, inRollback, SEED, signIn, TEST_SUPABASE_URL, testDb } from '../helpers/db.js';
import { buildTestApp } from '../helpers/test-app.js';

// End to end: a real token from local Supabase Auth → the API verifies it against the local
// JWKS → the role is read from profiles → GET /me.
describe.skipIf(!hasDb)('GET /me with real Supabase sessions', () => {
  const sql = testDb();
  afterAll(() => sql.end());
  const app = () => buildTestApp({ env: { SUPABASE_URL: TEST_SUPABASE_URL }, sql });

  it('returns the seeded student with seat, modules and credits', async () => {
    const res = await request(app())
      .get('/me')
      .set('Authorization', `Bearer ${await signIn(SEED.student.email)}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      id: SEED.student.id,
      email: SEED.student.email,
      fullName: 'Sam Student',
      role: 'student',
      student: {
        track: 'Canada',
        cycle: '2027',
        cohortId: SEED.cohortId,
        hasSeat: true,
        primaryMentorId: SEED.mentor.id,
        enrolledModules: ['applicant-strategy', 'casper'],
        credits: { review: 3, oneOnOne: 1 },
      },
      mentor: null,
    });
  });

  it('returns the seeded mentor', async () => {
    const res = await request(app())
      .get('/me')
      .set('Authorization', `Bearer ${await signIn(SEED.mentor.email)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'mentor',
      student: null,
      mentor: { status: 'active', title: 'DMD candidate', schedulingUrl: 'https://cal.com/d4y-local-mentor' },
    });
  });

  it('returns the seeded admin', async () => {
    const res = await request(app())
      .get('/me')
      .set('Authorization', `Bearer ${await signIn(SEED.admin.email)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: SEED.admin.id, role: 'admin', student: null, mentor: null });
  });

  it('cuts off a banned user straight away, without waiting for the token to expire', async () => {
    // A throwaway account, so a crash mid-test can't leave a shared seed user banned.
    const email = 'ban.probe@d4y.local';
    const created = await authAdmin('users', { email, password: SEED.password, email_confirm: true });
    expect(created.status).toBe(200);
    try {
      const token = await signIn(email);
      const before = await request(app()).get('/me').set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);
      await sql`update auth.users set banned_until = now() + interval '1 day' where email = ${email}`;
      const res = await request(app()).get('/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    } finally {
      await sql`delete from auth.users where email = ${email}`;
    }
  });

  it('rejects a wrong password at Auth, and no token at the API', async () => {
    await expect(signIn(SEED.admin.email, 'wrong-password-1')).rejects.toThrow('sign-in failed');
    const res = await request(app()).get('/me');
    expect(res.status).toBe(401);
  });

  it('rejects a real token when the API trusts another project', async () => {
    const token = await signIn(SEED.student.email);
    const res = await request(buildTestApp({ env: { SUPABASE_URL: 'http://localhost:54321' }, sql }))
      .get('/me')
      .set('Authorization', `Bearer ${token}`);
    // Same keys, different issuer string: the issuer check alone refuses it.
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!hasDb)('unknown routes when signed in', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('answer 404 in the standard error shape', async () => {
    const res = await request(buildTestApp({ env: { SUPABASE_URL: TEST_SUPABASE_URL }, sql }))
      .get('/nope')
      .set('Authorization', `Bearer ${await signIn(SEED.student.email)}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'No route for GET /nope' } });
  });
});

// What a brand-new sign-up sees first, and a mentor whose profile row is missing.
describe.skipIf(!hasDb)('me service edge cases', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('returns a seatless student with no modules and zero credits', async () => {
    await inRollback(sql, async (tx) => {
      const id = await createAuthUser(tx, { email: 'brand.new@example.com' });
      const me = await createMeService(tx as unknown as Sql).getMe({ id, role: 'student' });
      expect(me).toEqual({
        id,
        email: 'brand.new@example.com',
        fullName: null,
        role: 'student',
        student: {
          track: null,
          cycle: null,
          cohortId: null,
          hasSeat: false,
          primaryMentorId: null,
          enrolledModules: [],
          credits: { review: 0, oneOnOne: 0 },
        },
        mentor: null,
      });
    });
  });

  it('falls back to an onboarding mentor when the mentor profile row is missing', async () => {
    await inRollback(sql, async (tx) => {
      await tx`delete from public.mentor_profiles where user_id = ${SEED.mentor.id}`;
      const me = await createMeService(tx as unknown as Sql).getMe({ id: SEED.mentor.id, role: 'mentor' });
      expect(me.mentor).toEqual({ title: null, status: 'onboarding', schedulingUrl: null });
    });
  });
});
