import { createApp } from './app.js';
import config from './config/env.js';

/*
 * Server entry point. The database connection is added here once the data layer exists; keeping the
 * HTTP layer separate from the data layer is what lets the tests run without a database.
 */
const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`SRMS API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`CORS allowed origin: ${config.corsOrigin}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, closing the server…`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
