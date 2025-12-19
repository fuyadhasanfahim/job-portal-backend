import { Router } from 'express';
import { upload } from '../lib/multer.js';
import LeadController from '../controllers/lead.controller.js';
import TrashController from '../controllers/trash.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router: Router = Router();

// Get
router.get('/get-leads', requireAuth, LeadController.getLeads);
router.get('/get-leads-by-date', requireAuth, LeadController.getLeadsByDate);
router.get('/get-lead/:id', requireAuth, LeadController.getLeadById);
router.get('/search-by-company', requireAuth, LeadController.searchLeadByCompany);

// Post
router.post('/new-lead', requireAuth, LeadController.newLead);
router.post('/:id/add-contact-person', requireAuth, LeadController.addContactPerson);
router.put('/update-lead/:id', requireAuth, LeadController.updateLead);

router.post(
    '/import-leads',
    requireAuth,
    upload.array('files'),
    LeadController.importLeads,
);

// Delete (moves to trash)
router.delete('/:id', requireAuth, TrashController.deleteLead);

export const leadRoute = router;

