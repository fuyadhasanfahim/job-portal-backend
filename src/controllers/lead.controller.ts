import crypto from 'crypto';
import { type Request, type Response } from 'express';
import { parseCSV, parseExcel, type ParsedRow } from '../helpers/fileParser.js';
import { createLeadsService } from '../services/lead.service.js';

export async function importLeadsController(req: Request, res: Response) {
    try {
        const ownerId = req.auth?.id;
        if (!ownerId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: 'No files uploaded' });
        }

        const uploadId = (req.body?.uploadId as string) || crypto.randomUUID();

        let parsed: ParsedRow[] = [];
        for (const file of req.files) {
            const mimetype = file.mimetype ?? '';
            const rows = mimetype.includes('csv')
                ? await parseCSV(file.path)
                : await parseExcel(file.path);
            parsed = parsed.concat(rows);
        }

        const result = await createLeadsService(ownerId, parsed, { uploadId });

        return res.json({
            success: true,
            message: 'Import complete',
            uploadId,
            ...result,
        });
    } catch (error: unknown) {
        console.error(error);
        return res
            .status(500)
            .json({ success: false, message: 'Import failed' });
    }
}
