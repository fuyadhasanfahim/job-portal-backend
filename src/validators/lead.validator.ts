import { z } from 'zod';

export const CompanyZ = z.object({
    name: z.string().min(1, 'Company name is required'),
    website: z.url('Invalid website URL').or(z.literal('')),
});

export const ContactPersonZ = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    designation: z.string().optional(),
    emails: z
        .array(z.email('Invalid email'))
        .min(1, 'At least one email required'),
    phones: z
        .array(z.string().min(7, 'Phone number too short'))
        .min(1, 'At least one phone required'),
});

export const ActivityZ = z.object({
    outcomeCode: z.enum([
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
    ]),
    nextAction: z
        .enum([
            'scheduleMeeting',
            'sendProposal',
            'followUp',
            'retry',
            'enrichContact',
            'markDnc',
            'closeLost',
        ])
        .optional(),
    dueAt: z.coerce.date().optional(),
    notes: z.string().optional(),
    lostReason: z
        .enum(['noBudget', 'notInterested', 'timing', 'competitor', 'other'])
        .optional(),
    attemptNumber: z.number().optional(),
    durationSec: z.number().optional(),
    contactedChannel: z.enum(['phone', 'sms', 'whatsapp', 'email']).optional(),
    type: z.enum(['call', 'email', 'note', 'statusChange']),
    content: z.string().optional(),
    statusFrom: z.string().optional(),
    statusTo: z.string().optional(),
    byUser: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ObjectId'),
    at: z.coerce.date().default(() => new Date()),
    result: z.string().optional(),
});

export const newLeadValidation = z.object({
    company: CompanyZ,
    address: z.string().optional(),
    country: z.string().min(1, 'Country is required'),
    notes: z.string().optional(),
    contactPersons: z
        .array(ContactPersonZ)
        .min(1, 'At least one contact person is required'),
});

export const updateLeadValidation = z.object({
    company: CompanyZ.optional(),
    address: z.string().optional(),
    country: z.string().min(1, 'Country is required').optional(),
    notes: z.string().optional(),
    contactPersons: z.array(ContactPersonZ).optional(),
    status: z
        .enum([
            'new',
            'contacted',
            'responded',
            'qualified',
            'meetingScheduled',
            'proposal',
            'won',
            'lost',
            'onHold',
        ])
        .optional(),
    owner: z.string().optional(),
    activities: z.array(ActivityZ).optional(),
});

export type NewLeadInput = z.infer<typeof newLeadValidation>;
export type UpdateLeadInput = z.infer<typeof updateLeadValidation>;
export type CompanyInput = z.infer<typeof CompanyZ>;
export type ContactPersonInput = z.infer<typeof ContactPersonZ>;
export type ActivityInput = z.infer<typeof ActivityZ>;
