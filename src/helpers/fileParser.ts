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

export interface ImportErrorRow {
    rowNumber: number;
    companyName: string | undefined;
    website: string | undefined;
    contactEmail: string | undefined;
    country: string | undefined;
    errorType: 'validation' | 'duplicate' | 'processing';
    errorMessage: string;
}

export interface ImportResult {
    total: number;
    successful: number; // New leads created
    merged: number; // Contacts merged into existing leads
    duplicatesInFile: number; // Duplicate rows within the file itself (same company)
    duplicatesInDb: number; // Leads that already existed in DB with no new contacts
    failed: number; // Rows with errors
    errors: string[];
    errorRows: ImportErrorRow[];
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

    // Secondary contact from contact2 columns
    if (row.contact2FirstName || row.contact2Email || row.contact2Phone) {
        const [emails, phones] = await Promise.all([
            parseEmails(row.contact2Email),
            parsePhones(row.contact2Phone),
        ]);

        // Only add if we have at least some contact info
        if (emails.length > 0 || phones.length > 0 || row.contact2FirstName) {
            contactPersons.push({
                firstName: row.contact2FirstName
                    ? String(row.contact2FirstName)
                    : undefined,
                emails,
                phones,
            } as IContactPerson);
        }
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

// Schema validation types
export interface SchemaValidationError {
    type: 'missing_required' | 'missing_contact' | 'invalid_column';
    column?: string;
    message: string;
}

export interface SchemaValidationResult {
    valid: boolean;
    errors: SchemaValidationError[];
    warnings: string[];
    detectedColumns: string[];
    expectedColumns: {
        required: string[];
        contactRequired: string[];
        optional: string[];
    };
}

// Required columns for lead import
const REQUIRED_COLUMNS = ['companyName', 'country'];
// Contact columns are now fully optional
const OPTIONAL_COLUMNS = [
    'website',
    'address',
    'notes',
    'status',
    'contactFirstName',
    'contactLastName',
    'contactDesignation',
    'contactEmail',
    'contactPhone',
    'additionalContacts',
];

/**
 * Validates if the parsed file has the required columns for lead import
 */
export function validateImportSchema(
    rows: ParsedRow[],
): SchemaValidationResult {
    const result: SchemaValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        detectedColumns: [],
        expectedColumns: {
            required: REQUIRED_COLUMNS,
            contactRequired: [], // Contact info is now optional
            optional: OPTIONAL_COLUMNS,
        },
    };

    if (rows.length === 0) {
        result.valid = false;
        result.errors.push({
            type: 'missing_required',
            message: 'The file is empty or has no data rows.',
        });
        return result;
    }

    // Get columns from first row
    const firstRow = rows[0];
    if (!firstRow) {
        result.valid = false;
        result.errors.push({
            type: 'missing_required',
            message: 'Could not read file headers.',
        });
        return result;
    }

    const detectedColumns = Object.keys(firstRow);
    result.detectedColumns = detectedColumns;

    // Normalize column names for comparison (case-insensitive, trim whitespace)
    const normalizedColumns = detectedColumns.map((col) =>
        col.toLowerCase().trim().replace(/\s+/g, ''),
    );

    // Check required columns
    for (const required of REQUIRED_COLUMNS) {
        const normalizedRequired = required.toLowerCase();
        if (!normalizedColumns.includes(normalizedRequired)) {
            result.valid = false;
            result.errors.push({
                type: 'missing_required',
                column: required,
                message: `Missing required column: "${required}"`,
            });
        }
    }

    // Contact columns are now optional - no validation required

    // Check for unknown columns (warnings only)
    const allKnownColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(
        (c) => c.toLowerCase(),
    );

    for (const col of detectedColumns) {
        const normalizedCol = col.toLowerCase().trim().replace(/\s+/g, '');
        if (!allKnownColumns.includes(normalizedCol)) {
            result.warnings.push(
                `Unknown column "${col}" will be ignored during import.`,
            );
        }
    }

    return result;
}

/**
 * Validates individual row data
 */
export interface RowValidationError {
    row: number;
    field: string;
    message: string;
}

export interface RowValidationOptions {
    requireEmail?: boolean;
    requirePhone?: boolean;
}

export function validateRowData(
    row: ParsedRow,
    rowIndex: number,
    options: RowValidationOptions = {},
): RowValidationError[] {
    const errors: RowValidationError[] = [];
    const rowNumber = rowIndex + 2; // +2 because index is 0-based and we skip header row
    const { requireEmail = false, requirePhone = false } = options;

    // Check required fields have values
    if (!row.companyName || String(row.companyName).trim() === '') {
        errors.push({
            row: rowNumber,
            field: 'companyName',
            message: `Row ${rowNumber}: Company name is required`,
        });
    }

    if (!row.country || String(row.country).trim() === '') {
        errors.push({
            row: rowNumber,
            field: 'country',
            message: `Row ${rowNumber}: Country is required`,
        });
    }

    // Check contact info based on options
    const hasEmail = row.contactEmail && String(row.contactEmail).trim() !== '';
    const hasPhone = row.contactPhone && String(row.contactPhone).trim() !== '';

    if (requireEmail && !hasEmail) {
        errors.push({
            row: rowNumber,
            field: 'contactEmail',
            message: `Row ${rowNumber}: Email is required`,
        });
    }

    if (requirePhone && !hasPhone) {
        errors.push({
            row: rowNumber,
            field: 'contactPhone',
            message: `Row ${rowNumber}: Phone is required`,
        });
    }

    return errors;
}
