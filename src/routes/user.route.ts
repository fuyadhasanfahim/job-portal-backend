import { Router } from 'express';
import { createUser } from '../controllers/user.controller.js';

const router: Router = Router();

router.post('/create-user', createUser);

export const userRoute = router;
