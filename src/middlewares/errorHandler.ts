import { NextFunction, Request, Response } from 'express';
import { AppError, toErrorResponse } from '../utils/errors.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const body = toErrorResponse(err);

  if (statusCode === 500) {
    // eslint-disable-next-line no-console
    console.error('Internal error:', err);
  }

  res.status(statusCode).json(body);
};
