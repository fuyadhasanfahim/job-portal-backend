import { Schema, model } from 'mongoose';
import type { ITrashedLead } from '../types/trash.interface.js';

const TrashedLeadSchema = new Schema<ITrashedLead>(
    {
        originalLeadId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        leadData: {
            company: {
                name: { type: String, required: true },
                website: { type: String },
            },
            address: { type: String },
            country: { type: String, required: true },
            notes: { type: String },
            contactPersons: [
                {
                    firstName: { type: String },
                    lastName: { type: String },
                    designation: { type: String },
                    emails: [{ type: String }],
                    phones: [{ type: String }],
                },
            ],
            status: { type: String },
            owner: { type: Schema.Types.ObjectId, ref: 'User' },
            activities: [
                {
                    status: { type: String },
                    notes: { type: String },
                    nextAction: { type: String },
                    dueAt: { type: Date },
                    byUser: { type: Schema.Types.ObjectId, ref: 'User' },
                    at: { type: Date },
                },
            ],
        },
        originalCreatedAt: { type: Date, required: true },
        originalUpdatedAt: { type: Date, required: true },
        deletedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        deletedAt: { type: Date, default: Date.now, index: true },
        reason: { type: String },
    },
    { timestamps: true }
);

// Indexes for efficient querying
TrashedLeadSchema.index({ 'leadData.company.name': 1 });
TrashedLeadSchema.index({ 'leadData.country': 1 });

const TrashedLeadModel = model<ITrashedLead>('TrashedLead', TrashedLeadSchema);
export default TrashedLeadModel;
