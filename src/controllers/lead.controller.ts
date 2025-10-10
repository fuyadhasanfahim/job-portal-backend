import crypto from 'crypto';
import { type Request, type Response } from 'express';
import { parseCSV, parseExcel, type ParsedRow } from '../helpers/fileParser.js';
import {
    assignTelemarketerIntoDB,
    newLeadsInDB,
    getAssignmentsForUserFromDB,
    getLeadsFromDB,
    importLeadsInDB,
    updateLeadStatusInDB,
    getLeadByIdFromDB,
} from '../services/lead.service.js';

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

export async function getLeadById(req: Request, res: Response) {
    try {
        const { id } = req.params;
        console.log(id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Id is required.',
            });
        }

        const lead = await getLeadByIdFromDB(id);

        res.status(200).json({
            success: true,
            lead,
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
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ success: false, message: 'Import failed' });
    }
}

export async function newLead(req: Request, res: Response) {
    try {
        const ownerId = req.auth?.id;
        if (!ownerId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const lead = req.body;
        if (!lead) {
            return res
                .status(400)
                .json({ success: false, message: 'No lead provided' });
        }

        const result = await newLeadsInDB(ownerId, lead);

        return res.status(201).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('New lead error:', error);
        return res
            .status(500)
            .json({ success: false, message: 'Failed to create lead' });
    }
}

export async function assignTelemarketer(req: Request, res: Response) {
    try {
        const { telemarketerId, leads, totalTarget, deadline } = req.body;
        const assignedBy = req.auth?.id;
        const role = req.auth?.role;

        if (role !== 'admin' && role !== 'super-admin') {
            return res
                .status(403)
                .json({ success: false, message: 'Forbidden' });
        }
        if (!assignedBy) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const assignment = await assignTelemarketerIntoDB({
            telemarketerId,
            assignedBy,
            leads,
            totalTarget,
            deadline,
        });

        res.status(201).json({
            success: true,
            message: 'Leads assigned successfully',
            data: assignment,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to assign leads',
            error: (error as Error).message,
        });
    }
}

export async function getAssignments(req: Request, res: Response) {
    try {
        const userId = req.params.userId || req.auth?.id;
        const role = req.auth?.role;

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const assignments = await getAssignmentsForUserFromDB(userId, role);

        res.status(200).json({
            success: true,
            message: 'Assignments fetched successfully',
            data: assignments,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to fetch assignments',
            error: (error as Error).message,
        });
    }
}

export async function updateLeadStatus(req: Request, res: Response) {
    try {
        const { status, note } = req.body;
        const leadId = req.params.leadId;
        const userId = req.auth?.id;

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }
        if (!leadId) {
            return res
                .status(400)
                .json({ success: false, message: 'Lead ID is required' });
        }

        const updated = await updateLeadStatusInDB({
            leadId,
            userId,
            status,
            note,
        });

        res.status(200).json({
            success: true,
            message: 'Lead status updated successfully',
            data: updated,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update lead status',
            error: (error as Error).message,
        });
    }
}
