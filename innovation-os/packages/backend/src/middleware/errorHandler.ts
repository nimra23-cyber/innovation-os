import { Request, Response, NextFunction } from 'express';
import { ValidationError, NotFoundError, ConflictError } from '../lib/errors';
import logger from '../lib/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  logger.error({ err, method: req.method, path: req.path }, err.message);

  if (err instanceof ValidationError) {
    res.status(400).json({
      error: {
        message: err.message,
        fields: err.fields,
      },
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: {
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: {
        message: err.message,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      message: 'An unexpected error occurred',
    },
  });
}
