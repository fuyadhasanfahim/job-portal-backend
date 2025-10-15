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
                'connected',
                'qualified',
                'notQualified',
                'callbackScheduled',
                'needsDecisionMaker',
                'sendInfo',
                'negotiation',
                'won',
                'lost',
                'noAnswer',
                'voicemailLeft',
                'busy',
                'switchedOff',
                'invalidNumber',
                'wrongPerson',
                'dnd',
                'followUpScheduled',
                'followUpOverdue',
                'unreachable',
                'duplicate',
                'archived',
            ],
            required: true,
        },
        nextAction: {
            type: String,
            enum: [
                'scheduleMeeting',
                'sendProposal',
                'followUp',
                'retry',
                'enrichContact',
                'markDnc',
                'closeLost',
            ],
        },
        dueAt: { type: Date },
        notes: { type: String },
        lostReason: {
            type: String,
            enum: [
                'noBudget',
                'notInterested',
                'timing',
                'competitor',
                'other',
            ],
        },
        attemptNumber: { type: Number },
        durationSec: { type: Number },
        contactedChannel: {
            type: String,
            enum: ['phone', 'sms', 'whatsapp', 'email'],
        },

        type: {
            type: String,
            enum: ['call', 'email', 'note', 'statusChange'],
            required: true,
        },
        content: { type: String },
        statusFrom: { type: String },
        statusTo: { type: String },

        byUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, default: Date.now, required: true },
        result: { type: String },
    },
    { _id: false },
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
