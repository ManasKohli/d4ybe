import { afterAll, describe, expect, it } from 'vitest';
import { hasDb, SEED, signIn, TEST_PUBLISHABLE_KEY, TEST_SUPABASE_URL, testDb } from '../helpers/db.js';

// Section 8: RLS on, no policies, and the browser-facing roles hold nothing in public.
describe.skipIf(!hasDb)('database lockdown', () => {
  const sql = testDb();
  afterAll(() => sql.end());

  it('has RLS enabled on every table in public', async () => {
    const tables = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    `;
    expect(tables.length).toBeGreaterThanOrEqual(20);
    expect(tables.filter((t) => !t.relrowsecurity).map((t) => t.relname)).toEqual([]);
  });

  it('defines no RLS policies (only the API reads app data)', async () => {
    const policies = await sql`select policyname, tablename from pg_policies where schemaname = 'public'`;
    expect(policies).toEqual([]);
  });

  it('grants anon and authenticated nothing on tables, sequences or functions', async () => {
    const tableGrants = await sql`
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
    `;
    expect(tableGrants).toEqual([]);

    const executable = await sql`
      select p.proname, r.rolname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join (values ('anon'), ('authenticated')) as r (rolname)
      where n.nspname = 'public' and has_function_privilege(r.rolname, p.oid, 'execute')
    `;
    expect(executable).toEqual([]);
  });

  it('pins search_path on every function in public (no search_path hijacking)', async () => {
    const unpinned = await sql`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    `;
    expect(unpinned).toEqual([]);
  });

  it('keeps future tables locked: default privileges give anon and authenticated nothing', async () => {
    const defaults = await sql`
      select d.defaclobjtype, a.grantee::regrole::text as grantee
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
      where n.nspname = 'public' and d.defaclrole = 'postgres'::regrole
        and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
    `;
    expect(defaults).toEqual([]);
  });

  it('seeds the eight program modules from the FE, in order', async () => {
    const rows = await sql<{ slug: string }[]>`select slug from public.program_modules order by sort_order`;
    expect(rows.map((r) => r.slug)).toEqual([
      'start-here',
      'applicant-strategy',
      'dat',
      'casper',
      'personal-statement',
      'application-entries',
      'interview',
      'final-check-in',
    ]);
  });
});

// The same rule seen from the browser: PostgREST with the publishable key, signed out and in.
describe.skipIf(!hasDb)('Data API (PostgREST) exposure', () => {
  const rest = (table: string, token?: string) =>
    fetch(`${TEST_SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { apikey: TEST_PUBLISHABLE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

  it.each(['profiles', 'student_profiles', 'enrollments', 'credit_ledger', 'orders', 'invites', 'submissions'])(
    'refuses %s to a signed-out browser',
    async (table) => {
      const res = await rest(table);
      expect(res.ok).toBe(false);
    },
  );

  it.each(['profiles', 'student_profiles', 'enrollments', 'credit_ledger'])(
    'refuses %s to a signed-in student, even their own rows',
    async (table) => {
      const token = await signIn(SEED.student.email);
      const res = await rest(table, token);
      expect(res.ok).toBe(false);
    },
  );

  it('refuses writes, so a student cannot promote themselves', async () => {
    const token = await signIn(SEED.student.email);
    const res = await fetch(`${TEST_SUPABASE_URL}/rest/v1/profiles?id=eq.${SEED.student.id}`, {
      method: 'PATCH',
      headers: {
        apikey: TEST_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.ok).toBe(false);

    const sql = testDb();
    const [row] = await sql<{ role: string }[]>`select role from public.profiles where id = ${SEED.student.id}`;
    await sql.end();
    expect(row?.role).toBe('student');
  });
});
