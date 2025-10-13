import { Document, Types } from 'mongoose';

export interface ITask extends Document {
    title?: string;
    description?: string;
    type: 'lead_generation';
    quantity?: number;
    leads?: Types.ObjectId[];

    createdBy: Types.ObjectId;
    assignedTo?: Types.ObjectId;
    assignedBy?: Types.ObjectId;

    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    startedAt?: Date;
    finishedAt?: Date;

    progress?: number;
    metrics?: {
        done?: number;
        total?: number;
    };

    createdAt: Date;
    updatedAt: Date;
}
