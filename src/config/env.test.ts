import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://postgres.ref:pw@aws-0-ca-central-1.pooler.supabase.com:6543/postgres',
  SUPABASE_URL: 'https://ref.supabase.co',
  DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(REQUIRED);
    // D2: a missing NODE_ENV must never pull in dev-only packages (pino-pretty), so it defaults to production.
    expect(env).toEqual({ NODE_ENV: 'production', PORT: 8080, LOG_LEVEL: 'info', ALLOWED_ORIGINS: [], ...REQUIRED });
  });

  it('lets production run against the local stack without a CA (Docker smoke test)', () => {
    const env = loadEnv({ ...REQUIRED, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', DATABASE_CA_CERT: undefined });
    expect(env.DATABASE_CA_CERT).toBeUndefined();
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
    // Production must authenticate the pooler, not just encrypt (section 8).
    [{ NODE_ENV: 'production', DATABASE_CA_CERT: undefined }, 'DATABASE_CA_CERT'],
    // A missing NODE_ENV means production too.
    [{ DATABASE_CA_CERT: undefined }, 'DATABASE_CA_CERT'],
  ])('refuses to start on %o', (source, name) => {
    expect(() => loadEnv({ ...REQUIRED, ...source })).toThrow(name);
  });
});
