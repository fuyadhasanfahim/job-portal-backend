import LeadModel from '../models/lead.model.js';
import type { ParsedRow } from '../helpers/fileParser.js';
import { emitImportProgress } from '../lib/socket.js';
import type { ILead, IncomingLead, NewLead } from '../types/lead.interface.js';
import { Types, type FilterQuery } from 'mongoose';
import UserModel from '../models/user.model.js';
import type { MongoBulkWriteError, WriteError } from 'mongodb';
import { v4 as uuid } from 'uuid';

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

interface BulkCreateResult {
    inserted: number;
    updated: number;
    duplicates: number;
    errors: number;
    total: number;
}

function mapRowToLead(row: ParsedRow, ownerId: string): NewLead {
    return {
        rowId: new Types.ObjectId().toString(),
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
    if (!user) {
        throw new Error('User not found');
    }

    if (user.role !== 'admin' && user.role !== 'super-admin') {
        query.owner = userId;
    }

    if (status && status !== 'all') {
        query.status = status;
    }

    if (country) {
        query.country = { $regex: country, $options: 'i' };
    }

    if (search && search.trim()) {
        const regex = new RegExp(search, 'i');
        const terms = search.trim().split(/\s+/);

        if (terms.length > 1) {
            query.$or = [
                { companyName: regex },
                { websiteUrl: regex },
                { emails: regex },
                { phones: regex },
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
                { emails: regex },
                { phones: regex },
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
                inserted += toInsert.length - writeErrors.length;
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

async function mapToDBLead(
    ownerId: string,
    lead: IncomingLead,
): Promise<NewLead> {
    const adminUsers = await UserModel.find(
        { role: { $in: ['admin', 'super-admin'] } },
        '_id',
    ).lean();

    return {
        rowId: lead.rowId || uuid(),
        companyName: lead.companyName?.trim() || 'Unknown',
        websiteUrl: lead.websiteUrl?.trim() || '',
        emails: (lead.emails ?? []).map((e) => e.trim().toLowerCase()),
        phones: (lead.phones ?? []).map((p) => p.trim()),
        address: lead.address?.trim() || '',
        contactPerson: {
            firstName: lead.firstName?.trim() || 'Unknown',
            lastName: lead.lastName?.trim() || 'Unknown',
        },
        designation: lead.designation?.trim() || '',
        country: lead.country?.trim() || '',
        notes: lead.notes?.trim() || '',

        status: 'new',
        owner: new Types.ObjectId(ownerId),

        accessList: adminUsers.map((u) => ({
            user: u._id as Types.ObjectId,
            role: 'editor',
            grantedBy: new Types.ObjectId(ownerId),
            grantedAt: new Date(),
        })),

        activities: [],
    };
}

export async function bulkCreateLeadsInDB(
    ownerId: string,
    leads: IncomingLead[],
): Promise<BulkCreateResult> {
    const total = leads.length;
    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let errors = 0;

    for (const lead of leads) {
        try {
            const dbLead = await mapToDBLead(ownerId, lead);

            const match = {
                owner: new Types.ObjectId(ownerId),
                ...(dbLead.rowId
                    ? { rowId: dbLead.rowId }
                    : {
                          $or: [
                              { companyName: dbLead.companyName },
                              ...(dbLead.emails.length > 0
                                  ? [{ emails: { $in: dbLead.emails } }]
                                  : []),
                              ...(dbLead.phones.length > 0
                                  ? [{ phones: { $in: dbLead.phones } }]
                                  : []),
                          ],
                      }),
            };

            const result = await LeadModel.updateOne(
                match,
                { $set: dbLead },
                { upsert: true },
            );

            if (result.upsertedCount && result.upsertedCount > 0) {
                inserted++;
            } else if (result.modifiedCount && result.modifiedCount > 0) {
                updated++;
            } else {
                duplicates++;
            }
        } catch (err) {
            console.error('Lead upsert error:', err);
            errors++;
        }
    }

    return { inserted, updated, duplicates, errors, total };
}
