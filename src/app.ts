import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Env } from './config/env.js';
import { createHttpLogger } from './lib/http-logger.js';
import type { Logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { createRoutes } from './routes/index.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
}

/**
 * Build the Express app. Middleware order is fixed by docs/architecture.md section 3:
 * helmet → cors → pino-http → /webhooks/stripe (raw body) → express.json → /health
 * → auth → routers → 404 → error handler.
 */
export function createApp({ env, logger }: AppDeps): Express {
  const app = express();

  // Cloud Run sits behind one Google front end; trust it for req.ip and req.protocol.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin (curl, Stripe, health checks) are not CORS requests.
      origin: (origin, callback) => callback(null, !origin || env.ALLOWED_ORIGINS.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(createHttpLogger(logger));

  // Stripe webhook mounts here with express.raw() before the JSON parser (payments step).

  app.use(express.json({ limit: '100kb' }));

  app.use(createRoutes());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
