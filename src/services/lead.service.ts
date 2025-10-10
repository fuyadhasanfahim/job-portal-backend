import LeadModel from '../models/lead.model.js';
import UserModel from '../models/user.model.js';
import LeadAssignmentModel from '../models/lead.assignment.model.js';
import type { ParsedRow } from '../helpers/fileParser.js';
import { emitImportProgress } from '../lib/socket.js';
import type { ILead, IncomingLead, NewLead } from '../types/lead.interface.js';
import { Types, type FilterQuery } from 'mongoose';
import type { MongoBulkWriteError, WriteError } from 'mongodb';

interface ImportResult {
    inserted: number;
    duplicates: number;
    errors: number;
    total: number;
}

interface CreateLeadsOptions {
    uploadId: string;
    chunkSize?: number;
}

interface GetLeadsOptions {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    country?: string;
    userId: string;
}

function mapRowToLead(row: ParsedRow, ownerId: string): NewLead {
    return {
        companyName: String(
            row['Agency Name'] || row['companyName'] || 'Unknown',
        ).trim(),
        websiteUrl:
            (row['Websites'] as string) || (row['websiteUrl'] as string) || '',
        emails: [row['Personal Email'], row['Email.'], row['emails']]
            .filter((e): e is string => Boolean(e))
            .map((e) => e.trim().toLowerCase()),
        phones: row['Phone Number'] ? [String(row['Phone Number']).trim()] : [],
        address: (row['address'] as string) || '',
        contactPerson: {
            firstName: String(
                row['First name'] ||
                    row['contactPerson.firstName'] ||
                    'Unknown',
            ).trim(),
            lastName: String(
                row['Last Name'] || row['contactPerson.lastName'] || 'Unknown',
            ).trim(),
        },
        designation: (row['Position'] as string) || '',
        country: (row['country'] as string) || 'Unknown',
        status: 'new',
        notes: [row['Social'], row['Unnamed: 7'], row['notes']]
            .filter(Boolean)
            .join(' '),
        owner: new Types.ObjectId(ownerId),
        accessList: [],
        activities: [],
    };
}

