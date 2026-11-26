import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';

// Cloud Run sends SIGKILL ~10 s after SIGTERM; give up a little earlier so the log line lands.
const SHUTDOWN_TIMEOUT_MS = 8_000;

const env = loadEnv();
const logger = createLogger(env);
const app = createApp({ env, logger });

const server = app.listen(env.PORT, (err?: Error) => {
  // Express 5 passes bind errors (EADDRINUSE, EACCES) here instead of throwing.
  if (err) {
    logger.fatal({ err, port: env.PORT }, 'failed to listen');
    process.exit(1);
  }
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
});

let shuttingDown = false;

// Stop accepting connections and let in-flight requests finish. Later signals are ignored.
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  const force = setTimeout(() => {
    logger.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error while closing server');
      process.exit(1);
    }
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});
