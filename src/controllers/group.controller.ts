import { type Request, type Response } from 'express';
import GroupService from '../services/group.service.js';
import {
    newGroupValidation,
    updateGroupValidation,
} from '../validators/group.validator.js';
import { z } from 'zod';

async function getAllGroups(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const includeInactive = req.query.includeInactive === 'true';

        const groups = await GroupService.getAllGroups(includeInactive);

        return res.status(200).json({
            success: true,
            message: 'Groups fetched successfully',
            data: groups,
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch groups',
        });
    }
}

async function getGroupById(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required',
            });
        }

        const group = await GroupService.getGroupById(id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: group,
        });
    } catch (error) {
        console.error('Error fetching group:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch group',
        });
    }
}

async function createGroup(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole || '')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.',
            });
        }

        const parsed = newGroupValidation.parse(req.body);
        const result = await GroupService.createGroup(userId, parsed);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: result.group,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.issues[0]?.message || 'Validation error',
            });
        }
        console.error('Error creating group:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create group',
        });
    }
}

async function updateGroup(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole || '')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required',
            });
        }

        const parsed = updateGroupValidation.parse(req.body);
        const result = await GroupService.updateGroup(id, userId, parsed);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Group updated successfully',
            data: result.group,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.issues[0]?.message || 'Validation error',
            });
        }
        console.error('Error updating group:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update group',
        });
    }
}

async function deleteGroup(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!['admin', 'super-admin'].includes(userRole || '')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required',
            });
        }

        const result = await GroupService.softDeleteGroup(id, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('Error deleting group:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete group',
        });
    }
}

async function permanentDelete(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin privileges required.',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Group ID is required',
            });
        }

        const result = await GroupService.permanentDeleteGroup(id, userId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('Error permanently deleting group:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete group',
        });
    }
}

const GroupController = {
    getAllGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    permanentDelete,
};

export default GroupController;
