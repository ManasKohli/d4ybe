import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/error-handler.js';
import { AppError } from '../src/errors/app-error.js';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { createHttpLogger } from '../src/lib/http-logger.js';
import { buildTestApp, TEST_ORIGIN, testEnv } from './helpers/test-app.js';

describe('GET /health', () => {
  it('returns 200 ok and is never cached', async () => {
    const res = await request(buildTestApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('unknown routes', () => {
  // Auth runs before the 404 (section 3), so a signed-out caller can't map the API surface.
  // The authenticated 404 is covered end to end in tests/db/me.test.ts.
  it('answer 401 to a signed-out caller, in the standard error shape', async () => {
    const res = await request(buildTestApp()).get('/nope');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Authentication required' } });
  });
});

describe('JSON body parsing', () => {
  it('rejects malformed JSON with 400 invalid_json', async () => {
    const res = await request(buildTestApp()).post('/nope').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('rejects bodies over 100kb with 413', async () => {
    const res = await request(buildTestApp())
      .post('/nope')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ big: 'x'.repeat(101 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });
});

describe('client errors raised by Express itself', () => {
  it('answers an unsupported JSON charset with 415 unsupported_media_type', async () => {
    const res = await request(buildTestApp())
      .post('/nope')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{}');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('unsupported_media_type');
  });

  it('answers a malformed percent-encoded path param with 400, not 500', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.log = pino({ level: 'silent' });
      next();
    });
    app.get('/p/:id', (_req, res) => {
      res.json({});
    });
    app.use(errorHandler);
    const res = await request(app).get('/p/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides Express', async () => {
    const res = await request(buildTestApp()).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('allows an origin on the allowlist', async () => {
    const res = await request(buildTestApp()).get('/health').set('Origin', TEST_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
  });

  it('sends no CORS headers to an origin off the allowlist', async () => {
    const res = await request(buildTestApp()).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lets browser code read X-Request-Id', async () => {
    const res = await request(buildTestApp()).get('/health').set('Origin', TEST_ORIGIN);
    expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('answers preflight for allowed origins with the Authorization header permitted', async () => {
    const res = await request(buildTestApp())
      .options('/me')
      .set('Origin', TEST_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });
});

describe('request ids', () => {
  it('generates an X-Request-Id', async () => {
    const res = await request(buildTestApp()).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never takes the id from a client-supplied header (D1: callers cannot pick or collide log ids)', async () => {
    const trace = '105445aa7843bc8bf206b12000100000';
    const res = await request(buildTestApp()).get('/health').set('X-Cloud-Trace-Context', `${trace}/1;o=1`);
    expect(res.headers['x-request-id']).not.toBe(trace);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('error handler', () => {
  function appThatThrows(err: unknown) {
    const app = express();
    app.use((req, _res, next) => {
      req.log = pino({ level: 'silent' });
      next();
    });
    app.get('/boom', () => {
      throw err;
    });
    app.use(errorHandler);
    return app;
  }

  it('maps AppError to its status, code and details', async () => {
    const res = await request(appThatThrows(new AppError(409, 'no_rounds_left', 'No review rounds left', { n: 0 }))).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'no_rounds_left', message: 'No review rounds left', details: { n: 0 } } });
  });

  it.each([
    ['23505', 409, 'conflict'],
    ['23503', 400, 'invalid_reference'],
    ['23514', 400, 'constraint_violation'],
    ['22P02', 400, 'bad_request'],
  ])('maps Postgres %s to %i %s', async (pgCode, status, code) => {
    const err = Object.assign(new Error('db said no'), { name: 'PostgresError', code: pgCode });
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('maps a ZodError thrown by a service to 400 validation_failed', async () => {
    const err = z.object({ a: z.string() }).safeParse({}).error;
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'a' })]);
  });

  it('hides unmapped Postgres errors behind a generic 500', async () => {
    const err = Object.assign(new Error('serialization failure detail'), { name: 'PostgresError', code: '40001' });
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('serialization');
  });

  it('treats an upstream SDK error with type + 4xx status as our 500, not the client fault', async () => {
    const err = Object.assign(new Error('Invalid API key'), { type: 'StripeAuthenticationError', status: 401 });
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const res = await request(appThatThrows(new Error('secret internals'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal_error', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('handles async handlers that reject (Express 5)', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.log = pino({ level: 'silent' });
      next();
    });
    app.get('/boom', async () => {
      await Promise.resolve();
      throw AppError.forbidden();
    });
    app.use(errorHandler);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(403);
  });
});

describe('request logging', () => {
  it('logs method, path and status but never headers, tokens or query strings', async () => {
    const lines: string[] = [];
    const logger = pino({ messageKey: 'message' }, { write: (line: string) => void lines.push(line) });
    const app = createApp({ env: testEnv(), logger, sql: createDb({ url: testEnv().DATABASE_URL, max: 1 }) });

    await request(app).get('/nope?token=abc123').set('Authorization', 'Bearer secret-jwt').set('Cookie', 'sid=s3cret');

    const log = lines.join('\n');
    expect(log).toContain('"path":"/nope"');
    expect(log).toContain('"statusCode":401');
    expect(log).not.toContain('secret-jwt');
    expect(log).not.toContain('s3cret');
    expect(log).not.toContain('abc123');
    expect(lines).toHaveLength(1); // one line per request, not one from pino-http and one from the error handler
  });

  it('logs a 500 once, with the error stack, at error level', async () => {
    const lines: string[] = [];
    const logger = pino({ messageKey: 'message' }, { write: (line: string) => void lines.push(line) });
    const app = express();
    app.use(createHttpLogger(logger));
    app.get('/boom', () => {
      throw new Error('kaboom');
    });
    app.use(errorHandler);

    await request(app).get('/boom');

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry.level).toBe(50);
    expect(entry.err.stack).toContain('kaboom');
  });

  it('does not log health checks, with or without a query string', async () => {
    const lines: string[] = [];
    const logger = pino({ messageKey: 'message' }, { write: (line: string) => void lines.push(line) });
    const app = createApp({ env: testEnv(), logger, sql: createDb({ url: testEnv().DATABASE_URL, max: 1 }) });
    await request(app).get('/health');
    await request(app).get('/health?probe=1');
    expect(lines).toHaveLength(0);
  });
});
