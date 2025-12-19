import type { Request, Response } from 'express';
import TrashService from '../services/trash.service.js';

/**
 * Delete a lead (move to trash)
 */
async function deleteLead(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const { reason } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required',
            });
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const result = await TrashService.moveToTrash(id, userId, reason);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Delete lead error:', error);

        if ((error as Error).message === 'Lead not found') {
            return res.status(404).json({
                success: false,
                message: 'Lead not found',
            });
        }

        if ((error as Error).message.includes('Access forbidden')) {
            return res.status(403).json({
                success: false,
                message: (error as Error).message,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to delete lead',
        });
    }
}

/**
 * Get all trashed leads (admin only)
 */
async function getTrashedLeads(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.',
            });
        }

        const {
            page = '1',
            limit = '10',
            search = '',
            sortBy = 'deletedAt',
            sortOrder = 'desc',
        } = req.query as Record<string, string>;

        const result = await TrashService.getTrashedLeads({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            search,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc',
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Get trashed leads error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch trashed leads',
        });
    }
}

/**
 * Restore a lead from trash (admin only)
 */
async function restoreLead(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Trash ID is required',
            });
        }

        if (!userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.',
            });
        }

        const result = await TrashService.restoreFromTrash(id, userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Restore lead error:', error);

        if ((error as Error).message === 'Trashed lead not found') {
            return res.status(404).json({
                success: false,
                message: 'Trashed lead not found',
            });
        }

        if ((error as Error).message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: (error as Error).message,
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to restore lead',
        });
    }
}

/**
 * Permanently delete a lead from trash (admin only)
 */
async function permanentDeleteLead(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Trash ID is required',
            });
        }

        if (!userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.',
            });
        }

        const result = await TrashService.permanentDelete(id, userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Permanent delete error:', error);

        if ((error as Error).message === 'Trashed lead not found') {
            return res.status(404).json({
                success: false,
                message: 'Trashed lead not found',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to permanently delete lead',
        });
    }
}

const TrashController = {
    deleteLead,
    getTrashedLeads,
    restoreLead,
    permanentDeleteLead,
};

export default TrashController;
