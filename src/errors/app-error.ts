/**
 * The one error type services and middleware throw.
 * The error handler turns it into `{ error: { code, message, details? } }`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message = 'Bad request', details?: unknown): AppError {
    return new AppError(400, 'bad_request', message, details);
  }

  static validation(details: unknown): AppError {
    return new AppError(400, 'validation_failed', 'Request validation failed', details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'unauthorized', message);
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(404, 'not_found', message);
  }

  static conflict(message = 'Conflict'): AppError {
    return new AppError(409, 'conflict', message);
  }
}