export async function getLeadsFromDB({
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    country,
    userId,
}: GetLeadsOptions) {
    const query: FilterQuery<ILead> = {};

    const user = await UserModel.findById(userId).lean();
    if (!user) throw new Error('User not found');

    // Restrict to only owner for non-admins
    if (user.role !== 'admin' && user.role !== 'super-admin') {
        query.owner = new Types.ObjectId(userId);
    }

    // Status filter (skip "all")
    if (status && status !== 'all') {
        query.status = status;
    }

    // Country filter (skip "all")
    if (country && country !== 'all') {
        query.country = { $regex: country, $options: 'i' };
    }

    // Search filter
    if (search && search.trim()) {
        const regex = new RegExp(search, 'i');
        const terms = search.trim().split(/\s+/);

        if (terms.length > 1) {
            query.$or = [
                { companyName: regex },
                { websiteUrl: regex },
                { emails: { $in: [regex] } },
                { phones: { $in: [regex] } },
                { notes: regex },
                {
                    $and: [
                        {
                            'contactPerson.firstName': new RegExp(
                                terms[0] ?? '',
                                'i',
                            ),
                        },
                        {
                            'contactPerson.lastName': new RegExp(
                                terms[1] ?? '',
                                'i',
                            ),
                        },
                    ],
                },
            ];
        } else {
            query.$or = [
                { companyName: regex },
                { websiteUrl: regex },
                { emails: { $in: [regex] } },
                { phones: { $in: [regex] } },
                { notes: regex },
                { 'contactPerson.firstName': regex },
                { 'contactPerson.lastName': regex },
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
                path: 'accessList.user',
                select: 'firstName lastName email image',
            })
            .lean(),
        LeadModel.countDocuments(query),
    ]);

    return {
        items,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getLeadByIdFromDB(id: string) {
    const lead = await LeadModel.findById(id).lean();
    console.log(lead);

    return lead;
}

export async function importLeadsInDB(
    ownerId: string,
    parsed: ParsedRow[],
    { uploadId, chunkSize = 500 }: CreateLeadsOptions,
): Promise<ImportResult> {
    const total = parsed.length;
    let processed = 0;
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    const candidates: NewLead[] = parsed.map((r) => mapRowToLead(r, ownerId));

    emitImportProgress(uploadId, {
        total,
        processed,
        percentage: 0,
        inserted,
        duplicates,
        errors,
        remaining: total,
        stage: 'deduping',
    });

    const allEmails = new Set<string>();
    const allPhones = new Set<string>();
    const allCompanies = new Set<string>();
    for (const c of candidates) {
        c.emails.forEach((e) => allEmails.add(e));
        c.phones.forEach((p) => allPhones.add(p));
        allCompanies.add(c.companyName);
    }

    const existing = await LeadModel.find(
        {
            owner: ownerId,
            $or: [
                ...(allEmails.size
                    ? [{ emails: { $in: Array.from(allEmails) } }]
                    : []),
                ...(allPhones.size
                    ? [{ phones: { $in: Array.from(allPhones) } }]
                    : []),
                ...(allCompanies.size
                    ? [{ companyName: { $in: Array.from(allCompanies) } }]
                    : []),
            ],
        },
        { emails: 1, phones: 1, companyName: 1 },
    ).lean();

    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    const existingCompanies = new Set<string>();
    for (const ex of existing) {
        (ex.emails ?? []).forEach((e: string) => existingEmails.add(e));
        (ex.phones ?? []).forEach((p: string) => existingPhones.add(p));
        if (ex.companyName) existingCompanies.add(String(ex.companyName));
    }

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const seenCompanies = new Set<string>();

    const toInsert: NewLead[] = [];
    for (const c of candidates) {
        const isDupCompany =
            c.companyName &&
            (existingCompanies.has(c.companyName) ||
                seenCompanies.has(c.companyName));
        const isDupEmail = c.emails.some(
            (e) => existingEmails.has(e) || seenEmails.has(e),
        );
        const isDupPhone = c.phones.some(
            (p) => existingPhones.has(p) || seenPhones.has(p),
        );

        if (isDupCompany || isDupEmail || isDupPhone) {
            duplicates++;
            continue;
        }

        if (c.companyName) seenCompanies.add(c.companyName);
        c.emails.forEach((e) => seenEmails.add(e));
        c.phones.forEach((p) => seenPhones.add(p));

        toInsert.push(c);
    }

    emitImportProgress(uploadId, {
        total,
        processed,
        percentage: 0,
        inserted,
        duplicates,
        errors,
        remaining: total,
        stage: 'inserting',
    });

    for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        try {
            const result = await LeadModel.insertMany(chunk, {
                ordered: false,
            });
            inserted += result.length;
        } catch (err) {
            if (err && typeof err === 'object' && 'writeErrors' in err) {
                const e = err as MongoBulkWriteError;
                const writeErrors: WriteError[] = Array.isArray(e.writeErrors)
                    ? e.writeErrors
                    : [e.writeErrors];
                errors += writeErrors.length;
                inserted += chunk.length - writeErrors.length;
            } else {
                errors += chunk.length;
            }
        }

        processed = Math.min(total, processed + chunk.length);
        const remaining = Math.max(0, total - processed);
        const percentage =
            total === 0 ? 100 : Math.round((processed / total) * 100);

        emitImportProgress(uploadId, {
            total,
            processed,
            percentage,
            inserted,
            duplicates,
            errors,
            remaining,
            stage: 'inserting',
        });
    }

    emitImportProgress(uploadId, {
        total,
        processed: total,
        percentage: 100,
        inserted,
        duplicates,
        errors,
        remaining: 0,
        stage: 'done',
    });

    return { inserted, duplicates, errors, total };
}

