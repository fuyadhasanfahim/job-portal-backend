import type { Document, Types } from 'mongoose';

export interface ILog extends Document {
    user?: Types.ObjectId;
    action: string;
    level?: 'info' | 'warning' | 'error' | 'debug';
    entityType:
        | 'lead'
        | 'task'
        | 'user'
        | 'system'
        | 'trash'
        | 'group'
        | 'invitation'
        | 'other';
    entityId?: Types.ObjectId;
    description?: string;
    data?: object;
    ip?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
}
