import { Router, type RequestHandler } from 'express';
import { healthRouter } from '../modules/health/health.routes.js';
import { createMeRouter } from '../modules/me/me.routes.js';
import type { MeService } from '../modules/me/me.service.js';

export interface RouteDeps {
  authenticate: RequestHandler;
  me: MeService;
}

/**
 * The route registry: every feature router is mounted here, and only here,
 * so the whole API surface is visible in one file. Order matters:
 * public routes first, then the auth middleware, then role-gated routers.
 */
export function createRoutes({ authenticate, me }: RouteDeps): Router {
  const router = Router();

  // ---- public (no token) ----
  router.use('/health', healthRouter);
  // router.use('/products', productsRouter);              payments step

  // ---- authenticated: everything below needs a valid Supabase token ----
  router.use(authenticate);
  router.use('/me', createMeRouter(me));
  // router.use('/student', requireRole('student'), studentRouter);
  // router.use('/mentor', requireRole('mentor'), mentorRouter);
  // router.use('/admin', requireRole('admin'), adminRouter);
  // router.use('/payments', requireRole('student'), paymentsRouter);

  return router;
}
