import { Router } from 'express';
import { upload } from '../lib/multer.js';
import { importLeadsController } from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.post(
    '/import-leads',
    requireAuth,
    upload.array('files'),
    importLeadsController,
);

export const leadRoute = router;
