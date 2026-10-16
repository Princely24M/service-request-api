/**
 * An error that is safe to show to API clients.
 * Anything that is not an ApiError is treated as an unexpected 500.
 */
class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, message);
  }
}

module.exports = ApiError;
