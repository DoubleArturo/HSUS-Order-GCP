import { AppError, toErrorResponse } from '../utils/errors.js';
export const errorHandler = (err, _req, res, _next) => {
    const isAppError = err instanceof AppError;
    const statusCode = isAppError ? err.statusCode : 500;
    const body = toErrorResponse(err);
    if (statusCode === 500) {
        // eslint-disable-next-line no-console
        console.error('Internal error:', err);
    }
    res.status(statusCode).json(body);
};
