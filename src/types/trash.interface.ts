import type { Document, Types } from 'mongoose';
import type { ILead } from './lead.interface.js';

export interface ITrashedLead extends Document {
    originalLeadId: Types.ObjectId;
    leadData: Omit<ILead, '_id' | 'createdAt' | 'updatedAt'>;
    originalCreatedAt: Date;
    originalUpdatedAt: Date;
    deletedBy: Types.ObjectId;
    deletedAt: Date;
    reason?: string;
}
