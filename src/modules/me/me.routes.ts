import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { MeService } from './me.service.js';

export function createMeRouter(me: MeService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    // Per-user data is never cached (section 11).
    res.set('Cache-Control', 'no-store').json(await me.getMe(req.user));
  });

  return router;
}
