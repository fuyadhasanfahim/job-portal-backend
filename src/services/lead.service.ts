import LeadModel from '../models/lead.model.js';
import UserModel from '../models/user.model.js';
import type {
    IActivity,
    ICompany,
    IContactPerson,
    ILead,
} from '../types/lead.interface.js';
import { Types, type FilterQuery } from 'mongoose';
import type {
    newLeadValidation,
    UpdateLeadInput,
} from '../validators/lead.validator.js';
import type z from 'zod';
import {
    parseContactPersons,
    parseEmails,
    parsePhones,
    type ImportResult,
    type ParsedRow,
} from '../helpers/fileParser.js';

async function getLeadsFromDB({
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    country,
    userId,
}: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    country?: string;
    userId: string;
}) {
    const query: FilterQuery<ILead> = {};

    const user = await UserModel.findById(userId).lean();

    if (!user) throw new Error('User not found');

    if (user.role !== 'admin' && user.role !== 'super-admin') {
        query.owner = new Types.ObjectId(userId);
    }

    if (status && status !== 'all') {
        query.status = status;
    }

    if (country && country !== 'all') {
        query.country = { $regex: country, $options: 'i' };
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        const terms = search.trim().split(/\s+/);

        if (terms.length > 1) {
            query.$or = [
                { 'company.name': regex },
                { 'company.website': regex },
                { 'company.emails': { $elemMatch: { $regex: regex } } },
                { 'company.phones': { $elemMatch: { $regex: regex } } },
                { notes: regex },
                {
                    $and: [
                        {
                            'contactPersons.firstName': new RegExp(
                                terms[0] as string,
                                'i',
                            ),
                        },
                        {
                            'contactPersons.lastName': new RegExp(
                                terms[1] as string,
                                'i',
                            ),
                        },
                    ],
                },
            ];
        } else {
            query.$or = [
                { 'company.name': regex },
                { 'company.website': regex },
                { 'company.emails': { $elemMatch: { $regex: regex } } },
                { 'company.phones': { $elemMatch: { $regex: regex } } },
                { notes: regex },
                { 'contactPersons.firstName': regex },
                { 'contactPersons.lastName': regex },
                { 'contactPersons.emails': { $elemMatch: { $regex: regex } } },
                { 'contactPersons.phones': { $elemMatch: { $regex: regex } } },
            ];
        }
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        LeadModel.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'owner',
                select: 'firstName lastName email role',
            })
            .populate({
                path: 'activities.byUser',
                select: 'firstName lastName email',
            })
            .lean(),

        LeadModel.countDocuments(query),
    ]);

    return {
        items,
        pagination: {
            totalItems: total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function getLeadsByDateFromDB({
    userId,
    page,
    limit,
    startOfDay,
    endOfDay,
}: {
    userId: string;
    page: number;
    limit: number;
    startOfDay: Date;
    endOfDay: Date;
}) {
    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const query: FilterQuery<ILead> = {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
    };

    if (user.role !== 'admin' && user.role !== 'super-admin') {
        query.owner = new Types.ObjectId(userId);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        LeadModel.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'owner',
                select: 'firstName lastName email role',
            })
            .populate({
                path: 'activities.byUser',
                select: 'firstName lastName email',
            })
            .lean(),
        LeadModel.countDocuments(query),
    ]);

    return {
        items,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        },
    };
}

