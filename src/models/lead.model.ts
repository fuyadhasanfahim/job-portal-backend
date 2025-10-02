import { Schema, model, Types } from 'mongoose';
import type { ILead } from '../types/lead.interface.js';

const LeadSchema = new Schema<ILead>(
    {
        companyName: { type: String, required: true },
        websiteUrl: { type: String },
        emails: [{ type: String }],
        phones: [{ type: String }],
        address: { type: String },

        contactPerson: {
            firstName: { type: String, required: true },
            lastName: { type: String, required: true },
        },
        designation: { type: String },
        country: { type: String, required: true },

        status: {
            type: String,
            enum: [
                'new',
                'contacted',
                'responded',
                'qualified',
                'meeting_scheduled',
                'proposal',
                'won',
                'lost',
                'on_hold',
            ],
            default: 'new',
        },
        notes: { type: String },

        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedBy: { type: Types.ObjectId, ref: 'User' },
        assignedAt: { type: Date },

        accessList: [
            {
                user: { type: Schema.Types.ObjectId, ref: 'User' },
                role: {
                    type: String,
                    enum: ['owner', 'editor', 'viewer'],
                    default: 'viewer',
                },
                grantedBy: { type: Schema.Types.ObjectId, ref: 'User' },
                grantedAt: { type: Date, default: Date.now },
            },
        ],

        activities: [
            {
                type: {
                    type: String,
                    enum: ['call', 'email', 'note', 'status_change'],
                },
                content: String,
                byUser: { type: Types.ObjectId, ref: 'User' },
                at: { type: Date, default: Date.now },
                result: String,
                nextActionAt: Date,
            },
        ],
    },
    { timestamps: true },
);

const LeadModel = model<ILead>('Lead', LeadSchema);
export default LeadModel;
