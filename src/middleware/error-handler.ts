import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Postgres SQLSTATE codes that are the caller's fault, not ours. */
const POSTGRES_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  '23505': { status: 409, code: 'conflict', message: 'This record already exists' },
  '23503': { status: 400, code: 'invalid_reference', message: 'A referenced record does not exist' },
  '23514': { status: 400, code: 'constraint_violation', message: 'The request breaks a data rule' },
  '22P02': { status: 400, code: 'bad_request', message: 'A value has the wrong format' },
};

function isPostgresError(err: unknown): err is { name: string; code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'PostgresError' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

/**
 * Client errors raised by Express itself and body-parser (bad JSON, body too large, bad charset,
 * malformed URL encoding). They're http-errors with `expose: true`. Upstream SDK errors (Stripe,
 * Supabase) also carry `status`, but never `expose`, so they stay our 500.
 */
function isExposedClientError(err: unknown): err is { status: number; type?: unknown } {
  if (typeof err !== 'object' || err === null) return false;
  const { expose, status } = err as { expose?: unknown; status?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500;
}

const CLIENT_ERRORS: Record<string, { code: string; message: string }> = {
  'entity.parse.failed': { code: 'invalid_json', message: 'Request body is not valid JSON' },
  'entity.too.large': { code: 'payload_too_large', message: 'Request body is too large' },
  'charset.unsupported': { code: 'unsupported_media_type', message: 'Unsupported request charset' },
  'encoding.unsupported': { code: 'unsupported_media_type', message: 'Unsupported request encoding' },
};

function toResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    const error: ErrorBody['error'] = { code: err.code, message: err.message };
    if (err.details !== undefined) error.details = err.details;
    return { status: err.status, body: { error } };
  }

  if (err instanceof ZodError) {
    return toResponse(AppError.validation(formatZodIssues(err)));
  }

  if (isPostgresError(err)) {
    const mapped = POSTGRES_ERRORS[err.code];
    if (mapped) {
      return { status: mapped.status, body: { error: { code: mapped.code, message: mapped.message } } };
    }
  }

  // Express's router throws a URIError with status 400 for a malformed %-encoded path param.
  if (err instanceof URIError && (err as { status?: unknown }).status === 400) {
    return { status: 400, body: { error: { code: 'bad_request', message: 'Malformed URL encoding' } } };
  }

  if (isExposedClientError(err)) {
    const known = typeof err.type === 'string' ? CLIENT_ERRORS[err.type] : undefined;
    return { status: err.status, body: { error: known ?? { code: 'bad_request', message: 'Bad request' } } };
  }

  return { status: 500, body: { error: { code: 'internal_error', message: 'Something went wrong' } } };
}

export function formatZodIssues(err: ZodError): { path: string; message: string }[] {
  return err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/**
 * The single place errors become HTTP responses: `{ error: { code, message, details? } }`.
 * Unexpected errors are logged with their stack and answered with a generic 500.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, body } = toResponse(err);
  // pino-http writes one line per request; handing it the error puts the stack on that line
  // (at error level for 5xx) instead of logging the same failure twice.
  if (status >= 500) res.err = err as Error;
  res.status(status).json(body);
};
