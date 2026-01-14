import { Schema, model } from 'mongoose';
import type {
    IActivity,
    ICompany,
    IContactPerson,
    IImportBatch,
    ILead,
} from '../types/lead.interface.js';

const CompanySchema = new Schema<ICompany>(
    {
        name: { type: String, required: true, trim: true },
        website: { type: String, trim: true },
    },
    { _id: false },
);

const ContactPersonSchema = new Schema<IContactPerson>(
    {
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        designation: { type: String, trim: true },
        emails: [{ type: String, trim: true }],
        phones: [{ type: String, trim: true }],
    },
    { _id: false },
);

const ActivitySchema = new Schema<IActivity>(
    {
        status: {
            type: String,
            enum: [
                'all',
                'new',
                'answering-machine',
                'interested',
                'not-interested',
                'test-trial',
                'call-back',
                'on-board',
                'language-barrier',
                'invalid-number',
            ],
            required: true,
            trim: true,
            default: 'new',
        },
        notes: { type: String, trim: true },
        nextAction: {
            type: String,
            enum: ['follow-up', 'send-proposal', 'call-back', 'close'],
            default: null,
        },
        dueAt: { type: Date, default: null },
        byUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, default: Date.now },
    },
    { _id: false },
);

const ImportBatchSchema = new Schema<IImportBatch>(
    {
        batchId: { type: String, required: true },
        importedAt: { type: Date, required: true },
        importedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        fileName: { type: String, trim: true },
        totalCount: { type: Number },
    },
    { _id: false },
);

const LeadSchema = new Schema<ILead>(
    {
        company: { type: CompanySchema, required: true },
        address: { type: String, trim: true },
        country: { type: String, required: true, trim: true },
        notes: { type: String, trim: true },
        contactPersons: { type: [ContactPersonSchema], required: true },
        status: {
            type: String,
            enum: [
                'all',
                'new',
                'answering-machine',
                'interested',
                'not-interested',
                'test-trial',
                'call-back',
                'on-board',
                'language-barrier',
                'invalid-number',
            ],
            default: 'new',
        },
        group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
        source: {
            type: String,
            enum: ['manual', 'imported', 'website'],
            default: 'manual',
        },
        importBatch: { type: ImportBatchSchema, default: null },
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        activities: [ActivitySchema],
        // Tracking fields for who created/updated the lead
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
);

// Index for faster filtering by source and importBatch
LeadSchema.index({ source: 1 });
LeadSchema.index({ 'importBatch.batchId': 1 });

const LeadModel = model<ILead>('Lead', LeadSchema);
export default LeadModel;
