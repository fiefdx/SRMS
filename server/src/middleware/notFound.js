import ApiError from '../utils/ApiError.js';

/**
 * Runs after every route. Anything unmatched becomes a 404 in the same JSON shape as the rest of the
 * API, so the frontend can always read `error.message`.
 */
export default function notFound(req, res, next) {
  next(ApiError.notFound(`No API route for ${req.method} ${req.originalUrl}`));
}
