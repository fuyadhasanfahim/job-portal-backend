import { Router } from 'express';
import {
    refreshTokenController,
    signinController,
    signoutController,
    signupController,
} from '../controllers/auth.controller.js';
import { csrfGuard } from '../middleware/csrfGuard.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router: Router = Router();

router.post('/sign-up', authLimiter, signupController);
router.post('/sign-in', authLimiter, signinController);
router.post('/refresh-token', csrfGuard, refreshTokenController);
router.post('/sign-out', csrfGuard, signoutController);

export const authRoute = router;
