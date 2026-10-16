const ApiError = require('../utils/ApiError');
const config = require('../config');

/** Any /api route that did not match. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}.`));
}

/**
 * Central error handler. Every error leaves the API in one shape:
 * { error: { status, message, details } }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Something went wrong on our side. Try again in a moment.';
  let details = [];

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'The request body is too large.';
  } else {
    console.error(err);
  }

  const body = { error: { status, message, details } };
  if (status === 500 && config.env !== 'production') body.error.debug = err.message;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
