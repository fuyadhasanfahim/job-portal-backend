import { Router } from 'express';
import {
    getSignedUser,
    getUsers,
    updatePassword,
    updateUser,
    unlockUserAccountController,
    updateTablePreferences,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-signed-user', requireAuth, getSignedUser);
router.get('/get-all-users', requireAuth, getUsers);

router.put('/update-user', requireAuth, updateUser);
router.put('/update-password', requireAuth, updatePassword);

// Update table column preferences
router.patch('/table-preferences', requireAuth, updateTablePreferences);

// Admin route to unlock a locked user account
router.post(
    '/unlock-account/:userId',
    requireAuth,
    unlockUserAccountController,
);

export const userRoute = router;
