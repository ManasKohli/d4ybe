import { Router } from 'express';

/**
 * Liveness check for Cloud Run and uptime monitors. It never touches the database,
 * so a pooler outage doesn't take the instance out of rotation.
 */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ status: 'ok' });
});
