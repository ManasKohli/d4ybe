import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv({});
    // D2: a missing NODE_ENV must never pull in dev-only packages (pino-pretty), so it defaults to production.
    expect(env).toEqual({ NODE_ENV: 'production', PORT: 8080, LOG_LEVEL: 'info', ALLOWED_ORIGINS: [] });
  });

  it('coerces PORT and splits ALLOWED_ORIGINS', () => {
    const env = loadEnv({ PORT: '3000', ALLOWED_ORIGINS: 'http://localhost:5173, https://d4y.example ,' });
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
  ])('refuses to start on %o', (source, name) => {
    expect(() => loadEnv(source)).toThrow(name);
  });
});
