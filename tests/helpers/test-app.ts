import type { JWTVerifyGetKey } from 'jose';
import { pino } from 'pino';
import { createApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createDb, type Sql } from '../../src/db/client.js';

export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_SUPABASE_URL = 'http://127.0.0.1:54321';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    ALLOWED_ORIGINS: TEST_ORIGIN,
    // postgres.js connects lazily: tests that never query never open a connection.
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/unused',
    SUPABASE_URL: TEST_SUPABASE_URL,
    ...overrides,
  });
}

export interface TestAppOptions {
  env?: Record<string, string>;
  sql?: Sql;
  authKeys?: JWTVerifyGetKey;
}

export function buildTestApp(options: TestAppOptions = {}) {
  const env = testEnv(options.env);
  return createApp({
    env,
    logger: pino({ level: 'silent' }),
    sql: options.sql ?? createDb({ url: env.DATABASE_URL, max: 1 }),
    authKeys: options.authKeys,
  });
}
