import { z } from 'zod';

export const CompanyZ = z.object({
    name: z.string().min(1, 'Company name is required'),
    website: z
        .string()
        .url('Invalid website URL')
        .or(z.literal(''))
        .optional()
        .default(''),
});

export const ContactPersonZ = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    designation: z.string().optional(),
    emails: z
        .array(z.string().email('Invalid email'))
        .min(1, 'At least one email is required'),
    phones: z
        .array(z.string().min(7, 'Phone number too short'))
        .min(1, 'At least one phone number is required'),
});

export const ActivityZ = z.object({
    status: z.enum([
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
    ]),
    notes: z.string().optional(),
    nextAction: z
        .enum(['follow-up', 'send-proposal', 'call-back', 'close'])
        .optional(),
    dueAt: z.coerce.date().optional(),
    byUser: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ObjectId'),
    at: z.coerce.date().default(() => new Date()),
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
