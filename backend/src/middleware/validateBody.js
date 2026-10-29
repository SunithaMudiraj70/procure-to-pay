import { AppError } from '../utils/errors.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', errorDetails));
  }
  req.validatedBody = result.data;
  next();
};

export default validateBody;
