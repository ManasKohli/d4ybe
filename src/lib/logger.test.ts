import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';

function lastLine(write: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return JSON.parse(String(write.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
}

describe('createLogger (production)', () => {
  it('writes Cloud Logging `severity` and `message`, not pino `level` and `msg`', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'info' }).warn('hello');
    const line = lastLine(write);
    expect(line).toMatchObject({ severity: 'WARNING', message: 'hello' });
    expect(line.level).toBeUndefined();
  });

  it.each([
    ['fatal', 'CRITICAL'],
    ['error', 'ERROR'],
    ['info', 'INFO'],
    ['debug', 'DEBUG'],
    ['trace', 'DEBUG'],
  ] as const)('maps pino %s to Cloud Logging %s', (level, severity) => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'trace' })[level]('x');
    expect(lastLine(write).severity).toBe(severity);
  });

  it('redacts the Authorization header', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'info' }).info({ req: { headers: { authorization: 'Bearer t0ken' } } }, 'r');
    expect(JSON.stringify(lastLine(write))).not.toContain('t0ken');
  });
});
