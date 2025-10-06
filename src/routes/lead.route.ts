import { Router } from 'express';
import { upload } from '../lib/multer.js';
import {
    bulkCreateLeads,
    getLeads,
    importLeads,
} from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-leads', requireAuth, getLeads);

router.post('/import-leads', requireAuth, upload.array('files'), importLeads);
router.post('/bulk-create', requireAuth, bulkCreateLeads);

export const leadRoute = router;
