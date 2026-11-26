import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import type { Role } from '../types/auth.js';

/**
 * Allow only the listed roles. Mount after the auth middleware, which sets `req.user`.
 *
 *   router.use(requireRole('admin'))
 */
export function requireRole(...allowed: [Role, ...Role[]]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
