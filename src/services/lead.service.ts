import { Types, type FilterQuery } from 'mongoose';
import LeadModel from '../models/lead.model.js';
import UserModel from '../models/user.model.js';
import type {
    IActivity,
    ICompany,
    IContactPerson,
    ILead,
} from '../types/lead.interface.js';
import type {
    newLeadValidation,
    UpdateLeadInput,
} from '../validators/lead.validator.js';
import type z from 'zod';
import {
    parseContactPersons,
    type ImportResult,
    type ParsedRow,
} from '../helpers/fileParser.js';
import TaskModel from '../models/task.model.js';
import { createLog } from '../utils/logger.js';

async function getLeadsFromDB({
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    country,
    userId,
    date,
    selectedUserId,
}: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    country?: string;
    userId: string;
    date?: string | Date;
    selectedUserId?: string;
}) {
    const query: FilterQuery<ILead> = {};

    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error('User not found');

    if (
        (user.role === 'admin' || user.role === 'super-admin') &&
        selectedUserId &&
        selectedUserId !== 'all-user'
    ) {
        query.owner = new Types.ObjectId(selectedUserId);
    } else if (user.role !== 'admin' && user.role !== 'super-admin') {
        query.owner = new Types.ObjectId(userId);
    }

    if (status && status !== 'all') {
        query.status = status;
    }

    if (date) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: dayStart, $lte: dayEnd };
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

    for (const lead of items) {
        if (Array.isArray(lead.activities)) {
            lead.activities.sort(
                (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
            );
        }
    }

    await createLog({
        userId,
        action: 'fetch_leads_list',
        entityType: 'lead',
        description: `Fetched leads (filters: ${JSON.stringify({
            status,
            search,
            country,
            date,
            selectedUserId,
        })})`,
    });

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

    await createLog({
        userId,
        action: 'fetch_leads_by_date',
        entityType: 'lead',
        description: `Fetched leads created between ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`,
    });

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
    if (!user) throw new Error('User not found');

    const lead = await LeadModel.findById(id)
        .populate({
            path: 'owner',
            select: 'firstName lastName email role',
        })
        .populate({
            path: 'activities.byUser',
            select: 'firstName lastName email',
        })
        .lean();

    if (!lead) return null;

    if (lead.activities) {
        lead.activities.sort(
            (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        );
    }

    const isAdmin = userRole === 'admin' || userRole === 'super-admin';
    const isOwner = lead.owner && lead.owner._id?.toString() === userId;

    if (!isAdmin && !isOwner) {
        const err = new Error('Access forbidden') as Error & {
            status?: number;
        };
        err.status = 403;
        throw err;
    }

    await createLog({
        userId,
        action: 'view_lead_details',
        entityType: 'lead',
        entityId: id,
        description: `User ${user.email} viewed lead "${lead.company?.name}"`,
    });

    return lead;
}

async function newLeadsInDB(
    ownerId: string,
    lead: z.infer<typeof newLeadValidation>,
) {
    try {
        const dbLead: Partial<ILead> = {
            company: {
                name: lead.company.name.trim(),
                website: lead.company.website?.trim() || '',
            },
            address: lead.address?.trim() || '',
            country: lead.country.trim(),
            notes: lead.notes?.trim() || '',
            contactPersons: (lead.contactPersons ?? []).map((cp) => ({
                firstName: cp.firstName?.trim() || '',
                lastName: cp.lastName?.trim() || '',
                designation: cp.designation?.trim() || '',
                emails: cp.emails.map((e) => e.trim().toLowerCase()),
                phones: cp.phones.map((p) => p.trim()),
            })),
            status: lead.status,
            activities: (lead.activities ?? []).map((activity) => ({
                status: lead.status,
                notes: lead.notes?.trim() || '',
                nextAction: activity.nextAction ?? undefined,
                dueAt: activity.dueAt,
                byUser: new Types.ObjectId(ownerId),
                at: activity.at || new Date(),
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
                success: true,
                duplicate: true,
                message:
                    'Duplicate lead found with same company name & website',
                lead: existingLead,
            };
        }

        const newLead = await LeadModel.create({
            ...dbLead,
            activities:
                dbLead.activities && dbLead.activities.length > 0
                    ? dbLead.activities
                    : [
                          {
                              status: 'new',
                              notes: 'Lead created',
                              byUser: new Types.ObjectId(ownerId),
                              at: new Date(),
                          },
                      ],
        });

        await createLog({
            userId: ownerId,
            action: 'create_lead',
            entityType: 'lead',
            entityId: newLead._id as string,
            description: `Lead "${lead.company.name}" created with status "${lead.status}".`,
            data: { country: lead.country, status: lead.status },
        });

        const system = await UserModel.findOne({
            email: 'system@webbriks.com',
        });

        if (lead.status !== 'new' && system) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const existingTask = await TaskModel.findOne({
                assignedTo: new Types.ObjectId(ownerId),
                createdBy: new Types.ObjectId(system._id),
                type: 'cold_call',
                createdAt: { $gte: startOfDay, $lte: endOfDay },
            });

            if (existingTask) {
                const newLeadId = newLead._id as Types.ObjectId;
                existingTask.leads = existingTask.leads ?? [];
                if (
                    !existingTask.leads.some((id: unknown) =>
                        (id as Types.ObjectId).equals(newLeadId),
                    )
                ) {
                    (existingTask.leads as Types.ObjectId[]).push(newLeadId);
                }

                const totalLeads = existingTask.leads.length;
                existingTask.metrics = { done: totalLeads, total: totalLeads };
                existingTask.progress = 100;

                await existingTask.save();

                await createLog({
                    userId: system._id.toString(),
                    action: 'system_task_update',
                    entityType: 'task',
                    entityId: existingTask._id as string,
                    description: `Added new lead "${lead.company.name}" to today's system task.`,
                    data: { ownerId, leadId: newLead._id as string },
                });
            } else {
                const task = await TaskModel.create({
                    title: `System Task: ${new Date().toLocaleDateString()}`,
                    description: `Auto-created task for leads created today with non-"new" status.`,
                    type: 'cold_call',
                    createdBy: new Types.ObjectId(system._id),
                    assignedTo: new Types.ObjectId(ownerId),
                    status: 'in_progress',
                    leads: [newLead._id],
                    progress: 100,
                    metrics: { done: 1, total: 1 },
                });

                await createLog({
                    userId: system._id.toString(),
                    action: 'system_task_create',
                    entityType: 'task',
                    entityId: task._id as string,
                    description: `Created a new daily system task for user ${ownerId}.`,
                });
            }
        }

        return {
            duplicate: false,
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
            status: lead.status,
            byUser: new Types.ObjectId(userId),
            at: new Date(),
            notes: `Fields updated: ${changedFields.join(', ')}`,
        };

        if (!Array.isArray(lead.activities)) lead.activities = [];
        lead.activities.push(activity);
    }

    await lead.save();

    await createLog({
        userId,
        action: 'update_lead',
        entityType: 'lead',
        entityId: id,
        description: `Lead "${lead.company?.name}" updated. Fields changed: ${changedFields.join(', ')}`,
        data: { changedFields },
    });

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

        try {
            if (!row?.companyName || !row.country) {
                result.errors.push(
                    `Row ${rowNumber}: Missing required fields (companyName and country)`,
                );
                result.failed++;
                continue;
            }

            const company = {
                name: String(row.companyName || ''),
                website: String(row.website || ''),
            };

            const contactPersons = await parseContactPersons(row);
            if (contactPersons.length === 0) {
                result.errors.push(
                    `Row ${rowNumber}: No valid contact persons found.`,
                );
                result.failed++;
                continue;
            }

            const leadData: Partial<ILead> = {
                company,
                address: row.address ? String(row.address) : '',
                country: String(row.country),
                notes: row.notes ? String(row.notes) : '',
                contactPersons,
                status: (row.status as ILead['status']) || 'new',
                owner: new Types.ObjectId(userId),
                activities: [
                    {
                        status: 'new',
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
                `Row ${rowNumber}: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
            );
            result.failed++;
        }
    }

    await createLog({
        userId,
        action: 'bulk_import_leads',
        entityType: 'lead',
        description: `Bulk imported ${result.successful}/${result.total} leads.`,
        data: result,
    });

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
