export function successResponse(res, data = {}, message = 'Operation successful', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

export function errorResponse(res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = []) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details
    }
  });
}
