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
import ApiError from '../utils/ApiError.js';
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

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    details = err.details;
  } else if (err?.name === 'ZodError') {
    status = 422;
    message = 'Validation failed';
    details = zodDetails(err);
  } else if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    status = 400;
    message = 'Request body is not valid JSON.';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    message = 'That value is already taken.';
    details = err.keyValue ? [err.keyValue] : undefined;
  } else if (err?.status === 404 || err?.status === 405) {
    status = err.status;
    message = err.message;
  }

  const logLine = `${req.method} ${req.originalUrl} -> ${status}: ${err?.message ?? err}`;
  if (status >= 500) console.error(logLine, err?.stack ?? err);
  else if (!config.isTest) console.warn(logLine);

  const body = { error: { message, ...(details ? { details } : {}) } };
  if (!config.isProduction && status >= 500) body.error.stack = err?.stack;

  return res.status(status).json(body);
}
