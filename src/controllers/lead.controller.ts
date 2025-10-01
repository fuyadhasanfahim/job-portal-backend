import { type Request, type Response } from 'express';
import { importCSV, importExcel } from '../services/lead.service.js';

export async function importLeadsController(req: Request, res: Response) {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const mimetype = req.file.mimetype;

        const ownerId = req.auth?.id;

        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        let result;

        if (mimetype.includes('csv')) {
            result = await importCSV(filePath, ownerId);
        } else {
            result = await importExcel(filePath, ownerId);
        }

        return res.json({ success: true, ...result });
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ success: false, message: 'Import failed' });
    }
}
