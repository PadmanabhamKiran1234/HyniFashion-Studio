export function errorHandler(err, req, res, next) {
  console.error(err);

  // Duplicate email or unique ID
  if (err.code === 11000) {
    const field = Object.keys(
      err.keyPattern || {}
    )[0] || 'value';

    return res.status(409).json({
      success: false,
      message: `${field} already exists.`
    });
  }

  // MongoDB validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: Object.values(err.errors).map(
        error => error.message
      )
    });
  }

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? 'Internal server error.'
        : err.message,

    ...(process.env.NODE_ENV === 'development' &&
        statusCode >= 500
      ? { detail: err.message }
      : {})
  });
}