async function getLeadByIdFromDB(id: string, userId: string, userRole: string) {
    const user = await UserModel.findById(userId).lean();

    if (!user) {
        throw new Error('User not found');
    }

    const lead = await LeadModel.findById(id)
        .populate({
            path: 'owner',
            select: 'firstName lastName email role',
        })
        .populate({
            path: 'activities.byUser',
            select: 'firstName lastName email',
        })
        .sort({ createdAt: -1 })
        .lean();

    if (!lead) {
        return null;
    }

    if (lead.activities) {
        lead.activities.sort(
            (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        );
    }

    const isAdmin = userRole === 'admin' || userRole === 'super-admin';

    const isOwner =
        lead.owner && lead.owner._id?.toString() === userId.toString();

    if (!isAdmin && !isOwner) {
        const err = new Error('Access forbidden') as Error & {
            status?: number;
        };
        err.status = 403;
        throw err;
    }

    return lead;
}

export async function newLeadsInDB(
    ownerId: string,
    lead: z.infer<typeof newLeadValidation>,
) {
    try {
        const dbLead: Partial<ILead> = {
            company: {
                name: lead.company.name.trim(),
                website: lead.company.website.trim(),
                emails: (lead.company.emails ?? []).map((e) =>
                    e.trim().toLowerCase(),
                ),
                phones: (lead.company.phones ?? []).map((p) => p.trim()),
            },
            address: lead.address?.trim() || '',
            country: lead.country.trim(),
            notes: lead.notes?.trim() || '',
            contactPersons: (lead.contactPersons ?? []).map((cp) => ({
                firstName: cp.firstName.trim(),
                lastName: cp.lastName?.trim() || '',
                designation: cp.designation?.trim() || '',
                emails: cp.emails.map((e) => e.trim().toLowerCase()),
                phones: cp.phones.map((p) => p.trim()),
            })),
            owner: new Types.ObjectId(ownerId),
        };

        const existingLead = await LeadModel.findOne({
            owner: new Types.ObjectId(ownerId),
            'company.name': dbLead.company?.name,
            'company.website': dbLead.company?.website,
        });

        if (existingLead) {
            return {
                duplicate: true,
                message:
                    'Duplicate lead found with same company name & website',
                lead: existingLead,
            };
        }

        const newLead = await LeadModel.create(dbLead);

        return {
            duplicate: false,
            message: 'Lead created successfully',
            lead: newLead,
        };
    } catch (err) {
        console.error('Lead insert error:', err);
        return {
            success: false,
            duplicate: false,
            message: 'Error creating lead',
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

async function updateLeadInDB(
    id: string,
    userId: string,
    role: string,
    updates: UpdateLeadInput,
) {
    const leadDoc = await LeadModel.findById(id);
    if (!leadDoc) throw new Error('Lead not found');

    const lead = leadDoc as typeof leadDoc & ILead;

    const isOwner = lead.owner.toString() === userId.toString();
    const isAdmin = ['admin', 'super-admin'].includes(role);
    if (!isOwner && !isAdmin) {
        const err = new Error(
            'Access forbidden: You cannot edit this lead',
        ) as Error & { status?: number };
        err.status = 403;
        throw err;
    }

    const changedFields: string[] = [];
    const oldLead = lead.toObject() as ILead;

    for (const key of Object.keys(updates) as (keyof UpdateLeadInput)[]) {
        const value = updates[key];
        if (value === undefined) continue;

        if (key === 'company' && value) {
            const newCompany = value as ICompany;
            const oldCompany = oldLead.company ?? ({} as ICompany);

            (Object.keys(newCompany) as (keyof ICompany)[]).forEach((ckey) => {
                const newVal = newCompany[ckey];
                const oldVal = oldCompany[ckey];

                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    changedFields.push(`company.${String(ckey)}`);
                    (lead.company as ICompany)[ckey] = newVal as never;
                }
            });
        } else if (key === 'contactPersons' && value) {
            const newContacts = value as IContactPerson[];
            if (
                JSON.stringify(oldLead.contactPersons) !==
                JSON.stringify(newContacts)
            ) {
                changedFields.push('contactPersons');
                lead.contactPersons = [...newContacts];
            }
        } else if (key === 'activities') {
            continue;
        } else {
            const oldVal = oldLead[key as keyof ILead];
            const newVal = value;
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changedFields.push(String(key));
                (lead as unknown as Record<string, unknown>)[key] = newVal;
            }
        }
    }

    if (changedFields.length > 0) {
        const activity: IActivity = {
            type: 'note',
            outcomeCode: 'archived',
            byUser: new Types.ObjectId(userId),
            at: new Date(),
            notes: `Fields updated: ${changedFields.join(', ')}`,
        };

        if (!Array.isArray(lead.activities)) lead.activities = [];
        lead.activities.push(activity);
    }

    await lead.save();
    return lead;
}

async function importLeadsFromData(
    rows: ParsedRow[],
    userId: string,
): Promise<ImportResult> {
    const result: ImportResult = {
        total: rows.length,
        successful: 0,
        failed: 0,
        errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        if (!row) {
            result.errors.push(`Row ${i + 2}: Empty or undefined row`);
            result.failed++;
            continue;
        }

        try {
            if (!row.companyName || !row.country) {
                result.errors.push(
                    `Row ${rowNumber}: Missing required fields (companyName and country are required)`,
                );
                result.failed++;
                continue;
            }

            const company = {
                name: String(row.companyName || ''),
                website: String(row.website || ''),
                emails: await parseEmails(row.emails),
                phones: await parsePhones(row.phones),
            };

            const contactPersons = await parseContactPersons(row);

            if (contactPersons.length === 0) {
                result.errors.push(
                    `Row ${rowNumber}: At least one contact person with email or phone is required`,
                );
                result.failed++;
                continue;
            }

            const leadData = {
                company,
                address: row.address ? String(row.address) : undefined,
                country: String(row.country),
                notes: row.notes ? String(row.notes) : undefined,
                contactPersons,
                status: (row.status as ILead['status']) || 'new',
                owner: new Types.ObjectId(userId),
                activities: [
                    {
                        type: 'note' as const,
                        outcomeCode: 'archived' as const,
                        byUser: new Types.ObjectId(userId),
                        at: new Date(),
                        notes: 'Lead imported via bulk upload',
                    },
                ],
            };

            const existingLead = await LeadModel.findOne({
                'company.name': company.name,
                country: leadData.country,
                owner: userId,
            });

            if (existingLead) {
                result.errors.push(
                    `Row ${rowNumber}: Lead already exists for company "${company.name}" in ${leadData.country}`,
                );
                result.failed++;
                continue;
            }

            await LeadModel.create(leadData);
            result.successful++;
        } catch (error) {
            result.errors.push(
                `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            result.failed++;
        }
    }

    return result;
}

const LeadService = {
    newLeadsInDB,
    getLeadsFromDB,
    getLeadsByDateFromDB,
    getLeadByIdFromDB,
    updateLeadInDB,
    importLeadsFromData,
};
export default LeadService;
