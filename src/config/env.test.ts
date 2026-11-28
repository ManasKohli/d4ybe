import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://postgres.ref:pw@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  SUPABASE_URL: 'https://ref.supabase.co',
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(REQUIRED);
    // D2: a missing NODE_ENV must never pull in dev-only packages (pino-pretty), so it defaults to production.
    expect(env).toEqual({ NODE_ENV: 'production', PORT: 8080, LOG_LEVEL: 'info', ALLOWED_ORIGINS: [], ...REQUIRED });
  });

  it('coerces PORT and splits ALLOWED_ORIGINS', () => {
    const env = loadEnv({ ...REQUIRED, PORT: '3000', ALLOWED_ORIGINS: 'http://localhost:5173, https://d4y.example ,' });
    expect(env.PORT).toBe(3000);
    expect(env.ALLOWED_ORIGINS).toEqual(['http://localhost:5173', 'https://d4y.example']);
  });

  it.each([
    [{ PORT: 'abc' }, 'PORT'],
    [{ NODE_ENV: 'staging' }, 'NODE_ENV'],
    [{ ALLOWED_ORIGINS: 'not a url' }, 'ALLOWED_ORIGINS'],
    [{ ALLOWED_ORIGINS: 'ftp://files.example' }, 'ALLOWED_ORIGINS'],
    // Browsers send a bare origin; a trailing slash or path would never match and silently break CORS.
    [{ ALLOWED_ORIGINS: 'https://app.example.com/' }, 'ALLOWED_ORIGINS'],
    [{ ALLOWED_ORIGINS: 'https://app.example.com/portal' }, 'ALLOWED_ORIGINS'],
    [{ DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ DATABASE_URL: 'mysql://db.example/app' }, 'DATABASE_URL'],
    [{ SUPABASE_URL: undefined }, 'SUPABASE_URL'],
    [{ SUPABASE_URL: 'https://ref.supabase.co/' }, 'SUPABASE_URL'],
    [{ DATABASE_CA_CERT: 'not a pem' }, 'DATABASE_CA_CERT'],
  ])('refuses to start on %o', (source, name) => {
    expect(() => loadEnv({ ...REQUIRED, ...source })).toThrow(name);
  });
});
