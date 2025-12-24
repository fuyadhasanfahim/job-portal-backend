import { Types } from 'mongoose';
import GroupModel from '../models/group.model.js';
import type { IGroup } from '../types/group.interface.js';
import type {
    NewGroupInput,
    UpdateGroupInput,
} from '../validators/group.validator.js';
import { createLog } from '../utils/logger.js';

async function createGroup(
    userId: string,
    data: NewGroupInput,
): Promise<{ success: boolean; group?: IGroup; message?: string }> {
    try {
        const existingGroup = await GroupModel.findOne({
            name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
        });

        if (existingGroup) {
            return {
                success: false,
                message: `Group "${data.name}" already exists`,
            };
        }

        const group = await GroupModel.create({
            name: data.name.trim(),
            description: data.description?.trim() || '',
            color: data.color || '#6366f1',
            createdBy: new Types.ObjectId(userId),
        });

        await createLog({
            userId,
            action: 'create_group',
            entityType: 'group',
            entityId: group._id.toString(),
            description: `Created group "${group.name}"`,
        });

        return { success: true, group };
    } catch (error) {
        console.error('Error creating group:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to create group',
        };
    }
}

async function getAllGroups(includeInactive: boolean = false) {
    const query = includeInactive ? {} : { isActive: true };

    const groups = await GroupModel.find(query)
        .sort({ name: 1 })
        .populate({
            path: 'createdBy',
            select: 'firstName lastName email',
        })
        .lean();

    return groups;
}

async function getGroupById(id: string) {
    const group = await GroupModel.findById(id)
        .populate({
            path: 'createdBy',
            select: 'firstName lastName email',
        })
        .lean();

    return group;
}

async function updateGroup(
    id: string,
    userId: string,
    data: UpdateGroupInput,
): Promise<{ success: boolean; group?: IGroup; message?: string }> {
    try {
        const group = await GroupModel.findById(id);

        if (!group) {
            return { success: false, message: 'Group not found' };
        }

        if (data.name && data.name.trim() !== group.name) {
            const existingGroup = await GroupModel.findOne({
                _id: { $ne: id },
                name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
            });

            if (existingGroup) {
                return {
                    success: false,
                    message: `Group "${data.name}" already exists`,
                };
            }
        }

        const updates: Partial<IGroup> = {};
        const changedFields: string[] = [];

        if (data.name !== undefined && data.name.trim() !== group.name) {
            updates.name = data.name.trim();
            changedFields.push('name');
        }
        if (
            data.description !== undefined &&
            data.description !== group.description
        ) {
            updates.description = data.description.trim();
            changedFields.push('description');
        }
        if (data.color !== undefined && data.color !== group.color) {
            updates.color = data.color;
            changedFields.push('color');
        }
        if (data.isActive !== undefined && data.isActive !== group.isActive) {
            updates.isActive = data.isActive;
            changedFields.push('isActive');
        }

        if (changedFields.length === 0) {
            return { success: true, group, message: 'No changes detected' };
        }

        Object.assign(group, updates);
        await group.save();

        await createLog({
            userId,
            action: 'update_group',
            entityType: 'group',
            entityId: id,
            description: `Updated group "${group.name}". Fields: ${changedFields.join(', ')}`,
            data: { changedFields, updates },
        });

        return { success: true, group };
    } catch (error) {
        console.error('Error updating group:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to update group',
        };
    }
}

async function softDeleteGroup(
    id: string,
    userId: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        const group = await GroupModel.findById(id);

        if (!group) {
            return { success: false, message: 'Group not found' };
        }

        group.isActive = false;
        await group.save();

        await createLog({
            userId,
            action: 'soft_delete_group',
            entityType: 'group',
            entityId: id,
            description: `Deactivated group "${group.name}"`,
        });

        return { success: true, message: `Group "${group.name}" deactivated` };
    } catch (error) {
        console.error('Error soft deleting group:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to delete group',
        };
    }
}

async function permanentDeleteGroup(
    id: string,
    userId: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        const group = await GroupModel.findById(id);

        if (!group) {
            return { success: false, message: 'Group not found' };
        }

        const groupName = group.name;
        await GroupModel.deleteOne({ _id: id });

        await createLog({
            userId,
            action: 'permanent_delete_group',
            entityType: 'group',
            entityId: id,
            description: `Permanently deleted group "${groupName}"`,
        });

        return {
            success: true,
            message: `Group "${groupName}" permanently deleted`,
        };
    } catch (error) {
        console.error('Error permanently deleting group:', error);
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to delete group',
        };
    }
}

const GroupService = {
    createGroup,
    getAllGroups,
    getGroupById,
    updateGroup,
    softDeleteGroup,
    permanentDeleteGroup,
};

export default GroupService;
