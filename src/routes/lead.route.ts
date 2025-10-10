import { Router } from 'express';
import { upload } from '../lib/multer.js';
import {
    assignTelemarketer,
    newLead,
    getAssignments,
    getLeads,
    importLeads,
    updateLeadStatus,
    getLeadById,
} from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-leads', requireAuth, getLeads);
router.get('/get-lead/:id', requireAuth, getLeadById);
router.get('/assignments/:userId', requireAuth, getAssignments);

router.post('/import-leads', requireAuth, upload.array('files'), importLeads);
router.post('/new-lead', requireAuth, newLead);
router.post('/assign-telemarketer', requireAuth, assignTelemarketer);

router.patch('/:leadId/status', requireAuth, updateLeadStatus);

export const leadRoute = router;
