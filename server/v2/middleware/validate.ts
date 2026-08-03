import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface RequestValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Generic Express request validation middleware using Zod schemas.
 */
export function validate(schema: RequestValidationSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as typeof req.query;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));
        next(new ValidationError('Invalid request payload', issues));
      } else {
        next(error);
      }
    }
  };
}
