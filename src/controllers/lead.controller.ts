import { type Request, type Response } from 'express';
import LeadService from '../services/lead.service.js';
import {
    newLeadValidation,
    updateLeadValidation,
} from '../validators/lead.validator.js';
import z from 'zod';
import {
    parseCSV,
    parseExcel,
    validateImportSchema,
    validateRowData,
    type ParsedRow,
    type SchemaValidationResult,
    type RowValidationError,
} from '../helpers/fileParser.js';

async function getLeads(req: Request, res: Response) {
    try {
        const {
            page = '1',
            limit = '10',
            search = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            country = '',
            date = '',
            selectedUserId,
            group = '',
            source = '',
            importBatchId = '',
            contactFilter = 'all',
            dueDate = '',
        } = req.query as {
            page: string;
            limit: string;
            search: string;
            status: string;
            sortBy: string;
            sortOrder: string;
            country: string;
            outcome: string;
            date: string;
            selectedUserId: string;
            group: string;
            source: string;
            importBatchId: string;
            contactFilter: 'all' | 'email-only' | 'phone-only';
            dueDate: string;
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Missing user authentication',
            });
        }

        const filters: Record<string, string> = {};
        if (search.trim()) filters.search = search.trim();
        if (status.trim()) filters.status = status.trim();
        if (country.trim()) filters.country = country.trim();
        if (source.trim()) filters.source = source.trim();
        if (importBatchId.trim()) filters.importBatchId = importBatchId.trim();

        const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
        const validSortBy = [
            'createdAt',
            'company.name',
            'status',
            'country',
        ].includes(sortBy)
            ? sortBy
            : 'createdAt';

        const result = await LeadService.getLeadsFromDB({
            page: parsedPage,
            limit: parsedLimit,
            sortBy: validSortBy,
            sortOrder: validSortOrder,
            userId,
            ...filters,
            date,
            selectedUserId,
            ...(group.trim() ? { group: group.trim() } : {}),
            contactFilter: contactFilter as 'all' | 'email-only' | 'phone-only',
            ...(dueDate.trim() ? { dueDate: dueDate.trim() } : {}),
        });

        return res.status(200).json({
            success: true,
            message: 'Leads fetched successfully',
            data: result.items,
            pagination: {
                totalItems: result.pagination?.totalItems ?? 0,
                totalPages: result.pagination?.totalPages ?? 1,
                currentPage: parsedPage,
                limit: parsedLimit,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch leads',
        });
    }
}

async function getLeadsByDate(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Missing user authentication',
            });
        }

        const {
            page = '1',
            limit = '10',
            date,
        } = req.query as Record<string, string>;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a date (YYYY-MM-DD)',
            });
        }

        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD',
            });
        }

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await LeadService.getLeadsByDateFromDB({
            userId,
            page: parsedPage,
            limit: parsedLimit,
            startOfDay,
            endOfDay,
        });

        return res.status(200).json({
            success: true,
            message: 'Leads fetched successfully',
            date,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('getLeadsByDate error:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch leads',
        });
    }
}

async function getLeadsForTask(req: Request, res: Response) {
    try {
        const {
            page = '1',
            limit = '10',
            search = '',
            status = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            country = '',
            group = '',
            contactFilter = 'all',
        } = req.query as {
            page: string;
            limit: string;
            search: string;
            status: string;
            sortBy: string;
            sortOrder: string;
            country: string;
            group: string;
            contactFilter:
                | 'all'
                | 'email-only'
                | 'phone-only'
                | 'email-with-phone';
        };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(
            Math.max(parseInt(limit, 10) || 10, 1),
            100,
        );

        const userId = req.auth?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Missing user authentication',
            });
        }

        const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
        const validSortBy = [
            'createdAt',
            'company.name',
            'status',
            'country',
        ].includes(sortBy)
            ? sortBy
            : 'createdAt';

        const result = await LeadService.getLeadsForTaskCreation({
            page: parsedPage,
            limit: parsedLimit,
            sortBy: validSortBy,
            sortOrder: validSortOrder,
            userId,
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(status.trim() ? { status: status.trim() } : {}),
            ...(country.trim() ? { country: country.trim() } : {}),
            ...(group.trim() ? { group: group.trim() } : {}),
            contactFilter: contactFilter as
                | 'all'
                | 'email-only'
                | 'phone-only'
                | 'email-with-phone',
        });

        return res.status(200).json({
            success: true,
            message: 'Leads for task creation fetched successfully',
            data: result.items,
            pagination: {
                totalItems: result.pagination?.totalItems ?? 0,
                totalPages: result.pagination?.totalPages ?? 1,
                currentPage: parsedPage,
                limit: parsedLimit,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch leads',
        });
    }
}

async function getLeadById(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required.',
            });
        }

        if (!userId || !userRole) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const lead = await LeadService.getLeadByIdFromDB(id, userId, userRole);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found',
            });
        }

        return res.status(200).json({
            success: true,
            lead,
        });
    } catch (error) {
        console.error('Error fetching lead by ID:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to fetch lead',
        });
    }
}

