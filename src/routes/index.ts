import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes.js';

/**
 * The route registry: every feature router is mounted here, and only here,
 * so the whole API surface is visible in one file. Order matters:
 * public routes first, then the auth middleware, then role-gated routers.
 */
export function createRoutes(): Router {
  const router = Router();

  // ---- public (no token) ----
  router.use('/health', healthRouter);
  // router.use('/products', productsRouter);              payments step

  // ---- authenticated (foundation step) ----
  // router.use(authenticate);
  // router.use('/me', meRouter);
  // router.use('/student', requireRole('student'), studentRouter);
  // router.use('/mentor', requireRole('mentor'), mentorRouter);
  // router.use('/admin', requireRole('admin'), adminRouter);
  // router.use('/payments', requireRole('student'), paymentsRouter);

  return router;
}
