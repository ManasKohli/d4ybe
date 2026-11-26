import { randomUUID } from 'node:crypto';
import { pinoHttp, type HttpLogger } from 'pino-http';
import type { Logger } from './logger.js';

const isHealthCheck = (url = ''): boolean => url.split('?')[0]?.replace(/\/$/, '') === '/health';

/**
 * One log line per request: id, method, path, status and timing. Never headers, bodies or
 * query strings (tokens can ride in any of them). 5xx lines carry the error and log at error level.
 */
export function createHttpLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    // Always our own id: client headers (including X-Cloud-Trace-Context) never choose it.
    genReqId: (_req, res) => {
      const id = randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => isHealthCheck(req.url) },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'info'),
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
