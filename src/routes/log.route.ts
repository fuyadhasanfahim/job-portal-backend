import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import logController from '../controllers/log.controller.js';

const router: Router = Router();

router.get('/get-logs', requireAuth, logController.getLogs);

export const logRoute = router;
