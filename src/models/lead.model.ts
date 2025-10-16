import { Schema, model } from 'mongoose';
import type {
    IActivity,
    ICompany,
    IContactPerson,
    ILead,
} from '../types/lead.interface.js';

const CompanySchema = new Schema<ICompany>({
    name: { type: String, required: true },
    website: { type: String, required: true },
});

const ContactPersonSchema = new Schema<IContactPerson>({
    firstName: { type: String },
    lastName: { type: String },
    designation: { type: String },
    emails: [{ type: String, required: true }],
    phones: [{ type: String, required: true }],
});

const ActivitySchema = new Schema<IActivity>(
    {
        outcomeCode: {
            type: String,
            enum: [
                'interestedInfo',
                'interestedQuotation',
                'noAnswer',
                'notInterestedNow',
                'invalidNumber',
                'existingClientFollowUp',
                'systemUpdate',
            ],
            required: true,
            trim: true,
        },

        nextAction: {
            type: String,
            enum: [
                'sendProposal',
                'followUp',
                'retry',
                'enrichContact',
                'scheduleMeeting',
                'closeLost',
            ],
            default: null,
        },

        dueAt: { type: Date, default: null },

        notes: { type: String, trim: true },

        lostReason: {
            type: String,
            enum: [
                'noBudget',
                'notInterested',
                'timing',
                'competitor',
                'other',
            ],
            default: null,
        },

        attemptNumber: { type: Number, default: 1 },

        durationSec: { type: Number, default: 0 },

        contactedChannel: {
            type: String,
            enum: ['phone', 'sms', 'whatsapp', 'email'],
            default: 'phone',
        },

        type: {
            type: String,
            enum: ['call', 'email', 'note', 'statusChange'],
            required: true,
            default: 'call',
        },

        content: { type: String, trim: true },

        statusFrom: { type: String, trim: true },
        statusTo: { type: String, trim: true },

        byUser: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        at: {
            type: Date,
            default: Date.now,
            required: true,
        },

        result: { type: String, trim: true },
    },
    {
        _id: false,
        timestamps: false,
    },
);

const LeadSchema = new Schema<ILead>(
    {
        company: { type: CompanySchema, required: true },
        address: { type: String },
        country: { type: String, required: true },
        notes: { type: String },
        contactPersons: { type: [ContactPersonSchema], required: true },
        status: {
            type: String,
            enum: [
                'new',
                'contacted',
                'responded',
                'qualified',
                'meetingScheduled',
                'proposal',
                'won',
                'lost',
                'onHold',
            ],
            default: 'new',
        },
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        activities: [ActivitySchema],
    },
    { timestamps: true },
);

const LeadModel = model<ILead>('Lead', LeadSchema);
export default LeadModel;
