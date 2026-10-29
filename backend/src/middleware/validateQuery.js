export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid query parameters',
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  }
  req.validatedQuery = result.data;
  next();
};

export default validateQuery;
