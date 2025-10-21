import { Types, type FilterQuery, type UpdateQuery } from 'mongoose';
import TaskModel from '../models/task.model.js';
import LeadModel from '../models/lead.model.js';
import type { ITask } from '../types/task.interface.js';
import type { IActivity, ILead } from '../types/lead.interface.js';

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
    selectedUserId,
    status,
    date,
}: {
    userId: string;
    role: string;
    page: number;
    limit: number;
    selectedUserId?: string;
    status?: string;
    date?: string | Date;
}) {
    const skip = (page - 1) * limit;
    const query: FilterQuery<ITask> = {};

    if (role === 'super-admin') {
        if (selectedUserId && selectedUserId !== 'all') {
            query.assignedTo = new Types.ObjectId(selectedUserId);
        }
    } else if (role === 'admin') {
        if (selectedUserId && selectedUserId !== 'all') {
            query.assignedTo = new Types.ObjectId(selectedUserId);
        }
    } else {
        const userObjectId = new Types.ObjectId(userId);
        query.$or = [{ createdBy: userObjectId }, { assignedTo: userObjectId }];
    }

    if (status && status !== 'all') {
        query.status = status;
    }

    if (date) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: dayStart, $lte: dayEnd };
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

    for (const lead of leads) {
        if (Array.isArray(lead.activities)) {
            lead.activities.sort(
                (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
            );
        }
    }

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
        status?: ITask['status'];
        metrics?: { done?: number; total?: number };
        progress?: number;
    };
    leadUpdates?: Partial<ILead>;
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

    const task = await TaskModel.findById(taskId).lean();
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

    const freshTask = await TaskModel.findById(taskId)
        .select(
            'completedLeads metrics quantity leads status startedAt finishedAt progress',
        )
        .lean();

    if (!freshTask) {
        return {
            success: false,
            statusCode: 500,
            message: 'Unexpected error: task data missing',
        };
    }

    const completedLeads = new Set(
        (freshTask.completedLeads || []).map((id) => id.toString()),
    );
    const leadIdStr = leadId.toString();
    const leadAlreadyCounted = completedLeads.has(leadIdStr);

    const total = Math.max(
        freshTask.quantity ||
            freshTask.leads?.length ||
            freshTask.metrics?.total ||
            1,
    );

    let updatedCompletedLeadsCount = completedLeads.size;
    if (!leadAlreadyCounted) updatedCompletedLeadsCount += 1;

    const done = Math.min(updatedCompletedLeadsCount, total);
    const progress = Math.min(100, Math.round((done / total) * 100));

    let shouldUpdateTask = false;
    const taskUpdatePayload: UpdateQuery<ITask> = {};

    if (!leadAlreadyCounted) {
        taskUpdatePayload.$addToSet = {
            completedLeads: new Types.ObjectId(leadId),
        };
        shouldUpdateTask = true;
    }

    const currentMetrics = freshTask.metrics || {};
    const currentDone = currentMetrics.done || 0;
    const currentTotal = currentMetrics.total || total;
    const currentProgress = freshTask.progress || 0;

    if (
        done !== currentDone ||
        total !== currentTotal ||
        progress !== currentProgress
    ) {
        taskUpdatePayload.$set = {
            ...taskUpdatePayload.$set,
            'metrics.done': done,
            'metrics.total': total,
            progress,
        };
        shouldUpdateTask = true;
    }

    const isNowComplete = progress >= 100;
    const isStarting = freshTask.status === 'pending' && !freshTask.startedAt;
    const currentStatus = freshTask.status;

    if (isNowComplete && currentStatus !== 'completed') {
        taskUpdatePayload.$set = {
            ...taskUpdatePayload.$set,
            status: 'completed',
            finishedAt: new Date(),
        };
        shouldUpdateTask = true;
    } else if (isStarting) {
        taskUpdatePayload.$set = {
            ...taskUpdatePayload.$set,
            status: 'in_progress',
            startedAt: new Date(),
        };
        shouldUpdateTask = true;
    } else if (!isNowComplete && currentStatus === 'completed') {
        taskUpdatePayload.$set = {
            ...taskUpdatePayload.$set,
            status: 'in_progress',
            finishedAt: null,
        };
        shouldUpdateTask = true;
    }

    if (shouldUpdateTask && Object.keys(taskUpdatePayload).length > 0) {
        await TaskModel.findByIdAndUpdate(taskId, taskUpdatePayload);
    }

    if (taskUpdates) {
        const manualUpdatePayload: UpdateQuery<ITask> = { $set: {} };

        if (taskUpdates.status)
            manualUpdatePayload.$set!.status = taskUpdates.status;

        if (taskUpdates.metrics) {
            manualUpdatePayload.$set!['metrics.done'] = Math.min(
                taskUpdates.metrics.done ?? done,
                total,
            );
            manualUpdatePayload.$set!['metrics.total'] = Math.max(
                taskUpdates.metrics.total ?? total,
                1,
            );
        }

        if (typeof taskUpdates.progress === 'number') {
            manualUpdatePayload.$set!.progress = Math.min(
                100,
                Math.max(0, taskUpdates.progress),
            );
        }

        if (Object.keys(manualUpdatePayload.$set!).length > 0) {
            await TaskModel.findByIdAndUpdate(taskId, manualUpdatePayload);
        }
    }

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
        return {
            success: false,
            statusCode: 404,
            message: 'Lead not found',
        };
    }

    if (leadUpdates) {
        Object.assign(lead, leadUpdates);
    }

    if (activity && activity.status) {
        const newActivity: IActivity = {
            status: activity.status,
            notes: activity.notes ?? '',
            nextAction: activity.nextAction as
                | 'close'
                | 'call-back'
                | 'follow-up'
                | 'send-proposal',
            dueAt: activity.dueAt ?? undefined,
            byUser: new Types.ObjectId(userId),
            at: new Date(),
        };

        if (!Array.isArray(lead.activities)) lead.activities = [];
        lead.activities.push(newActivity);

        lead.status = activity.status;
    }

    await lead.save();

    return {
        success: true,
        message: leadAlreadyCounted
            ? 'Lead updated (progress unchanged)'
            : 'Task progress increased and lead updated successfully',
        data: {
            progress,
            completedLeads: done,
            totalLeads: total,
            wasNewCompletion: !leadAlreadyCounted,
        },
    };
}

const TaskServices = {
    createTaskInDB,
    getTasksFromDB,
    getTaskByIdFromDB,
    updateTaskWithLeadInDB,
};
export default TaskServices;
