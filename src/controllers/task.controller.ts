import { type Request, type Response } from 'express';
import TaskServices from '../services/task.service.js';
import { Types } from 'mongoose';

async function createTask(req: Request, res: Response) {
    try {
        const { title, description, type, quantity, assignedTo, leads } =
            req.body;

        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!userId || !role) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const result = await TaskServices.createTaskInDB({
            title,
            description,
            type,
            quantity,
            assignedTo,
            leads,
            userId,
            role,
        });

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Task create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: (error as Error).message,
        });
    }
}

async function getTasks(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const { page = '1', limit = '10' } = req.query as Record<
            string,
            string
        >;

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const result = await TaskServices.getTasksFromDB({
            userId,
            role,
            page: parsedPage,
            limit: parsedLimit,
        });

        return res.status(200).json({
            success: true,
            message: 'Tasks fetched successfully',
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get tasks error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: (error as Error).message,
        });
    }
}

async function getTaskById(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!Types.ObjectId.isValid(id!)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task ID',
            });
        }

        const result = await TaskServices.getTaskByIdFromDB({
            taskId: id as string,
            userId,
            role,
        });

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Get single task error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: (error as Error).message,
        });
    }
}

async function updateTaskWithLead(req: Request, res: Response) {
    try {
        const { taskId, leadId } = req.params;
        const { taskUpdates, leadUpdates, activity } = req.body;
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const result = await TaskServices.updateTaskWithLeadInDB({
            taskId: taskId!,
            leadId: leadId!,
            taskUpdates,
            leadUpdates,
            activity,
            userId,
            role,
        });

        return res.status(result.statusCode).json(result);
    } catch (error) {
        console.error('Update task + lead error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: (error as Error).message,
        });
    }
}

const TaskControllers = {
    createTask,
    getTasks,
    getTaskById,
    updateTaskWithLead,
};
export default TaskControllers;
