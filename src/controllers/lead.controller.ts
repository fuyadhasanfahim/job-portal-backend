import crypto from 'crypto';
import { type Request, type Response } from 'express';
import { parseCSV, parseExcel, type ParsedRow } from '../helpers/fileParser.js';
import { getLeadsFromDB, importLeadsInDB } from '../services/lead.service.js';

export async function getLeads(req: Request, res: Response) {
    try {
        const {
            page = '1',
            limit = '10',
            search,
            status,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            country,
        } = req.query;

        const userId = req.auth?.id;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const result = await getLeadsFromDB({
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10),
            search: search as string,
            status: status as string,
            sortBy: sortBy as string,
            sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
            country: country as string,
            userId,
        });

        return res.status(200).json({
            success: true,
            message: 'Leads fetched successfully',
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch leads',
        });
    }
}

export async function importLeads(req: Request, res: Response) {
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

        const result = await importLeadsInDB(ownerId, parsed, { uploadId });

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
