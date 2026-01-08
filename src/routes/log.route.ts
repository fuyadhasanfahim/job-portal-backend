import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import logController from '../controllers/log.controller.js';

const router: Router = Router();

router.get('/get-lead-analytics', requireAuth, logController.getLeadAnalytics);

router.get('/get-top-users', requireAuth, logController.getTopUsers);

// NEW routes for enhanced analytics
router.get('/get-user-lead-stats', requireAuth, logController.getUserLeadStats);

router.get(
    '/get-top-users-pie-chart',
    requireAuth,
    logController.getTopUsersPieChart,
);

router.get('/get-all-users-table', requireAuth, logController.getAllUsersTable);

router.get('/get-activity-logs', requireAuth, logController.getActivityLogs);

export const logRoute = router;
