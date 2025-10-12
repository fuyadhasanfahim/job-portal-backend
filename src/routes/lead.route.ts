import { Router } from 'express';
// import { upload } from '../lib/multer.js';
import LeadController from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

router.get('/get-leads', requireAuth, LeadController.getLeads);
router.get('/get-lead/:id', requireAuth, LeadController.getLeadById);

router.post('/new-lead', requireAuth, LeadController.newLead);

router.put('/update-lead/:id', requireAuth, LeadController.updateLead);

// router.post('/import-leads', requireAuth, upload.array('files'), importLeads);

export const leadRoute = router;
