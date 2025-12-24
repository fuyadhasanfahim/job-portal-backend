import { Schema, model } from 'mongoose';
import type {
    IActivity,
    ICompany,
    IContactPerson,
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
        emails: [{ type: String, required: true, trim: true }],
        phones: [{ type: String, required: true, trim: true }],
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
                'busy',
                'answering-machine',
                'interested',
                'not-interested',
                'test-trial',
                'call-back',
                'on-board',
                'no-answer',
                'email/whatsApp-sent',
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
                'busy',
                'answering-machine',
                'interested',
                'not-interested',
                'test-trial',
                'call-back',
                'on-board',
                'no-answer',
                'email/whatsApp-sent',
                'language-barrier',
                'invalid-number',
            ],
            default: 'new',
        },
        group: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        activities: [ActivitySchema],
    },
    { timestamps: true },
);

const LeadModel = model<ILead>('Lead', LeadSchema);
export default LeadModel;
