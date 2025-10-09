import { Router } from 'express';
import {
    getSignedUser,
    getUsers,
    updatePassword,
    updateUser,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-signed-user', requireAuth, getSignedUser);
router.get('/get-all-users', requireAuth, getUsers);

router.put('/update-user', requireAuth, updateUser);
router.put('/update-password', requireAuth, updatePassword);

export const userRoute = router;
