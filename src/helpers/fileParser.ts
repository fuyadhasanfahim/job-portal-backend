import fs from 'fs';
import csv from 'csv-parser';
import xlsx from 'xlsx';

export type ParsedRow = Record<string, string | number | undefined>;

export async function parseCSV(filePath: string): Promise<ParsedRow[]> {
    return new Promise((resolve, reject) => {
        const rows: ParsedRow[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: ParsedRow) => rows.push(row))
            .on('end', () => {
                fs.unlinkSync(filePath);
                resolve(rows);
            })
            .on('error', (err: unknown) => reject(err));
    });
}

export async function parseExcel(filePath: string): Promise<ParsedRow[]> {
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('No sheet found in Excel file');

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) throw new Error('No sheet found in Excel file');

    const rows = xlsx.utils.sheet_to_json<ParsedRow>(sheet);
    fs.unlinkSync(filePath);
    return rows;
}

export interface ImportResult {
    total: number;
    successful: number;
    failed: number;
    errors: string[];
}

export async function parseEmails(
    emails: string | number | undefined,
): Promise<string[]> {
    if (!emails) return [];

    const emailString = String(emails);
    const parsedEmails = emailString
        .split(/[,;]/)
        .map((email) => email.trim())
        .filter((email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return email && emailRegex.test(email);
        });

    return parsedEmails;
}

export async function parsePhones(
    phones: string | number | undefined,
): Promise<string[]> {
    if (!phones) return [];

    const phoneString = String(phones);
    const parsedPhones = phoneString
        .split(/[,;]/)
        .map((phone) => phone.trim().replace(/\s+/g, ''))
        .filter((phone) => phone && phone.length >= 7);

    return parsedPhones;
}

interface IContactPerson {
    firstName?: string;
    lastName?: string;
    designation?: string;
    emails: string[];
    phones: string[];
}

export async function parseContactPersons(
    row: ParsedRow,
): Promise<IContactPerson[]> {
    const contactPersons: IContactPerson[] = [];

    // Primary contact from individual columns
    if (row.contactFirstName || row.contactEmail || row.contactPhone) {
        const [emails, phones] = await Promise.all([
            parseEmails(row.contactEmail),
            parsePhones(row.contactPhone),
        ]);

        contactPersons.push({
            firstName: row.contactFirstName
                ? String(row.contactFirstName)
                : undefined,
            lastName: row.contactLastName
                ? String(row.contactLastName)
                : undefined,
            designation: row.contactDesignation
                ? String(row.contactDesignation)
                : undefined,
            emails,
            phones,
        } as IContactPerson);
    }

    if (row.additionalContacts) {
        const additionalContacts = String(row.additionalContacts)
            .split(';')
            .filter(Boolean);

        const additionalContactPromises = additionalContacts.map(
            async (contactStr) => {
                const parts = contactStr.split(',').map((part) => part.trim());
                if (parts.length >= 3) {
                    const [firstName, email, phone] = parts;
                    const [emails, phones] = await Promise.all([
                        parseEmails(email),
                        parsePhones(phone),
                    ]);

                    if (emails.length > 0 || phones.length > 0) {
                        return {
                            firstName: firstName as string,
                            emails,
                            phones,
                        } satisfies IContactPerson;
                    }
                }
                return null;
            },
        );

        const additionalContactsResult = await Promise.all(
            additionalContactPromises,
        );
        additionalContactsResult.forEach((contact) => {
            if (contact) {
                contactPersons.push(contact as IContactPerson);
            }
        });
    }

    return contactPersons;
}
