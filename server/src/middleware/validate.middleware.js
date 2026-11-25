import { errorResponse } from '../utils/apiResponse.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, 'Validation error in request body', 400, 'VALIDATION_ERROR', details);
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, 'Validation error in query parameters', 400, 'VALIDATION_ERROR', details);
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, 'Validation error in route parameters', 400, 'VALIDATION_ERROR', details);
    }
    req.params = result.data;
    next();
  };
}
