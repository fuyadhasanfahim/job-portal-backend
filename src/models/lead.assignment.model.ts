import { model, Schema } from 'mongoose';
import type { ILeadAssignment } from '../types/lead.assignment.interface.js';

const LeadAssignmentSchema = new Schema<ILeadAssignment>(
    {
        telemarketer: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        leads: [{ type: Schema.Types.ObjectId, ref: 'Lead' }],
        totalTarget: { type: Number },
        deadline: { type: Date },
        completedCount: { type: Number, default: 0 },
        completedLeads: [
            { type: Schema.Types.ObjectId, ref: 'Lead', default: [] },
        ],
        status: {
            type: String,
            enum: ['active', 'completed', 'expired'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    },
);

const LeadAssignmentModel = model<ILeadAssignment>(
    'LeadAssignment',
    LeadAssignmentSchema,
);
export default LeadAssignmentModel;
