import { describe, expect, it } from 'vitest';
import { sslFor } from './client.js';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
const POOLER = 'postgresql://postgres.ref:pw@aws-0-ca-central-1.pooler.supabase.com:6543/postgres';

// This decides whether production traffic to the pooler is encrypted and authenticated.
describe('sslFor', () => {
  it.each([
    ['127.0.0.1', 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'],
    ['localhost', 'postgresql://postgres:postgres@localhost:54322/postgres'],
    ['IPv6 loopback', 'postgresql://postgres:postgres@[::1]:5432/postgres'],
  ])('skips TLS for the local stack (%s)', (_name, url) => {
    expect(sslFor(url)).toBe(false);
  });

  it('encrypts a remote host even without a CA', () => {
    expect(sslFor(POOLER)).toBe('require');
  });

  it('verifies the certificate when a CA is configured', () => {
    expect(sslFor(POOLER, PEM)).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it('treats a lookalike host as remote', () => {
    expect(sslFor('postgresql://u:p@localhost.attacker.example:5432/db')).toBe('require');
  });
});
