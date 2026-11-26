import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import type { AuthUser } from '../types/auth.js';
import { requireRole } from './require-role.js';

function run(user: AuthUser | undefined, ...roles: Parameters<typeof requireRole>) {
  const next = vi.fn();
  requireRole(...roles)({ user } as Request, {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0] as unknown;
}

describe('requireRole', () => {
  it('rejects a request with no user as 401', () => {
    const err = run(undefined, 'admin');
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(401);
  });

  it('rejects the wrong role as 403', () => {
    const err = run({ id: 'u1', role: 'student' }, 'admin', 'mentor');
    expect((err as AppError).status).toBe(403);
  });

  it('lets an allowed role through', () => {
    expect(run({ id: 'u1', role: 'mentor' }, 'admin', 'mentor')).toBeUndefined();
  });
});
