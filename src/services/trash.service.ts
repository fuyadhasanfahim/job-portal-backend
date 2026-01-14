import { Types, type FilterQuery } from 'mongoose';
import LeadModel from '../models/lead.model.js';
import TrashedLeadModel from '../models/trash.model.js';
import UserModel from '../models/user.model.js';
import TaskModel from '../models/task.model.js';
import type { ITrashedLead } from '../types/trash.interface.js';
import { createLog } from '../utils/logger.js';

/**
 * Move a lead to trash (soft delete)
 */
async function moveToTrash(
    leadId: string,
    userId: string,
    reason?: string,
): Promise<{ success: boolean; message: string }> {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const lead = (await LeadModel.findById(leadId).lean()) as
        | (typeof LeadModel extends import('mongoose').Model<infer T>
              ? T & { createdAt: Date; updatedAt: Date }
              : never)
        | null;
    if (!lead) throw new Error('Lead not found');

    // Create trash entry with full lead data
    const trashedLead = await TrashedLeadModel.create({
        originalLeadId: lead._id,
        leadData: {
            company: lead.company,
            address: lead.address,
            country: lead.country,
            notes: lead.notes,
            contactPersons: lead.contactPersons,
            status: lead.status,
            owner: lead.owner,
            activities: lead.activities,
        },
        originalCreatedAt: lead.createdAt,
        originalUpdatedAt: lead.updatedAt,
        deletedBy: new Types.ObjectId(userId),
        deletedAt: new Date(),
        reason,
    });

    // Remove lead from any tasks
    // Remove lead from any tasks and update metrics
    const associatedTasks = await TaskModel.find({ leads: leadId });

    for (const task of associatedTasks) {
        // Remove from leads array
        if (task.leads && task.leads.length > 0) {
            task.leads = task.leads.filter((id) => id.toString() !== leadId);
            task.markModified('leads');
        }

        // Remove from completedLeads array
        if (task.completedLeads && task.completedLeads.length > 0) {
            task.completedLeads = task.completedLeads.filter(
                (id) => id.toString() !== leadId,
            );
            task.markModified('completedLeads');
        }

        // Update metrics
        if (!task.metrics) {
            task.metrics = { done: 0, total: 0 };
        }

        task.metrics.total = task.leads?.length || 0;
        task.metrics.done = task.completedLeads?.length || 0;
        task.quantity = task.metrics.total; // Sync quantity with actual leads count

        task.markModified('metrics');
        task.markModified('quantity');

        // Save triggers the pre-save hook which recalculates progress and status
        await task.save();
    }

    // Delete the original lead
    await LeadModel.findByIdAndDelete(leadId);

    // Log the deletion
    await createLog({
        userId,
        action: 'delete_lead',
        entityType: 'lead',
        entityId: leadId,
        description: `Lead "${lead.company?.name}" moved to trash by ${user.firstName} ${user.lastName || ''}`,
        data: { reason, trashedLeadId: trashedLead._id },
    });

    return {
        success: true,
        message: 'Lead moved to trash successfully',
    };
}

/**
 * Get all trashed leads (admin only)
 */
async function getTrashedLeads({
    page = 1,
    limit = 10,
    search,
    sortBy = 'deletedAt',
    sortOrder = 'desc',
}: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) {
    const query: FilterQuery<ITrashedLead> = {};

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        query.$or = [
            { 'leadData.company.name': regex },
            { 'leadData.country': regex },
        ];
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        TrashedLeadModel.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'deletedBy',
                select: 'firstName lastName email',
            })
            .populate({
                path: 'leadData.owner',
                select: 'firstName lastName email',
            })
            .lean(),
        TrashedLeadModel.countDocuments(query),
    ]);

    return {
        items,
        pagination: {
            totalItems: total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Restore a lead from trash (admin only)
 */
async function restoreFromTrash(
    trashId: string,
    userId: string,
): Promise<{ success: boolean; message: string; leadId?: string }> {
    const trashedLead = await TrashedLeadModel.findById(trashId);
    if (!trashedLead) throw new Error('Trashed lead not found');

    // Check if a lead with same company name already exists
    const existingLead = await LeadModel.findOne({
        'company.name': trashedLead.leadData.company.name,
    });

    if (existingLead) {
        throw new Error(
            `A lead with company name "${trashedLead.leadData.company.name}" already exists`,
        );
    }

    // Recreate the lead
    const restoredLead = await LeadModel.create({
        company: trashedLead.leadData.company,
        address: trashedLead.leadData.address,
        country: trashedLead.leadData.country,
        notes: trashedLead.leadData.notes,
        contactPersons: trashedLead.leadData.contactPersons,
        status: trashedLead.leadData.status,
        owner: trashedLead.leadData.owner,
        createdBy: new Types.ObjectId(userId), // Restored by this user
        updatedBy: new Types.ObjectId(userId), // Restored by this user
        activities: [
            ...(trashedLead.leadData.activities || []),
            {
                status: trashedLead.leadData.status,
                notes: 'Lead restored from trash',
                byUser: new Types.ObjectId(userId),
                at: new Date(),
            },
        ],
    });

    // Delete from trash
    await TrashedLeadModel.findByIdAndDelete(trashId);

    // Log the restoration
    await createLog({
        userId,
        action: 'restore_lead',
        entityType: 'lead',
        entityId: String(restoredLead._id),
        description: `Lead "${trashedLead.leadData.company?.name}" restored from trash`,
        data: { originalTrashId: trashId },
    });

    return {
        success: true,
        message: 'Lead restored successfully',
        leadId: String(restoredLead._id),
    };
}

/**
 * Permanently delete a lead from trash (admin only)
 */
async function permanentDelete(
    trashId: string,
    userId: string,
): Promise<{ success: boolean; message: string }> {
    const trashedLead = await TrashedLeadModel.findById(trashId);
    if (!trashedLead) throw new Error('Trashed lead not found');

    const companyName = trashedLead.leadData.company?.name;

    await TrashedLeadModel.findByIdAndDelete(trashId);

    // Log the permanent deletion
    await createLog({
        userId,
        action: 'permanent_delete_lead',
        entityType: 'trash',
        entityId: trashId,
        description: `Lead "${companyName}" permanently deleted from trash`,
    });

    return {
        success: true,
        message: 'Lead permanently deleted',
    };
}

/**
 * Bulk move leads to trash
 */
async function bulkMoveToTrash(
    leadIds: string[],
    userId: string,
    reason?: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const leadId of leadIds) {
        try {
            await moveToTrash(leadId, userId, reason);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push(`Lead ${leadId}: ${(error as Error).message}`);
        }
    }

    return results;
}

const TrashService = {
    moveToTrash,
    bulkMoveToTrash,
    getTrashedLeads,
    restoreFromTrash,
    permanentDelete,
};

export default TrashService;
