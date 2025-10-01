import { Router } from 'express';
import { getSignedUserController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-signed-user', requireAuth, getSignedUserController);

export const userRoute = router;
