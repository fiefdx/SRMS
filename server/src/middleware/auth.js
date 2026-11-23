/**
 * Authentication and authorization middleware.
 *
 *   authenticate      reads `Authorization: Bearer <jwt>`, verifies it, loads the account and sets req.user
 *   requireAdmin      403 unless req.user.role === 'admin'
 *   requireSelfOrAdmin 403 unless the URL id is the signed-in user (or they are an admin)
 *
 * Authorization is checked in the route, not in the frontend: the client hides admin buttons, but the
 * API is the thing that has to refuse the request.
 */
import ApiError from '../utils/ApiError.js';
import { findUserById, toPublicUser, verifyToken } from '../services/authService.js';

function readBearerToken(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function authenticate(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) throw ApiError.unauthorized('Sign in to use this endpoint');

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      throw ApiError.unauthorized(
        error.name === 'TokenExpiredError' ? 'Your session has expired, please sign in again' : 'Sign in again to continue',
      );
    }

    const row = await findUserById(Number(payload.sub));
    if (!row) throw ApiError.unauthorized('The account for this session no longer exists');

    req.user = toPublicUser(row);
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Like `authenticate`, but a request without a token is allowed through as a guest. A *bad* token is
 * still rejected, because a caller who sends one should not silently be treated as a guest.
 */
export async function optionalAuthenticate(req, res, next) {
  if (!readBearerToken(req)) return next();
  return authenticate(req, res, next);
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'admin') return next(ApiError.forbidden('Administrator access is required for this action'));
  return next();
}

/**
 * Customers may only touch their own records. `param` names the route parameter that holds the user id
 * (defaults to `userId`).
 */
export function requireSelfOrAdmin(param = 'userId') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const requestedId = Number(req.params[param]);
    if (req.user.role === 'admin' || requestedId === req.user.id) return next();
    return next(ApiError.forbidden('You can only manage your own records'));
  };
}
