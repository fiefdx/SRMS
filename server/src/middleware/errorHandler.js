/**
 * Single place that turns any thrown value into a JSON error response.
 *
 * Handled on purpose:
 *  - ApiError           -> the status and message the route asked for (plus field details)
 *  - ZodError           -> 422 with a per-field list
 *  - bad JSON / oversized body -> 400 / 413
 *  - duplicate key      -> 409 (Mongo 11000, MySQL ER_DUP_ENTRY) so a unique index never becomes a 500
 *  - anything else      -> 500, logged with a stack trace, message never leaks internals
 */
import ApiError, { STATUS_CODES } from '../utils/ApiError.js';
import config from '../config/env.js';

function zodDetails(error) {
  return error.issues.map((issue) => ({ field: issue.path.join('.') || 'body', message: issue.message }));
}

function isDuplicateKeyError(error) {
  return (
    error?.code === 11000 ||
    error?.code === 'ER_DUP_ENTRY' ||
    /duplicate entry|unique constraint/i.test(error?.message ?? '')
  );
}

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Something went wrong on the server.';
  let details;
  let code = STATUS_CODES[500];

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
    code = err.code;
  } else if (err?.name === 'ZodError') {
    status = 422;
    message = 'Validation failed';
    details = zodDetails(err);
    code = 'VALIDATION_FAILED';
  } else if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    status = 400;
    message = 'Request body is not valid JSON.';
    code = 'INVALID_JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
    code = STATUS_CODES[413];
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    message = 'That value is already taken.';
    details = err.keyValue ? [err.keyValue] : undefined;
    code = 'DUPLICATE_VALUE';
  } else if (err?.status === 404 || err?.status === 405) {
    status = err.status;
    message = err.message;
    code = STATUS_CODES[status];
  } else if (err?.code === 'ECONNREFUSED' || err?.code === 'ER_ACCESS_DENIED_ERROR' || err?.code === 'ER_BAD_DB_ERROR') {
    // the database is unreachable or refuses the credentials: an operational failure, not the client's fault
    status = 503;
    message = 'The database is not available right now.';
    code = STATUS_CODES[503];
  }

  const logLine = `${req.method} ${req.originalUrl} -> ${status}: ${err?.message ?? err}`;
  if (status >= 500) console.error(logLine, err?.stack ?? err);
  else if (!config.isTest) console.warn(logLine);

  const body = { error: { code, message, ...(details ? { details } : {}) } };
  if (!config.isProduction && status >= 500) body.error.stack = err?.stack;

  return res.status(status).json(body);
}
