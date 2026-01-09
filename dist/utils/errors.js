export class AppError extends Error {
    constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}
export const toErrorResponse = (err) => {
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
