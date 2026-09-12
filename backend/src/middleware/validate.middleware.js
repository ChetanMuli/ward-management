const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Run after an array of express-validator checks in a route definition. */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(422, 'Validation failed', errors.array());
  }
  next();
}

module.exports = validate;
