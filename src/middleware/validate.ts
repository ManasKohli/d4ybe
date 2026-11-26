import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';
import { formatZodIssues } from './error-handler.js';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parse the request with zod before the handler runs. On failure → 400 `validation_failed`
 * with one entry per issue. On success the parsed (coerced, stripped) values replace the raw ones.
 *
 *   router.post('/onboarding', validate({ body: onboardingSchema }), handler)
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        next(AppError.validation(formatZodIssues(result.error)));
        return;
      }
      // Express 5 makes req.query a getter, so redefine it rather than assign.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}
