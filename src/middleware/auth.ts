import type { RequestHandler } from 'express';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../errors/app-error.js';
import type { AuthUser } from '../types/auth.js';

/** Looks a user up by their Supabase auth id. Role always comes from `profiles` (section 8). */
export type LoadUser = (id: string) => Promise<AuthUser | null>;

export interface AuthOptions {
  supabaseUrl: string;
  loadUser: LoadUser;
  /** Overridable in tests; defaults to the project's JWKS, fetched once and cached by jose. */
  keys?: JWTVerifyGetKey;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Errors that mean we couldn't get Supabase's keys, as opposed to a bad token: a network
 * failure, a timeout, a non-200 or non-JSON answer (jose throws a bare JOSEError for those),
 * or a body that isn't a key set. Everything else jose throws is about the token itself.
 */
function isKeySetUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (!(err instanceof joseErrors.JOSEError)) return true;
  return (
    err instanceof joseErrors.JWKSTimeout ||
    err instanceof joseErrors.JWKSInvalid ||
    err.constructor === joseErrors.JOSEError
  );
}

export function supabaseJwks(supabaseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl), {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60_000,
    timeoutDuration: 5_000,
  });
}

/**
 * Verify the Supabase access token (asymmetric signing keys, checked locally against the
 * project's JWKS: signature, issuer, audience, expiry), then load the caller's role from the
 * database. Anything wrong with the token is a 401 with the same message, so a caller learns
 * nothing about why. A JWKS outage is a 503, not a 401, so clients don't sign users out.
 */
export function authenticate({ supabaseUrl, loadUser, keys = supabaseJwks(supabaseUrl) }: AuthOptions): RequestHandler {
  const issuer = new URL('/auth/v1', supabaseUrl).href;

  return async (req, _res, next) => {
    const header = req.get('authorization');
    const match = header ? /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(header) : null;
    if (!match?.[1]) {
      next(AppError.unauthorized());
      return;
    }

    let subject: string;
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        issuer,
        audience: 'authenticated',
        // Asymmetric only: a symmetric (HS256) token would mean the legacy shared secret is in play.
        algorithms: ['ES256', 'RS256', 'EdDSA'],
        requiredClaims: ['sub', 'exp'],
        clockTolerance: 5,
      });
      // Anonymous sign-ins are off; reject them anyway if a project ever turns them on.
      if (payload.is_anonymous === true || typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
        throw new joseErrors.JWTClaimValidationFailed('bad subject', payload, 'sub', 'check_failed');
      }
      subject = payload.sub;
    } catch (err) {
      if (isKeySetUnavailable(err)) {
        // Supabase Auth is unreachable or misbehaving: our problem, not the caller's.
        next(new AppError(503, 'auth_unavailable', 'Sign-in is temporarily unavailable'));
        return;
      }
      next(AppError.unauthorized('Invalid or expired token'));
      return;
    }

    try {
      const user = await loadUser(subject);
      if (!user) {
        // A valid token for a deleted or banned account.
        next(AppError.unauthorized('Invalid or expired token'));
        return;
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
