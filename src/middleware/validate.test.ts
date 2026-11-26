import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from './error-handler.js';
import { validate } from './validate.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    req.log = pino({ level: 'silent' });
    next();
  });
  a.post(
    '/items/:id',
    validate({
      params: z.object({ id: z.uuid() }),
      query: z.object({ limit: z.coerce.number().int().max(50).default(10) }),
      body: z.object({ track: z.enum(['Canada', 'US']) }),
    }),
    (req, res) => {
      res.json({ params: req.params, query: req.query, body: req.body as unknown });
    },
  );
  a.use(errorHandler);
  return a;
}

const ID = '7d3f3b8e-2c1a-4f5e-9b6d-0a1b2c3d4e5f';

describe('validate', () => {
  it('passes parsed, coerced and stripped values to the handler', async () => {
    const res = await request(app()).post(`/items/${ID}?limit=5`).send({ track: 'US', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: ID }, query: { limit: 5 }, body: { track: 'US' } });
  });

  it('applies query defaults', async () => {
    const res = await request(app()).post(`/items/${ID}`).send({ track: 'Canada' });
    expect(res.body.query).toEqual({ limit: 10 });
  });

  it('returns 400 validation_failed with one detail per issue', async () => {
    const res = await request(app()).post('/items/not-a-uuid').send({ track: 'Mars' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'id' })]);
  });

  it('reports body issues with their path', async () => {
    const res = await request(app()).post(`/items/${ID}`).send({ track: 'Mars' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'track' })]);
  });
});
