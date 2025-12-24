import { Router } from 'express';
import GroupController from '../controllers/group.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

// Get all groups (all authenticated users)
router.get('/', requireAuth, GroupController.getAllGroups);

// Get single group by ID
router.get('/:id', requireAuth, GroupController.getGroupById);

// Create new group (admin only - checked in controller)
router.post('/', requireAuth, GroupController.createGroup);

// Update group (admin only - checked in controller)
router.put('/:id', requireAuth, GroupController.updateGroup);

// Soft delete group (admin only - checked in controller)
router.delete('/:id', requireAuth, GroupController.deleteGroup);

// Permanent delete (super-admin only - checked in controller)
router.delete('/:id/permanent', requireAuth, GroupController.permanentDelete);

export const groupRoute = router;
