export function validateRegistration(req, res, next) {
  const {
    name,
    email,
    password,
    mobile
  } = req.body;

  const errors = [];

  if (
    typeof name !== 'string' ||
    name.trim().length < 2
  ) {
    errors.push('Name must contain at least 2 characters.');
  }

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    errors.push('A valid email is required.');
  }

  if (
    typeof password !== 'string' ||
    password.length < 8
  ) {
    errors.push('Password must contain at least 8 characters.');
  }

  if (
    mobile !== undefined &&
    typeof mobile !== 'string'
  ) {
    errors.push('Mobile must be a string.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please correct the registration details.',
      errors
    });
  }

  next();
}

export function validateLogin(req, res, next) {
  const {
    email,
    password
  } = req.body;

  if (
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }

  next();
}