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