export async function newLeadsInDB(
    ownerId: string,
    lead: IncomingLead,
): Promise<{
    inserted: number;
    updated: number;
    duplicate: boolean;
    error: boolean;
}> {
    try {
        console.log(lead);

        const dbLead: NewLead = {
            companyName: lead.companyName?.trim(),
            websiteUrl: lead.websiteUrl?.trim() || '',
            emails: (lead.emails ?? []).map((e) => e.trim().toLowerCase()),
            phones: (lead.phones ?? []).map((p) => p.trim()),
            address: lead.address?.trim() || '',
            contactPerson: lead.contactPerson,
            designation: lead.designation?.trim() || '',
            country: lead.country?.trim() || '',
            notes: lead.notes?.trim() || '',
            status: 'new',
            owner: new Types.ObjectId(ownerId),
            accessList: [],
            activities: [],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const match: any = {
            owner: new Types.ObjectId(ownerId),
            $or: [
                { companyName: dbLead.companyName },
                ...(dbLead.emails.length > 0
                    ? [{ emails: { $in: dbLead.emails } }]
                    : []),
                ...(dbLead.phones.length > 0
                    ? [{ phones: { $in: dbLead.phones } }]
                    : []),
            ],
        };

        const result = await LeadModel.updateOne(
            match,
            { $set: dbLead },
            { upsert: true },
        );

        if (result.upsertedCount && result.upsertedCount > 0) {
            // New document created
            return { inserted: 1, updated: 0, duplicate: false, error: false };
        } else if (result.modifiedCount && result.modifiedCount > 0) {
            // Existing doc updated
            return { inserted: 0, updated: 1, duplicate: false, error: false };
        } else {
            // Nothing inserted/updated → duplicate
            return { inserted: 0, updated: 0, duplicate: true, error: false };
        }
    } catch (err) {
        console.error('Lead insert error:', err);
        return { inserted: 0, updated: 0, duplicate: false, error: true };
    }
}

export async function assignTelemarketerIntoDB({
    telemarketerId,
    assignedBy,
    leads,
    totalTarget,
    deadline,
}: {
    telemarketerId: string;
    assignedBy: string;
    leads: string[];
    totalTarget?: number;
    deadline?: Date;
}) {
    const existingLeads = await LeadModel.find({
        _id: { $in: leads.map((id) => new Types.ObjectId(id)) },
    });
    if (existingLeads.length !== leads.length) {
        throw new Error('Some leads do not exist');
    }

    await LeadModel.updateMany(
        { _id: { $in: leads } },
        {
            $addToSet: {
                accessList: {
                    user: new Types.ObjectId(telemarketerId),
                    role: 'editor',
                    grantedBy: new Types.ObjectId(assignedBy),
                    grantedAt: new Date(),
                },
            },
        },
    );

    const assignment = await LeadAssignmentModel.create({
        telemarketer: telemarketerId,
        assignedBy,
        leads,
        totalTarget,
        deadline,
        completedCount: 0,
        completedLeads: [],
        status: 'active',
    });

    return assignment;
}

export async function getAssignmentsForUserFromDB(
    userId: string,
    role?: string,
) {
    const query =
        role === 'admin' || role === 'super-admin'
            ? {}
            : { telemarketer: userId };

    return LeadAssignmentModel.find(query)
        .populate('leads')
        .populate('assignedBy', 'firstName lastName email');
}

export async function updateProgress(leadId: string, userId: string) {
    const assignment = await LeadAssignmentModel.findOne({
        telemarketer: userId,
        leads: leadId,
        status: 'active',
    });

    if (!assignment) return null;

    if (!assignment.completedLeads) assignment.completedLeads = [];
    if (assignment.completedLeads.includes(new Types.ObjectId(leadId)))
        return assignment;

    assignment.completedLeads.push(new Types.ObjectId(leadId));
    assignment.completedCount = assignment.completedLeads.length;

    if (
        assignment.totalTarget &&
        assignment.completedCount >= assignment.totalTarget
    ) {
        assignment.status = 'completed';
    }

    await assignment.save();
    return assignment;
}

export async function checkAndExpireAssignments() {
    const now = new Date();
    return LeadAssignmentModel.updateMany(
        { deadline: { $lt: now }, status: 'active' },
        { $set: { status: 'expired' } },
    );
}

export async function updateLeadStatusInDB({
    leadId,
    userId,
    status,
    note,
}: {
    leadId: string;
    userId: string;
    status: string;
    note?: string;
}) {
    const lead = await LeadModel.findById(leadId);
    if (!lead) throw new Error('Lead not found');

    lead.status = status as ILead['status'];

    lead.activities.push({
        type: 'status_change',
        content: `Status changed to ${status}`,
        byUser: new Types.ObjectId(userId),
        at: new Date(),
    });

    if (note) {
        lead.activities.push({
            type: 'note',
            content: note,
            byUser: new Types.ObjectId(userId),
            at: new Date(),
        });
    }

    await lead.save();
    await updateProgress(leadId, userId);

    return lead;
}
