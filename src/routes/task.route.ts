import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import TaskControllers from '../controllers/task.controller.js';

const router: Router = Router();

router.post('/create-task', requireAuth, TaskControllers.createTask);

router.get('/get-tasks', requireAuth, TaskControllers.getTasks);
router.get('/get-task/:id', requireAuth, TaskControllers.getTaskById);

router.put(
    '/update-task-with-lead/:taskId/:leadId',
    requireAuth,
    TaskControllers.updateTaskWithLead,
);

router.put(
    '/:taskId/force-complete',
    requireAuth,
    TaskControllers.forceCompleteTask,
);

router.delete(
    '/:taskId/leads/:leadId',
    requireAuth,
    TaskControllers.removeLeadFromTask,
);

export const taskRoute = router;
