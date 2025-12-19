import { Router } from 'express';
import TrashController from '../controllers/trash.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

// Get all trashed leads (admin only)
router.get('/', requireAuth, TrashController.getTrashedLeads);

// Restore a lead from trash (admin only)
router.post('/:id/restore', requireAuth, TrashController.restoreLead);

// Permanently delete from trash (admin only)
router.delete('/:id', requireAuth, TrashController.permanentDeleteLead);

export const trashRoute = router;
