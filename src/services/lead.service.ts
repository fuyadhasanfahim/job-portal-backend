import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import LeadModel from '../models/lead.model.js';

interface ImportResult {
    inserted: number;
    skipped: number;
    errors: number;
}

export async function importCSV(
    filePath: string,
    ownerId: string,
): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const leadsBatch: any[] = [];
        let inserted = 0;
        const skipped = 0;
        let errors = 0;

        const stream = fs.createReadStream(filePath).pipe(csv());

        stream.on('data', async (row) => {
            leadsBatch.push({
                companyName: row.companyName,
                websiteUrl: row.websiteUrl,
                email: row.email ? row.email.split(',') : [],
                address: row.address,
                contactPerson: {
                    firstName: row.firstName || '',
                    lastName: row.lastName || '',
                },
                designation: row.designation,
                phone: row.phone ? row.phone.split(',') : [],
                country: row.country,
                notes: row.notes,
                owner: ownerId,
            });

            // Insert in chunks of 1000
            if (leadsBatch.length >= 1000) {
                try {
                    const res = await LeadModel.insertMany(leadsBatch, {
                        ordered: false,
                    });
                    inserted += res.length;
                    leadsBatch.length = 0;
                } catch {
                    errors++;
                }
            }
        });

        stream.on('end', async () => {
            if (leadsBatch.length > 0) {
                try {
                    const res = await LeadModel.insertMany(leadsBatch, {
                        ordered: false,
                    });
                    inserted += res.length;
                } catch {
                    errors++;
                }
            }
            fs.unlinkSync(filePath); // cleanup temp file
            resolve({ inserted, skipped, errors });
        });

        stream.on('error', (err: Error) => reject(err));
    });
}

export async function importExcel(
    filePath: string,
    ownerId: string,
): Promise<ImportResult> {
    const workbook = xlsx.readFile(filePath);
    const firstSheetName =
        workbook.SheetNames && workbook.SheetNames.length > 0
            ? workbook.SheetNames[0]
            : undefined;
    if (!firstSheetName) {
        throw new Error('No sheets found in the Excel file.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
        throw new Error('Sheet not found in the Excel file.');
    }
    const rows = xlsx.utils.sheet_to_json(sheet);

    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += 1000) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batch = rows.slice(i, i + 1000).map((row: any) => ({
            companyName: row.companyName,
            websiteUrl: row.websiteUrl,
            email: row.email ? String(row.email).split(',') : [],
            address: row.address,
            contactPerson: {
                firstName: row.firstName || '',
                lastName: row.lastName || '',
            },
            designation: row.designation,
            phone: row.phone ? String(row.phone).split(',') : [],
            country: row.country,
            notes: row.notes,
            owner: ownerId,
        }));

        try {
            const res = await LeadModel.insertMany(batch, { ordered: false });
            inserted += res.length;
        } catch {
            errors++;
        }
    }

    fs.unlinkSync(filePath);
    return { inserted, skipped: 0, errors };
}
