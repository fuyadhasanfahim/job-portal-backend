import type { Types } from 'mongoose';

export interface ILeadAssignment {
    telemarketer: Types.ObjectId;
    assignedBy: Types.ObjectId;
    leads: Types.ObjectId[];
    totalTarget?: number;
    deadline?: Date;
    createdAt: Date;
    updatedAt: Date;

    completedCount: number;
    completedLeads: Types.ObjectId[];
    status: 'active' | 'completed' | 'expired';
}
