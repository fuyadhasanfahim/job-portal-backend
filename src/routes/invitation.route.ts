import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import InvitationController from '../controllers/invitation.controller.js';

const router = Router();

// Create invitation (admin only)
router.post('/', requireAuth, InvitationController.createInvitation);

// Validate invitation token (public - for signup page)
router.get('/validate/:token', InvitationController.validateInvitation);

// Get all invitations (admin only)
router.get('/', requireAuth, InvitationController.getAllInvitations);

// Revoke invitation (admin only)
router.delete('/:id', requireAuth, InvitationController.revokeInvitation);

// Resend invitation (admin only)
router.post('/:id/resend', requireAuth, InvitationController.resendInvitation);

export const invitationRoute = router;
