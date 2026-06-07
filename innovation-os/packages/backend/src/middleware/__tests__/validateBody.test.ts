import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../validateBody';
import { ValidationError } from '../../lib/errors';

const testSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  age: z.number().int().optional(),
});

function makeMocks(body: unknown) {
  const req = { body } as unknown as Request;
  const res = {} as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('validateBody middleware', () => {
  it('calls next() and sets req.body to parsed data when schema validates successfully', () => {
    const { req, res, next } = makeMocks({ name: 'Alice', age: 30 });

    validateBody(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('strips unknown keys and still calls next() for valid data', () => {
    const { req, res, next } = makeMocks({ name: 'Bob', extra: 'ignored' });

    validateBody(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'Bob' }); // Zod strips unknown by default
  });

  it('throws ValidationError with field-level errors when schema fails', () => {
    const { req, res, next } = makeMocks({ name: 'AB' }); // name too short

    expect(() => validateBody(testSchema)(req, res, next)).toThrow(ValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it('ValidationError includes the correct field key and message', () => {
    const { req, res, next } = makeMocks({ name: 'AB' });

    try {
      validateBody(testSchema)(req, res, next);
      fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationErr = err as ValidationError;
      expect(validationErr.fields).toBeDefined();
      expect(validationErr.fields!['name']).toBe('Name must be at least 3 characters');
    }
  });

  it('throws ValidationError when required field is missing', () => {
    const { req, res, next } = makeMocks({}); // name is required

    expect(() => validateBody(testSchema)(req, res, next)).toThrow(ValidationError);
  });
});
