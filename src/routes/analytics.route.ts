import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import analyticsController from '../controllers/analytics.controller.js';

const router: Router = Router();

router.get('/overview', requireAuth, analyticsController.getOverview);
router.get('/lead-status', requireAuth, analyticsController.getLeadStatus);
router.get('/lead-trends', requireAuth, analyticsController.getLeadTrends);
router.get('/task-performance', requireAuth, analyticsController.getTaskPerformance);
router.get('/user-performance', requireAuth, analyticsController.getUserPerformance);
router.get('/sources', requireAuth, analyticsController.getSources);
router.get('/countries', requireAuth, analyticsController.getCountries);
router.get('/activity', requireAuth, analyticsController.getActivity);

export const analyticsRoute = router;
