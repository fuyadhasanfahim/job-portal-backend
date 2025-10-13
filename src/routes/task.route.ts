import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/requireAuth.js';
import TaskModel from '../models/task.model.js';
import LeadModel from '../models/lead.model.js';
import type { IActivity } from '../types/lead.interface.js';

const router: Router = Router();

router.post(
    '/create-task',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { title, description, type, quantity, assignedTo, leads } =
                req.body;
            const userId = req.auth?.id;
            const role = req.auth?.role;

            if (!userId)
                return res.status(401).json({ message: 'Unauthorized' });

            const userObjectId = new Types.ObjectId(userId);

            const formattedLeads = Array.isArray(leads)
                ? leads.map((id: string) => new Types.ObjectId(id))
                : [];

            if (role === 'admin' || role === 'super-admin') {
                if (!assignedTo)
                    return res
                        .status(400)
                        .json({ message: 'Please specify assignedTo user' });

                const assignedToId = new Types.ObjectId(assignedTo);

                const task = await TaskModel.create({
                    title,
                    description,
                    type,
                    quantity: quantity || formattedLeads.length || 0,
                    leads: formattedLeads,
                    createdBy: userObjectId,
                    assignedBy: userObjectId,
                    assignedTo: assignedToId,
                    status: 'pending',
                    metrics: {
                        done: 0,
                        total: quantity || formattedLeads.length || 0,
                    },
                });

                return res.status(201).json({
                    message: 'Task created and assigned successfully',
                    task,
                });
            }

            if (type === 'lead_generation') {
                if (!Array.isArray(leads) || leads.length === 0)
                    return res
                        .status(400)
                        .json({ message: 'No leads provided' });

                const ownedCount = await LeadModel.countDocuments({
                    _id: { $in: formattedLeads },
                    owner: userObjectId,
                });

                if (ownedCount !== formattedLeads.length) {
                    return res.status(403).json({
                        message: 'Some leads are not owned by this user',
                    });
                }

                const task = await TaskModel.create({
                    title,
                    description,
                    type,
                    quantity: formattedLeads.length,
                    leads: formattedLeads,
                    createdBy: userObjectId,
                    assignedTo: userObjectId,
                    assignedBy: userObjectId,
                    status: 'pending',
                    metrics: {
                        done: 0,
                        total: formattedLeads.length,
                    },
                });

                return res.status(201).json({
                    message: 'Self task created successfully',
                    task,
                });
            }

            return res.status(400).json({
                message: 'Invalid task type or insufficient permission',
            });
        } catch (error) {
            console.error('Task create error:', error);
            res.status(500).json({ message: 'Internal server error', error });
        }
    },
);

router.get('/get-tasks', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        let query = {};

        if (role === 'admin' || role === 'super-admin') {
            query = {};
        } else {
            const userObjectId = new Types.ObjectId(userId);
            query = {
                $or: [
                    { createdBy: userObjectId },
                    { assignedTo: userObjectId },
                ],
            };
        }

        const tasks = await TaskModel.find(query)
            .populate('createdBy', 'firstName lastName image email role')
            .populate('assignedTo', 'firstName lastName image email role')
            .sort({ createdAt: -1 });

        res.json({ tasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Internal server error', error });
    }
});

router.get(
    '/get-task/:id',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const userId = req.auth?.id;
            const role = req.auth?.role;

            if (!userId)
                return res.status(401).json({ message: 'Unauthorized' });

            if (!Types.ObjectId.isValid(id as string))
                return res.status(400).json({ message: 'Invalid Task ID' });

            // 🧩 Fetch the task and populate creator/assignee
            const task = await TaskModel.findById(id)
                .populate('createdBy', 'firstName lastName email role image')
                .populate('assignedTo', 'firstName lastName email role image')
                .lean();

            if (!task)
                return res.status(404).json({ message: 'Task not found' });

            // 🧠 Access control
            const createdById =
                task.createdBy && '_id' in task.createdBy
                    ? task.createdBy._id.toString()
                    : task.createdBy;
            const assignedToId =
                task.assignedTo && '_id' in task.assignedTo
                    ? task.assignedTo._id.toString()
                    : task.assignedTo;

            if (
                role !== 'admin' &&
                role !== 'super-admin' &&
                createdById !== userId &&
                assignedToId !== userId
            ) {
                return res.status(403).json({ message: 'Access denied' });
            }

            const leadIds = Array.isArray(task.leads) ? task.leads : [];

            const leads = await LeadModel.find({ _id: { $in: leadIds } })
                .populate('owner', 'firstName lastName email role')
                .populate('activities.byUser', 'firstName lastName email role')
                .lean();

            return res.status(200).json({
                message: 'Task fetched successfully',
                task,
                leads,
            });
        } catch (error) {
            console.error('Get single task error:', error);
            return res.status(500).json({
                message: 'Internal server error',
                error: (error as Error).message,
            });
        }
    },
);

router.put(
    '/update-task-with-lead/:taskId/:leadId',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { taskId, leadId } = req.params;
            const { taskUpdates, leadUpdates, activity } = req.body;
            const userId = req.auth?.id;
            const role = req.auth?.role;

            if (!userId)
                return res.status(401).json({ message: 'Unauthorized' });

            // 🧩 Validate IDs
            if (
                !Types.ObjectId.isValid(taskId as string) ||
                !Types.ObjectId.isValid(leadId as string)
            )
                return res.status(400).json({ message: 'Invalid IDs' });

            // 🧩 Fetch task
            const task = await TaskModel.findById(taskId);
            if (!task)
                return res.status(404).json({ message: 'Task not found' });

            // 🧩 Ensure user can modify
            const canEditTask =
                ['admin', 'super-admin'].includes(role as string) ||
                task.createdBy.toString() === userId ||
                task.assignedTo?.toString() === userId;
            if (!canEditTask)
                return res.status(403).json({ message: 'Access denied' });

            // 🧩 Apply Task Updates
            if (taskUpdates) {
                const { status, metrics, progress } = taskUpdates;

                if (status) {
                    task.status = status;
                    if (status === 'in_progress' && !task.startedAt)
                        task.startedAt = new Date();
                    if (status === 'completed') task.finishedAt = new Date();
                }

                if (metrics) {
                    task.metrics = {
                        done: metrics.done ?? task.metrics?.done ?? 0,
                        total: metrics.total ?? task.metrics?.total ?? 0,
                    };
                }

                if (typeof progress === 'number') task.progress = progress;
            }

            await task.save();

            // 🧩 Fetch lead
            const lead = await LeadModel.findById(leadId);
            if (!lead)
                return res.status(404).json({ message: 'Lead not found' });

            // 🧩 Update lead fields
            if (leadUpdates) {
                const { status, ...otherFields } = leadUpdates;
                if (status) lead.status = status;

                Object.keys(otherFields).forEach((key) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (lead as any)[key] = (otherFields as any)[key];
                });
            }

            // 🧩 Add activity record
            if (activity) {
                const newActivity: IActivity = {
                    ...activity,
                    byUser: new Types.ObjectId(userId),
                    at: new Date(),
                };

                if (!Array.isArray(lead.activities)) lead.activities = [];
                lead.activities.push(newActivity);
            }

            await lead.save();

            res.json({
                message: 'Task and Lead updated successfully',
                task,
                lead,
            });
        } catch (error) {
            console.error('Update task + lead error:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: (error as Error).message,
            });
        }
    },
);

export const taskRoute = router;
