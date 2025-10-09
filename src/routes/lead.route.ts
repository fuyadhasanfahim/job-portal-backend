import { Router } from 'express';
import { upload } from '../lib/multer.js';
import {
    assignLeads,
    bulkCreateLeads,
    getAssignments,
    getLeads,
    importLeads,
    updateLeadStatus,
} from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/leads', requireAuth, getLeads);
router.get('/assignments/:userId', requireAuth, getAssignments);

router.post('/leads/import', requireAuth, upload.array('files'), importLeads);
router.post('/leads/bulk-create', requireAuth, bulkCreateLeads);
router.post('/assignments', requireAuth, assignLeads);

router.patch('/leads/:leadId/status', requireAuth, updateLeadStatus);

export const leadRoute = router;
