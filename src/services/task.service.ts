import { Types, type FilterQuery } from 'mongoose';
import TaskModel from '../models/task.model.js';
import LeadModel from '../models/lead.model.js';
import type { ITask } from '../types/task.interface.js';
import type { IActivity } from '../types/lead.interface.js';

async function createTaskInDB({
    title,
    description,
    type,
    quantity,
    assignedTo,
    leads = [],
    userId,
    role,
}: {
    title: string;
    description?: string;
    type: string;
    quantity?: number;
    assignedTo?: string;
    leads?: string[];
    userId: string;
    role: string;
}) {
    const userObjectId = new Types.ObjectId(userId);
    const formattedLeads = leads.map((id) => new Types.ObjectId(id));

    if (role === 'admin' || role === 'super-admin') {
        if (!assignedTo) {
            return {
                success: false,
                statusCode: 400,
                message: 'Please specify assignedTo user',
            };
        }

        const assignedToId = new Types.ObjectId(assignedTo);
        const totalQty = quantity || formattedLeads.length || 0;

        const task = await TaskModel.create({
            title,
            description,
            type,
            quantity: totalQty,
            leads: formattedLeads,
            createdBy: userObjectId,
            assignedBy: userObjectId,
            assignedTo: assignedToId,
            status: 'pending',
            metrics: {
                done: 0,
                total: totalQty,
            },
        });

        return {
            success: true,
            statusCode: 201,
            message: 'Task created and assigned successfully',
            task,
        };
    }

    if (type === 'lead_generation') {
        if (!formattedLeads.length) {
            return {
                success: false,
                statusCode: 400,
                message: 'No leads provided',
            };
        }

        const ownedCount = await LeadModel.countDocuments({
            _id: { $in: formattedLeads },
            owner: userObjectId,
        });

        if (ownedCount !== formattedLeads.length) {
            return {
                success: false,
                statusCode: 403,
                message: 'Some leads are not owned by this user',
            };
        }

        const task = await TaskModel.create({
            title,
            description,
            type,
            quantity: formattedLeads.length,
            leads: formattedLeads,
            createdBy: userObjectId,
            assignedBy: userObjectId,
            assignedTo: userObjectId,
            status: 'pending',
            metrics: {
                done: 0,
                total: formattedLeads.length,
            },
        });

        return {
            success: true,
            statusCode: 201,
            message: 'Self task created successfully',
            task,
        };
    }

    return {
        success: false,
        statusCode: 400,
        message: 'Invalid task type or insufficient permission',
    };
}

