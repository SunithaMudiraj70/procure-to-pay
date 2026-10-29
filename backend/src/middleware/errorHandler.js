import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  // Log raw unexpected error internally
  logger.error(err.stack || err.message);

  // Never expose SQL or internal errors to the client
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred. Please try again later.'
  });
};

export default errorHandler;
