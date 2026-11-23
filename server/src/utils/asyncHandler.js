/**
 * Wraps an async route handler so any rejection is forwarded to Express.
 * Express 5 forwards rejected promises on its own; keeping the wrapper explicit means every route
 * behaves identically and a handler can be refactored without changing error behaviour.
 */
export default function asyncHandler(handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
