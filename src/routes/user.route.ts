import { Router } from 'express';
import {
    getSignedUser,
    getUsers,
    updatePassword,
    updateUser,
    unlockUserAccountController,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-signed-user', requireAuth, getSignedUser);
router.get('/get-all-users', requireAuth, getUsers);

router.put('/update-user', requireAuth, updateUser);
router.put('/update-password', requireAuth, updatePassword);

// Admin route to unlock a locked user account
router.post(
    '/unlock-account/:userId',
    requireAuth,
    unlockUserAccountController,
);

export const userRoute = router;
