import type { Document, Types } from 'mongoose';

export interface ILog extends Document {
    user?: Types.ObjectId;
    action: string;
    entityType:
        | 'lead'
        | 'task'
        | 'user'
        | 'system'
        | 'trash'
        | 'group'
        | 'other';
    entityId?: Types.ObjectId;
    description?: string;
    data?: object;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
}
