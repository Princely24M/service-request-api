const ApiError = require('../utils/ApiError');

const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

/** Rejects POST/PUT/PATCH calls that are not sending JSON with 415. */
function requireJson(req, res, next) {
  if (METHODS_WITH_BODY.includes(req.method) && !req.is('application/json')) {
    return next(new ApiError(415, 'Send the body as JSON and set the header Content-Type: application/json.'));
  }
  return next();
}

module.exports = requireJson;
