import { randomUUID } from 'node:crypto';
import express from 'express';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { pino } from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../types/auth.js';
import { authenticate, type LoadUser } from './auth.js';
import { errorHandler } from './error-handler.js';
import { requireRole } from './require-role.js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const USER_ID = randomUUID();
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let privateKey: PrivateKey;
let otherKey: PrivateKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair('ES256')).privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'ES256' }] });
});

interface TokenOptions {
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number | string;
  key?: PrivateKey;
  claims?: Record<string, unknown>;
}

function token({ sub = USER_ID, iss = ISSUER, aud = 'authenticated', exp = '1h', key, claims = {} }: TokenOptions = {}) {
  return new SignJWT({ role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key ?? privateKey);
}

function app(loadUser: LoadUser = () => Promise.resolve({ id: USER_ID, role: 'student' }), keySet: JWTVerifyGetKey = keys) {
  const a = express();
  a.use((req, _res, next) => {
    req.log = pino({ level: 'silent' });
    next();
  });
  a.use(authenticate({ supabaseUrl: SUPABASE_URL, loadUser, keys: keySet }));
  a.get('/whoami', (req, res) => {
    res.json(req.user);
  });
  a.get('/admin-only', requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  a.use(errorHandler);
  return a;
}

describe('authenticate', () => {
  it('accepts a valid token and takes the role from loadUser, not the token', async () => {
    const loadUser = vi.fn<LoadUser>().mockResolvedValue({ id: USER_ID, role: 'mentor' } satisfies AuthUser);
    const res = await request(app(loadUser))
      .get('/whoami')
      .set('Authorization', `Bearer ${await token({ claims: { user_role: 'admin', app_metadata: { role: 'admin' } } })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: USER_ID, role: 'mentor' });
    expect(loadUser).toHaveBeenCalledWith(USER_ID);
  });

  it.each([
    ['no header', undefined],
    ['a non-bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty bearer', 'Bearer '],
    ['garbage', 'Bearer not-a-jwt'],
  ])('rejects %s with 401', async (_name, header) => {
    const req = request(app()).get('/whoami');
    if (header) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it.each<[string, () => Promise<string>]>([
    ['signed by another key (forged)', () => token({ key: otherKey })],
    ['expired', () => token({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ['from another issuer', () => token({ iss: 'https://evil.supabase.co/auth/v1' })],
    ['for another audience', () => token({ aud: 'anon' })],
    ['with a non-uuid subject', () => token({ sub: 'admin' })],
    ['from an anonymous sign-in', () => token({ claims: { is_anonymous: true } })],
  ])('rejects a token %s with 401', async (_name, make) => {
    const res = await request(app()).get('/whoami').set('Authorization', `Bearer ${await make()}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'unauthorized', message: 'Invalid or expired token' });
  });

  it('rejects an HS256 token signed with the legacy shared secret', async () => {
    const hs = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('super-secret-jwt-token-with-at-least-32-characters-long'));
    const res = await request(app()).get('/whoami').set('Authorization', `Bearer ${hs}`);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose account no longer exists', async () => {
    const res = await request(app(() => Promise.resolve(null)))
      .get('/whoami')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(401);
  });

  it('answers 503, not 401, when the key set cannot be fetched', async () => {
    const down: JWTVerifyGetKey = () => Promise.reject(new TypeError('fetch failed'));
    const res = await request(app(undefined, down)).get('/whoami').set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('auth_unavailable');
  });

  it('passes a database failure to the error handler as a 500', async () => {
    const res = await request(app(() => Promise.reject(new Error('pool exhausted'))))
      .get('/whoami')
      .set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(500);
  });

  it('works with requireRole: a student is refused an admin route', async () => {
    const res = await request(app()).get('/admin-only').set('Authorization', `Bearer ${await token()}`);
    expect(res.status).toBe(403);
  });
});
