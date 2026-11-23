/**
 * Minimal request logger (one line per request, with response time).
 * Keeps the dependency list short — no morgan — and stays silent while running tests.
 */
import config from '../config/env.js';

export default function requestLogger(req, res, next) {
  if (config.isTest) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(1)} ms)`;
    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400) console.warn(line);
    else console.log(line);
  });

  next();
}
