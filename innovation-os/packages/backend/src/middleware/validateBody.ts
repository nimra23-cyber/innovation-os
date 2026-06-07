import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields = collectFieldErrors(result.error);
      throw new ValidationError('Validation failed', fields);
    }

    req.body = result.data;
    next();
  };
}

function collectFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    fields[key] = issue.message;
  }

  return fields;
}
