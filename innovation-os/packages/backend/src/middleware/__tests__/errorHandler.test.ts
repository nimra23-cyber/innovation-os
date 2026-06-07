import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../errorHandler';
import { ValidationError, NotFoundError, ConflictError } from '../../lib/errors';

// Suppress logger output during tests
jest.mock('../../lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

function makeMocks() {
  const req = { method: 'GET', path: '/test' } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('errorHandler middleware', () => {
  it('returns HTTP 400 with message and fields for ValidationError', () => {
    const { req, res, next } = makeMocks();
    const err = new ValidationError('Validation failed', { name: 'Too short' });

    errorHandler(err, req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      error: {
        message: 'Validation failed',
        fields: { name: 'Too short' },
      },
    });
  });

  it('returns HTTP 404 with message for NotFoundError', () => {
    const { req, res, next } = makeMocks();
    const err = new NotFoundError('Project not found');

    errorHandler(err, req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      error: { message: 'Project not found' },
    });
  });

  it('returns HTTP 409 with message for ConflictError', () => {
    const { req, res, next } = makeMocks();
    const err = new ConflictError('Resource already exists');

    errorHandler(err, req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      error: { message: 'Resource already exists' },
    });
  });

  it('returns HTTP 500 with generic message for unknown errors', () => {
    const { req, res, next } = makeMocks();
    const err = new Error('Something went terribly wrong');

    errorHandler(err, req, res, next);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500);
    expect((res.json as jest.Mock).mock.calls[0][0]).toEqual({
      error: { message: 'An unexpected error occurred' },
    });
  });
});
