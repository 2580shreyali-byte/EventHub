import { errorResponse } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, next) {
  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, 'Malformed JSON payload in request body', 400, 'BAD_REQUEST');
  }

  // Handle MySQL connection errors
  if (err.code === 'ECONNREFUSED') {
    return errorResponse(res, 'Database connection refused. Check database configuration.', 503, 'SERVICE_UNAVAILABLE');
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error occurred';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // Only log unexpected internal server errors (500)
  if (statusCode >= 500) {
    console.error(`[Server Error ${statusCode}]:`, err);
  }

  return errorResponse(res, message, statusCode, code);
}
