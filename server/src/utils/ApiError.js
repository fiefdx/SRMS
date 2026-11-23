/**
 * Application error carrying an HTTP status. Every route throws this instead of calling res.status()
 * by hand, so the error middleware is the single place that shapes an error response.
 */
export default class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.expose = status < 500;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication is required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'That resource already exists', details) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message = 'The request could not be processed', details) {
    return new ApiError(422, message, details);
  }
}
