import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import apiRouter from './routes/index.js';
import requestLogger from './middleware/requestLogger.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

/**
 * The app is created by a factory instead of being a module-level singleton so the tests can build a
 * fresh app (and the server entry point can attach it to a real port).
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('etag', false);

  const allowedOrigins = String(config.corsOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      // Only the configured frontend origin(s) may read responses; requests with no Origin header
      // (curl, health checks, same-origin static hosting) are allowed through.
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    }),
  );

  // Small body limit: an order or a menu item is a few kilobytes, so this rejects abusive payloads.
  app.use(express.json({ limit: '128kb' }));
  app.use(requestLogger);

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
