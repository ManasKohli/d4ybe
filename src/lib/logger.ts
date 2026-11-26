import { pino, type Logger } from 'pino';
import type { Env } from '../config/env.js';

export type { Logger };

/** pino level → Cloud Logging severity (pino's `fatal`/`trace`/`warn` are not valid severities). */
const SEVERITY: Record<string, string> = {
  fatal: 'CRITICAL',
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  debug: 'DEBUG',
  trace: 'DEBUG',
};

/**
 * JSON logs to stdout. In production Cloud Logging reads `severity` and `message`.
 * Never log request bodies, tokens or keys: the redact list is a backstop, not permission.
 */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  const pretty = env.NODE_ENV === 'development';
  return pino({
    level: env.LOG_LEVEL,
    messageKey: 'message',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["stripe-signature"]'],
      censor: '[redacted]',
    },
    ...(pretty
      ? { transport: { target: 'pino-pretty', options: { messageKey: 'message' } } }
      : {
          formatters: {
            level: (label) => ({ severity: SEVERITY[label] ?? 'DEFAULT' }),
          },
        }),
  });
}
