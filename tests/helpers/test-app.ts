import { pino } from 'pino';
import { createApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';

export const TEST_ORIGIN = 'http://localhost:5173';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ALLOWED_ORIGINS: TEST_ORIGIN, ...overrides });
}

export function buildTestApp(overrides: Record<string, string> = {}) {
  return createApp({ env: testEnv(overrides), logger: pino({ level: 'silent' }) });
}
