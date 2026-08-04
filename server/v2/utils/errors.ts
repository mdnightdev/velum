import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, true, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, true);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, false);
  }
}

export const globalErrorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
    return;
  }

  const isDbConnError =
    err?.message?.includes('getaddrinfo') ||
    err?.message?.includes('EAI_AGAIN') ||
    err?.message?.includes('ENOTFOUND') ||
    err?.message?.includes('ECONNREFUSED') ||
    (err as any)?.cause?.code === 'EAI_AGAIN' ||
    (err as any)?.cause?.code === 'ENOTFOUND' ||
    (err as any)?.cause?.code === 'ECONNREFUSED' ||
    (err as any)?.code === 'EAI_AGAIN' ||
    (err as any)?.code === 'ENOTFOUND' ||
    (err as any)?.code === 'ECONNREFUSED';

  if (isDbConnError) {
    console.error('[DATABASE CONNECTIVITY ERROR]', err.message || err);
    res.status(503).json({
      error: 'Database connection is temporarily unavailable. Please try again shortly.',
      code: 'DB_CONNECTIVITY_ERROR'
    });
    return;
  }

  console.error('[SERVER UNHANDLED ERROR]', err);
  res.status(500).json({
    error: 'An internal server error occurred.'
  });
};
