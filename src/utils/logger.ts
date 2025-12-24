import { Types } from 'mongoose';
import LogModel from '../models/logs.model.js';

interface LogOptions {
    userId?: string;
    action: string;
    entityType:
        | 'user'
        | 'lead'
        | 'task'
        | 'system'
        | 'trash'
        | 'other'
        | 'company'
        | 'group';
    entityId?: string;
    description?: string;
    data?: object;
    ip?: string;
    userAgent?: string;
}

export async function createLog({
    userId,
    action,
    entityType,
    entityId,
    description,
    data,
    ip,
    userAgent,
}: LogOptions) {
    try {
        await LogModel.create({
            user: userId ? new Types.ObjectId(userId) : undefined,
            action,
            entityType,
            entityId: entityId ? new Types.ObjectId(entityId) : undefined,
            description,
            data,
            ip,
            userAgent,
        });
    } catch (err) {
        console.error('⚠️ Log creation failed:', err);
    }
}