async function getTasksFromDB({
    userId,
    role,
    page,
    limit,
}: {
    userId: string;
    role: string;
    page: number;
    limit: number;
}) {
    const skip = (page - 1) * limit;
    let query: FilterQuery<ITask> = {};

    if (role === 'admin' || role === 'super-admin') {
        query = {};
    } else {
        const userObjectId = new Types.ObjectId(userId);
        query = {
            $or: [{ createdBy: userObjectId }, { assignedTo: userObjectId }],
        };
    }

    const [items, total] = await Promise.all([
        TaskModel.find(query)
            .populate('createdBy', 'firstName lastName email role image')
            .populate('assignedTo', 'firstName lastName email role image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        TaskModel.countDocuments(query),
    ]);

    return {
        items,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
    };
}

async function getTaskByIdFromDB({
    taskId,
    userId,
    role,
}: {
    taskId: string;
    userId: string;
    role: string;
}) {
    // 🧩 Find the task and populate relations
    const task = await TaskModel.findById(taskId)
        .populate('createdBy', 'firstName lastName email role image')
        .populate('assignedTo', 'firstName lastName email role image')
        .lean();

    if (!task) {
        return {
            success: false,
            statusCode: 404,
            message: 'Task not found',
        };
    }

    const createdById =
        task.createdBy && '_id' in task.createdBy
            ? task.createdBy._id.toString()
            : task.createdBy;
    const assignedToId =
        task.assignedTo && '_id' in task.assignedTo
            ? task.assignedTo._id.toString()
            : task.assignedTo;

    const hasAccess =
        role === 'admin' ||
        role === 'super-admin' ||
        createdById === userId ||
        assignedToId === userId;

    if (!hasAccess) {
        return {
            success: false,
            statusCode: 403,
            message: 'Access denied',
        };
    }

    const leadIds = Array.isArray(task.leads)
        ? task.leads.map((l) => new Types.ObjectId(l))
        : [];

    const leads = await LeadModel.find({ _id: { $in: leadIds } })
        .populate('owner', 'firstName lastName email role')
        .populate('activities.byUser', 'firstName lastName email role')
        .lean()
        .sort({
            updatedAt: 1,
        });

    return {
        success: true,
        statusCode: 200,
        message: 'Task fetched successfully',
        task,
        leads,
    };
}

async function updateTaskWithLeadInDB({
    taskId,
    leadId,
    taskUpdates,
    leadUpdates,
    activity,
    userId,
    role,
}: {
    taskId: string;
    leadId: string;
    taskUpdates?: {
        status?: string;
        metrics?: { done?: number; total?: number };
        progress?: number;
    };
    leadUpdates?: Record<string, string>;
    activity?: Partial<IActivity>;
    userId: string;
    role: string;
}) {
    if (!Types.ObjectId.isValid(taskId) || !Types.ObjectId.isValid(leadId)) {
        return {
            success: false,
            statusCode: 400,
            message: 'Invalid task or lead ID',
        };
    }

    const task = await TaskModel.findById(taskId);
    if (!task) {
        return {
            success: false,
            statusCode: 404,
            message: 'Task not found',
        };
    }

    const canEdit =
        ['admin', 'super-admin'].includes(role) ||
        task.createdBy.toString() === userId ||
        task.assignedTo?.toString() === userId;

    if (!canEdit) {
        return {
            success: false,
            statusCode: 403,
            message: 'Access denied',
        };
    }

    if (taskUpdates) {
        const { status, metrics, progress } = taskUpdates;

        if (status) {
            task.status = status as
                | 'pending'
                | 'in_progress'
                | 'completed'
                | 'cancelled';
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

        if (typeof progress === 'number') {
            task.progress = progress;
        }
    }

    await task.save();

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
        return {
            success: false,
            statusCode: 404,
            message: 'Lead not found',
        };
    }

    if (leadUpdates) {
        const { status, ...rest } = leadUpdates;

        if (status)
            lead.status = status as
                | 'new'
                | 'contacted'
                | 'responded'
                | 'qualified'
                | 'meetingScheduled'
                | 'proposal'
                | 'won'
                | 'lost'
                | 'onHold';

        Object.entries(rest).forEach(([key, value]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (lead as any)[key] = value;
        });
    }

    if (activity) {
        const newActivity: IActivity = {
            type: activity.type as 'call' | 'email' | 'note' | 'statusChange',
            outcomeCode: activity.outcomeCode as
                | 'connected'
                | 'qualified'
                | 'notQualified'
                | 'callbackScheduled'
                | 'needsDecisionMaker'
                | 'sendInfo'
                | 'negotiation'
                | 'won'
                | 'lost'
                | 'noAnswer'
                | 'voicemailLeft'
                | 'busy'
                | 'switchedOff'
                | 'invalidNumber'
                | 'wrongPerson'
                | 'dnd'
                | 'followUpScheduled'
                | 'followUpOverdue'
                | 'unreachable'
                | 'duplicate'
                | 'archived',
            notes: activity.notes ?? '',
            result: activity.result ?? '',
            byUser: new Types.ObjectId(userId),
            at: new Date(),
        };

        if (!Array.isArray(lead.activities)) {
            lead.activities = [];
        }

        lead.activities.push(newActivity);
    }

    await lead.save();

    return {
        success: true,
        statusCode: 200,
        message: 'Task and lead updated successfully',
        task,
        lead,
    };
}

const TaskServices = {
    createTaskInDB,
    getTasksFromDB,
    getTaskByIdFromDB,
    updateTaskWithLeadInDB,
};
export default TaskServices;
