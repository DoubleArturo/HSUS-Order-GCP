export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ErrorResponseBody {
  success: false;
  message: string | null;
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export const toErrorResponse = (err: AppError | Error): ErrorResponseBody => {
  if (err instanceof AppError) {
    return {
      success: false,
      message: err.message,
      data: null,
      error: {
        code: err.code,
        message: err.message,
      },
    };
  }

  return {
    success: false,
    message: 'Internal server error',
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  };
};