async function newLead(req: Request, res: Response) {
    try {
        const ownerId = req.auth?.id;

        if (!ownerId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const parsed = newLeadValidation.parse(req.body);

        const result = await LeadService.newLeadsInDB(ownerId, parsed);

        if (result.duplicate) {
            return res.status(200).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('New lead error:', error);
        return res
            .status(500)
            .json({ success: false, message: 'Failed to create lead' });
    }
}

async function updateLead(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;
        const role = req.auth?.role;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required.',
            });
        }

        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const body = req.body;

        const parsed = updateLeadValidation.parse(body);

        const lead = await LeadService.updateLeadInDB(id, userId, role, parsed);

        res.status(200).json({
            success: true,
            message: 'Lead updated successfully',
            lead,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }

        if (typeof error === 'object' && error !== null && 'status' in error) {
            const err = error as { status: number; message: string };
            if (err.status === 403) {
                return res.status(403).json({
                    success: false,
                    message: err.message,
                });
            }
        }

        console.error('Error updating lead:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
}

async function importLeads(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const files = req.files as Express.Multer.File[];
        const { groupId, requireEmail, requirePhone } = req.body as {
            groupId?: string;
            requireEmail?: string;
            requirePhone?: string;
        };

        // Parse boolean flags from string values
        const emailRequired = requireEmail === 'true';
        const phoneRequired = requirePhone === 'true';

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded',
            });
        }

        // Accumulate results from all files
        let totalParsedData: ParsedRow[] = [];
        const allWarnings: string[] = [];
        const fileNames: string[] = [];

        // Parse all files first
        for (const file of files) {
            if (!file) continue;
            fileNames.push(file.originalname);

            try {
                let parsedData: ParsedRow[];

                if (
                    file.mimetype === 'text/csv' ||
                    file.originalname.endsWith('.csv')
                ) {
                    parsedData = await parseCSV(file.path);
                } else if (
                    file.mimetype ===
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.originalname.endsWith('.xlsx') ||
                    file.originalname.endsWith('.xls')
                ) {
                    parsedData = await parseExcel(file.path);
                } else {
                    allWarnings.push(
                        `Skipped unsupported file: ${file.originalname}`,
                    );
                    continue;
                }

                if (parsedData.length === 0) {
                    allWarnings.push(
                        `File "${file.originalname}" is empty or contains no data rows.`,
                    );
                    continue;
                }

                // Validate schema for this file
                const schemaValidation: SchemaValidationResult =
                    validateImportSchema(parsedData);

                if (!schemaValidation.valid) {
                    allWarnings.push(
                        `File "${file.originalname}" has invalid structure: ${schemaValidation.errors?.map((e) => e.message).join(', ')}`,
                    );
                    continue;
                }

                if (schemaValidation.warnings) {
                    allWarnings.push(
                        ...schemaValidation.warnings.map(
                            (w) => `[${file.originalname}] ${w}`,
                        ),
                    );
                }

                // Add file name reference to each row for tracking
                totalParsedData = [...totalParsedData, ...parsedData];
            } catch (parseError) {
                allWarnings.push(
                    `Error parsing "${file.originalname}": ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                );
            }
        }

        if (totalParsedData.length === 0) {
            // Build a more helpful error message
            let errorMessage =
                'Could not import leads from the uploaded file(s).';

            if (allWarnings.length > 0) {
                // Find the most specific error
                const structureError = allWarnings.find(
                    (w) =>
                        w.includes('invalid structure') ||
                        w.includes('Missing required'),
                );
                const emptyError = allWarnings.find((w) => w.includes('empty'));
                const parseError = allWarnings.find((w) =>
                    w.includes('Error parsing'),
                );

                if (structureError) {
                    errorMessage =
                        'Invalid file format. Please ensure your file has the required columns: companyName, country, and at least one contact field (contactEmail or contactPhone). Download the template for the correct format.';
                } else if (parseError) {
                    errorMessage =
                        'Could not read the file. Please ensure it is a valid CSV or Excel file and not corrupted.';
                } else if (emptyError) {
                    errorMessage =
                        'The uploaded file is empty or contains no data rows.';
                }
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                warnings: allWarnings,
            });
        }

        // Validate individual rows and collect errors
        const rowErrors: RowValidationError[] = [];
        const validRows: ParsedRow[] = [];
        const invalidRowIndices = new Set<number>();

        for (let i = 0; i < totalParsedData.length; i++) {
            const row = totalParsedData[i];
            if (!row) continue;

            const errors = validateRowData(row, i, {
                requireEmail: emailRequired,
                requirePhone: phoneRequired,
            });
            if (errors.length > 0) {
                rowErrors.push(...errors);
                invalidRowIndices.add(i);
            } else {
                validRows.push(row);
            }
        }

        // If all rows are invalid, return error
        if (validRows.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    'No valid rows found in the file(s). All rows have validation errors.',
                rowErrors: rowErrors.slice(0, 50),
                totalRowErrors: rowErrors.length,
                warnings: allWarnings,
            });
        }

        // Process valid leads
        const importResult = await LeadService.importLeadsFromData(
            validRows,
            userId,
            fileNames.join(', '),
            groupId,
        );

        // Combine row validation errors with import errors
        const allErrors = [
            ...rowErrors.map((e) => e.message),
            ...importResult.errors,
        ];

        // Combine validation errors into errorRows format
        const validationErrorRows = rowErrors.map((e) => {
            const row = totalParsedData[e.row - 2];
            return {
                rowNumber: e.row,
                companyName: row?.companyName
                    ? String(row.companyName)
                    : undefined,
                website: row?.website ? String(row.website) : undefined,
                contactEmail: row?.contactEmail
                    ? String(row.contactEmail)
                    : undefined,
                country: row?.country ? String(row.country) : undefined,
                errorType: 'validation' as const,
                errorMessage: e.message,
            };
        });

        // Combine all error rows
        const allErrorRows = [
            ...validationErrorRows,
            ...importResult.errorRows,
        ];

        // Calculate correct counts
        const skippedRowCount = invalidRowIndices.size;

        res.status(200).json({
            success: true,
            message: `Leads import completed from ${files.length} file(s)`,
            results: {
                total: totalParsedData.length,
                validRows: validRows.length,
                successful: importResult.successful,
                merged: importResult.merged,
                duplicatesInFile: importResult.duplicatesInFile,
                duplicatesInDb: importResult.duplicatesInDb,
                skippedRows: skippedRowCount,
                errors: allErrors.slice(0, 100),
                totalErrors: allErrors.length,
                errorRows: allErrorRows,
            },
            warnings: allWarnings,
            filesProcessed: fileNames,
        });
    } catch (error) {
        console.error('Error importing leads:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during import',
        });
    }
}

async function searchLeadByCompany(req: Request, res: Response) {
    try {
        const { name, website } = req.query as {
            name?: string;
            website?: string;
        };

        if (!name && !website) {
            return res.status(400).json({
                success: false,
                message: 'Please provide company name or website to search',
            });
        }

        const lead = await LeadService.searchLeadByCompany({
            companyName: name || undefined,
            website: website || undefined,
        });

        return res.status(200).json({
            success: true,
            found: !!lead,
            lead: lead || null,
        });
    } catch (error) {
        console.error('Error searching lead by company:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to search lead',
        });
    }
}

async function addContactPerson(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const userId = req.auth?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Lead ID is required',
            });
        }

        const contactPerson = req.body;

        if (!contactPerson.emails || contactPerson.emails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one email is required for contact person',
            });
        }

        if (!contactPerson.phones || contactPerson.phones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one phone is required for contact person',
            });
        }

        const lead = await LeadService.addContactPersonToLead(
            id,
            userId,
            contactPerson,
        );

        return res.status(200).json({
            success: true,
            message: 'Contact person added successfully',
            lead,
        });
    } catch (error) {
        console.error('Error adding contact person:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to add contact person',
        });
    }
}

async function bulkAssign(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Only admins can bulk assign
        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can bulk assign leads',
            });
        }

        const { leadIds, targetUserId } = req.body as {
            leadIds: string[];
            targetUserId: string;
        };

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide lead IDs to assign',
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide target user ID',
            });
        }

        const result = await LeadService.bulkAssignLeads(
            leadIds,
            targetUserId,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: `Successfully assigned ${result.success} leads`,
            results: result,
        });
    } catch (error) {
        console.error('Error bulk assigning leads:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to assign leads',
        });
    }
}

async function getAllMatchingLeadIds(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // Only admins can get all matching lead IDs
        if (userRole !== 'admin' && userRole !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can perform bulk operations',
            });
        }

        const { search, status, country, selectedUserId, group } =
            req.query as {
                search?: string;
                status?: string;
                country?: string;
                selectedUserId?: string;
                group?: string;
            };

        const leadIds = await LeadService.getAllMatchingLeadIds({
            search,
            status,
            country,
            userId,
            selectedUserId,
            group,
        });

        return res.status(200).json({
            success: true,
            count: leadIds.length,
            leadIds,
        });
    } catch (error) {
        console.error('Error getting matching lead IDs:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to get lead IDs',
        });
    }
}

async function bulkChangeGroup(req: Request, res: Response) {
    try {
        const userId = req.auth?.id;
        const userRole = req.auth?.role;
        const { leadIds, targetGroupId } = req.body as {
            leadIds: string[];
            targetGroupId: string | null;
        };

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'leadIds array is required',
            });
        }

        const results = await LeadService.bulkChangeGroup(
            leadIds,
            targetGroupId,
            userId,
        );

        return res.status(200).json({
            success: true,
            message: `Successfully changed group for ${results.success} leads`,
            results,
        });
    } catch (error) {
        console.error('Error in bulk change group:', error);
        return res.status(500).json({
            success: false,
            message: (error as Error).message || 'Failed to change group',
        });
    }
}

const LeadController = {
    newLead,
    getLeads,
    getLeadsByDate,
    getLeadsForTask,
    getLeadById,
    updateLead,
    importLeads,
    searchLeadByCompany,
    addContactPerson,
    bulkAssign,
    getAllMatchingLeadIds,
    bulkChangeGroup,
};
export default LeadController;
