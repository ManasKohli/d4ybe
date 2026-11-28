import { randomUUID } from 'node:crypto';
import { createDb, type Sql, type TransactionSql } from '../../src/db/client.js';

/**
 * Integration tests run against the local Supabase stack (`supabase start`), never a hosted
 * project. `npm run test:db` sets TEST_DATABASE_URL; plain `npm test` skips these files.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const TEST_PUBLISHABLE_KEY = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? '';
export const hasDb = Boolean(TEST_DATABASE_URL);

/** Seeded by supabase/seed.sql (local only). */
export const SEED = {
  password: 'D4yLocalDev1',
  admin: { id: '00000000-0000-4000-a000-0000000000a1', email: 'admin@d4y.local' },
  mentor: { id: '00000000-0000-4000-a000-0000000000b1', email: 'mentor@d4y.local' },
  student: { id: '00000000-0000-4000-a000-0000000000c1', email: 'student@d4y.local' },
  cohortId: '00000000-0000-4000-a000-000000000001',
} as const;

/** Sign in through the local Auth API and return a real access token. */
export async function signIn(email: string, password: string = SEED.password): Promise<string> {
  const res = await fetch(`${TEST_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: TEST_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  return body.access_token;
}

if (TEST_DATABASE_URL && !/@(127\.0\.0\.1|localhost):/.test(TEST_DATABASE_URL)) {
  throw new Error('TEST_DATABASE_URL must point at the local Supabase stack');
}

export function testDb(): Sql {
  return createDb({ url: TEST_DATABASE_URL ?? 'postgresql://unset@127.0.0.1:1/unset', max: 2 });
}

class Rollback extends Error {}

/** Run `fn` in a transaction that is always rolled back, so tests never leave rows behind. */
export async function inRollback(sql: Sql, fn: (tx: TransactionSql) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

/** Run `fn` in a savepoint and return the Postgres error it raises, or undefined. */
export async function pgError(tx: TransactionSql, fn: (sp: TransactionSql) => Promise<unknown>) {
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp);
    });
    return undefined;
  } catch (err) {
    return err as { code?: string; message: string };
  }
}

interface AuthUserInput {
  email?: string;
  invited?: boolean;
  metadata?: Record<string, unknown>;
}

/** Insert an auth user the way GoTrue does, which fires the profile trigger. */
export async function createAuthUser(tx: TransactionSql, input: AuthUserInput = {}): Promise<string> {
  const id = randomUUID();
  const email = input.email ?? `${id}@test.d4y.local`;
  await tx`
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, invited_at, created_at, updated_at)
    values (
      '00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated', ${email},
      ${tx.json((input.metadata ?? {}))}, ${input.invited ? new Date() : null}, now(), now()
    )
  `;
  return id;
}
