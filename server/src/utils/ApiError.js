/**
 * Application error carrying an HTTP status. Every route throws this instead of calling res.status()
 * by hand, so the error middleware is the single place that shapes an error response.
 *
 * Each error also carries a stable, machine-readable `code` (see STATUS_CODES): the message is written for
 * a person to read and may be reworded, the code is what a client switches on.
 */
export const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export default class ApiError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? STATUS_CODES[status] ?? 'INTERNAL_ERROR';
    this.details = details;
    this.expose = status < 500;
  }

  static badRequest(message = 'Bad request', details, code) {
    return new ApiError(400, message, details, code);
  }

  static unauthorized(message = 'Authentication is required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found', details, code) {
    return new ApiError(404, message, details, code);
  }

  static conflict(message = 'That resource already exists', details, code) {
    return new ApiError(409, message, details, code);
  }

  static unprocessable(message = 'The request could not be processed', details, code) {
    return new ApiError(422, message, details, code);
  }
}
